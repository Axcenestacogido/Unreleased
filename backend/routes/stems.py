import os
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
from auth import get_current_user
from config import DATA_DIR

router = APIRouter(tags=["stems"])

STEMS_DIR = Path(DATA_DIR) / "stems"
CHUNK_SIZE = 1024 * 1024


def _get_stem_owned(stem_id: int, user: models.User, db: Session) -> models.Stem:
    stem = (
        db.query(models.Stem)
        .join(models.Track)
        .join(models.Project)
        .filter(models.Stem.id == stem_id, models.Project.user_id == user.id)
        .first()
    )
    if not stem:
        raise HTTPException(status_code=404, detail="Stem not found")
    return stem


@router.post("/api/tracks/{track_id}/stems", response_model=schemas.StemOut, status_code=201)
async def upload_stem(
    track_id: int,
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    track = (
        db.query(models.Track)
        .join(models.Project)
        .filter(models.Track.id == track_id, models.Project.user_id == user.id)
        .first()
    )
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    STEMS_DIR.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename).suffix.lower() if file.filename else ".bin"
    filepath = STEMS_DIR / f"{uuid.uuid4()}{ext}"

    total = 0
    with open(filepath, "wb") as f:
        while chunk := await file.read(CHUNK_SIZE):
            f.write(chunk)
            total += len(chunk)

    stem_name = name or (Path(file.filename).stem if file.filename else "Stem")
    stem = models.Stem(
        track_id=track_id,
        name=stem_name,
        file_path=str(filepath),
        file_size=total,
    )
    db.add(stem)
    db.commit()
    db.refresh(stem)
    return stem


@router.patch("/api/stems/{stem_id}", response_model=schemas.StemOut)
def update_stem(
    stem_id: int,
    data: schemas.StemUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    stem = _get_stem_owned(stem_id, user, db)
    if data.name is not None:
        stem.name = data.name
    if data.volume is not None:
        stem.volume = max(0.0, min(1.0, data.volume))
    db.commit()
    db.refresh(stem)
    return stem


@router.delete("/api/stems/{stem_id}", status_code=204)
def delete_stem(
    stem_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    stem = _get_stem_owned(stem_id, user, db)
    try:
        os.remove(stem.file_path)
    except Exception:
        pass
    db.delete(stem)
    db.commit()


@router.get("/api/stems/{stem_id}/stream")
def stream_stem(
    stem_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    stem = _get_stem_owned(stem_id, user, db)
    file_size = stem.file_size
    range_header = request.headers.get("range")

    if range_header:
        start_str, end_str = range_header.replace("bytes=", "").split("-")
        start = int(start_str)
        end = int(end_str) if end_str else file_size - 1
        length = end - start + 1

        def gen_range():
            with open(stem.file_path, "rb") as f:
                f.seek(start)
                remaining = length
                while remaining > 0:
                    chunk = f.read(min(CHUNK_SIZE, remaining))
                    if not chunk:
                        break
                    yield chunk
                    remaining -= len(chunk)

        return StreamingResponse(
            gen_range(),
            status_code=206,
            headers={
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(length),
            },
        )

    def gen_full():
        with open(stem.file_path, "rb") as f:
            while chunk := f.read(CHUNK_SIZE):
                yield chunk

    return StreamingResponse(
        gen_full(),
        headers={"Accept-Ranges": "bytes", "Content-Length": str(file_size)},
    )
