import os
import uuid
import hashlib
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
from auth import get_current_user
from config import AUDIO_DIR, ALLOWED_AUDIO_EXTENSIONS, MAX_UPLOAD_SIZE_MB

router = APIRouter(prefix="/api/tracks", tags=["tracks"])

CHUNK_SIZE = 1024 * 1024  # 1MB


def get_track_or_404(track_id: int, user: models.User, db: Session) -> models.Track:
    track = db.query(models.Track).join(models.Project).filter(
        models.Track.id == track_id,
        models.Project.user_id == user.id
    ).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    return track


def save_audio_file(upload: UploadFile) -> tuple[str, int, str]:
    ext = Path(upload.filename).suffix.lower()
    if ext not in ALLOWED_AUDIO_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {ext}")

    file_id = str(uuid.uuid4())
    dest_path = AUDIO_DIR / f"{file_id}{ext}"
    total = 0
    max_bytes = MAX_UPLOAD_SIZE_MB * 1024 * 1024

    with open(dest_path, "wb") as f:
        while chunk := upload.file.read(CHUNK_SIZE):
            total += len(chunk)
            if total > max_bytes:
                dest_path.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="File too large")
            f.write(chunk)

    mime = upload.content_type or "audio/mpeg"
    return str(dest_path), total, mime


@router.get("/project/{project_id}", response_model=List[schemas.TrackOut])
def list_tracks(
    project_id: int,
    folder_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.user_id == user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    query = db.query(models.Track).filter(models.Track.project_id == project_id)
    if folder_id is not None:
        query = query.filter(models.Track.folder_id == folder_id)
    return query.order_by(models.Track.created_at.desc()).all()


@router.post("/project/{project_id}/upload", response_model=schemas.TrackOut, status_code=201)
def upload_track(
    project_id: int,
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    folder_id: Optional[int] = Form(None),
    version_note: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.user_id == user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    track_name = name or Path(file.filename).stem
    file_path, file_size, mime_type = save_audio_file(file)

    track = models.Track(
        project_id=project_id,
        folder_id=folder_id,
        name=track_name,
    )
    db.add(track)
    db.flush()

    version = models.TrackVersion(
        track_id=track.id,
        version_number=1,
        file_path=file_path,
        original_filename=file.filename,
        file_size=file_size,
        mime_type=mime_type,
        note=version_note,
    )
    db.add(version)
    db.commit()
    db.refresh(track)
    return track


@router.post("/{track_id}/version", response_model=schemas.TrackOut, status_code=201)
def upload_new_version(
    track_id: int,
    file: UploadFile = File(...),
    note: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    track = get_track_or_404(track_id, user, db)
    max_ver = max((v.version_number for v in track.versions), default=0)

    file_path, file_size, mime_type = save_audio_file(file)
    version = models.TrackVersion(
        track_id=track.id,
        version_number=max_ver + 1,
        file_path=file_path,
        original_filename=file.filename,
        file_size=file_size,
        mime_type=mime_type,
        note=note,
    )
    db.add(version)
    db.commit()
    db.refresh(track)
    return track


@router.get("/{track_id}", response_model=schemas.TrackOut)
def get_track(
    track_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    return get_track_or_404(track_id, user, db)


@router.patch("/{track_id}", response_model=schemas.TrackOut)
def update_track(
    track_id: int,
    data: schemas.TrackUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    track = get_track_or_404(track_id, user, db)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(track, key, value)
    db.commit()
    db.refresh(track)
    return track


@router.delete("/{track_id}", status_code=204)
def delete_track(
    track_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    track = get_track_or_404(track_id, user, db)
    for v in track.versions:
        Path(v.file_path).unlink(missing_ok=True)
    db.delete(track)
    db.commit()


@router.get("/{track_id}/stream")
def stream_track(
    track_id: int,
    request: Request,
    version: Optional[int] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    track = get_track_or_404(track_id, user, db)
    return _stream_version(track, version, request)


def _stream_version(track: models.Track, version_number: Optional[int], request: Request) -> StreamingResponse:
    if not track.versions:
        raise HTTPException(status_code=404, detail="No audio file")

    if version_number is not None:
        ver = next((v for v in track.versions if v.version_number == version_number), None)
    else:
        ver = max(track.versions, key=lambda v: v.version_number)

    if not ver:
        raise HTTPException(status_code=404, detail="Version not found")

    path = Path(ver.file_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Audio file missing")

    file_size = path.stat().st_size
    range_header = request.headers.get("range")

    if range_header:
        # Range request for seek support
        start, end = 0, file_size - 1
        range_val = range_header.strip().replace("bytes=", "")
        parts = range_val.split("-")
        start = int(parts[0]) if parts[0] else 0
        end = int(parts[1]) if parts[1] else file_size - 1
        end = min(end, file_size - 1)
        length = end - start + 1

        def gen():
            with open(path, "rb") as f:
                f.seek(start)
                remaining = length
                while remaining > 0:
                    chunk = f.read(min(CHUNK_SIZE, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk

        return StreamingResponse(
            gen(),
            status_code=206,
            media_type=ver.mime_type,
            headers={
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(length),
            }
        )

    def gen_full():
        with open(path, "rb") as f:
            while chunk := f.read(CHUNK_SIZE):
                yield chunk

    return StreamingResponse(
        gen_full(),
        media_type=ver.mime_type,
        headers={
            "Accept-Ranges": "bytes",
            "Content-Length": str(file_size),
        }
    )
