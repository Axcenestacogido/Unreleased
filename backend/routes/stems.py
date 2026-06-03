import asyncio
import os
import shutil
import subprocess
import tempfile
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from database import get_db, SessionLocal
import models
import schemas
from auth import get_current_user
from config import DATA_DIR
from events import event_bus

router = APIRouter(tags=["stems"])

STEMS_DIR = Path(DATA_DIR) / "stems"
CHUNK_SIZE = 1024 * 1024

_executor = ThreadPoolExecutor(max_workers=2)


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


# ── Separation ────────────────────────────────────────────────────────────────

def _run_demucs(file_path: str, track_id: int, user_id: int) -> None:
    """Runs in a thread pool. Creates stems and fires SSE when done."""
    STEMS_DIR.mkdir(parents=True, exist_ok=True)
    db = SessionLocal()
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            cmd = [
                "python", "-m", "demucs",
                "--mp3", "--mp3-bitrate", "192",
                "-n", "htdemucs",
                "-o", tmpdir,
                file_path,
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=3600)

            if result.returncode != 0:
                event_bus.publish(user_id, {
                    "type": "stems_error",
                    "track_id": track_id,
                    "message": result.stderr[-500:] if result.stderr else "Unknown error",
                })
                return

            # Locate output: tmpdir/htdemucs/<basename>/<stem>.mp3
            basename = Path(file_path).stem
            stem_dir = Path(tmpdir) / "htdemucs" / basename

            # Delete existing auto-stems for this track
            db.query(models.Stem).filter(models.Stem.track_id == track_id).delete()
            db.commit()

            stem_names = ["vocals", "drums", "bass", "other"]
            created = []
            for name in stem_names:
                src = stem_dir / f"{name}.mp3"
                if not src.exists():
                    continue
                dest = STEMS_DIR / f"{uuid.uuid4()}.mp3"
                shutil.copy(src, dest)
                stem = models.Stem(
                    track_id=track_id,
                    name=name.capitalize(),
                    file_path=str(dest),
                    file_size=dest.stat().st_size,
                    volume=1.0,
                )
                db.add(stem)
                created.append(name)

            db.commit()

            stems_out = [
                {"id": s.id, "name": s.name, "volume": s.volume, "file_size": s.file_size, "track_id": s.track_id, "created_at": s.created_at.isoformat()}
                for s in db.query(models.Stem).filter(models.Stem.track_id == track_id).all()
            ]

            event_bus.publish(user_id, {
                "type": "stems_ready",
                "track_id": track_id,
                "stems": stems_out,
            })
    except Exception as e:
        event_bus.publish(user_id, {
            "type": "stems_error",
            "track_id": track_id,
            "message": str(e),
        })
    finally:
        db.close()


@router.post("/api/tracks/{track_id}/separate")
async def separate_stems(
    track_id: int,
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

    ver = max(track.versions, key=lambda v: v.version_number) if track.versions else None
    if not ver:
        raise HTTPException(status_code=400, detail="No audio file")

    loop = asyncio.get_running_loop()
    loop.run_in_executor(_executor, _run_demucs, ver.file_path, track_id, user.id)

    return {"status": "processing"}


# ── GET stems list ────────────────────────────────────────────────────────────

@router.get("/api/tracks/{track_id}/stems", response_model=list[schemas.StemOut])
def list_stems(
    track_id: int,
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
        raise HTTPException(status_code=404)
    return track.stems


# ── Upload ────────────────────────────────────────────────────────────────────

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


# ── Update / Delete ───────────────────────────────────────────────────────────

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


# ── Stream ────────────────────────────────────────────────────────────────────

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
            gen_range(), status_code=206,
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
