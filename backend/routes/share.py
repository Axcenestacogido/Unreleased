import hashlib
import secrets
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
from auth import get_current_user, pwd_context
from routes.tracks import _stream_version

router = APIRouter(tags=["share"])


def _get_link_or_404(token: str, db: Session) -> models.SharedLink:
    link = db.query(models.SharedLink).filter(models.SharedLink.token == token).first()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    if link.expires_at and link.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Link expired")
    return link


# --- Authenticated: manage links ---

@router.post("/api/share", response_model=schemas.SharedLinkOut, status_code=201)
def create_link(
    data: schemas.SharedLinkCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    if not data.track_id and not data.project_id:
        raise HTTPException(status_code=400, detail="Provide track_id or project_id")

    if data.track_id:
        track = db.query(models.Track).join(models.Project).filter(
            models.Track.id == data.track_id,
            models.Project.user_id == user.id
        ).first()
        if not track:
            raise HTTPException(status_code=404, detail="Track not found")

    if data.project_id:
        project = db.query(models.Project).filter(
            models.Project.id == data.project_id,
            models.Project.user_id == user.id
        ).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

    token = secrets.token_urlsafe(24)
    password_hash = pwd_context.hash(data.password) if data.password else None

    link = models.SharedLink(
        token=token,
        track_id=data.track_id,
        project_id=data.project_id,
        password_hash=password_hash,
        expires_at=data.expires_at,
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


@router.get("/api/share", response_model=List[schemas.SharedLinkOut])
def list_links(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    track_ids = [t.id for t in db.query(models.Track.id).join(models.Project).filter(
        models.Project.user_id == user.id
    ).all()]
    project_ids = [p.id for p in db.query(models.Project.id).filter(
        models.Project.user_id == user.id
    ).all()]

    return db.query(models.SharedLink).filter(
        (models.SharedLink.track_id.in_(track_ids)) |
        (models.SharedLink.project_id.in_(project_ids))
    ).all()


@router.delete("/api/share/{token}", status_code=204)
def delete_link(
    token: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    link = db.query(models.SharedLink).filter(models.SharedLink.token == token).first()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    db.delete(link)
    db.commit()


# --- Public: access shared content ---

@router.post("/s/{token}/auth")
def verify_share_password(
    token: str,
    data: schemas.ShareAccess,
    db: Session = Depends(get_db)
):
    link = _get_link_or_404(token, db)
    if link.password_hash:
        if not data.password or not pwd_context.verify(data.password, link.password_hash):
            raise HTTPException(status_code=403, detail="Wrong password")
    return {"ok": True, "has_password": bool(link.password_hash)}


@router.get("/s/{token}/meta")
def get_share_meta(token: str, db: Session = Depends(get_db)):
    link = _get_link_or_404(token, db)
    return {
        "has_password": bool(link.password_hash),
        "track_id": link.track_id,
        "project_id": link.project_id,
        "expires_at": link.expires_at,
    }


@router.get("/s/{token}/track")
def get_shared_track(token: str, password: Optional[str] = None, db: Session = Depends(get_db)):
    link = _get_link_or_404(token, db)
    if link.password_hash and (not password or not pwd_context.verify(password, link.password_hash)):
        raise HTTPException(status_code=403, detail="Password required")
    if not link.track_id:
        raise HTTPException(status_code=400, detail="Link is for a project, not a track")

    track = db.query(models.Track).filter(models.Track.id == link.track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    current = max(track.versions, key=lambda v: v.version_number) if track.versions else None
    return {
        "name": track.name,
        "versions": [{"version_number": v.version_number, "note": v.note, "created_at": v.created_at} for v in track.versions],
        "current_version": current.version_number if current else None,
    }


@router.get("/s/{token}/stream")
def stream_shared_track(
    token: str,
    request: Request,
    version: Optional[int] = None,
    password: Optional[str] = None,
    db: Session = Depends(get_db)
):
    link = _get_link_or_404(token, db)
    if link.password_hash and (not password or not pwd_context.verify(password, link.password_hash)):
        raise HTTPException(status_code=403, detail="Password required")
    if not link.track_id:
        raise HTTPException(status_code=400, detail="Link is for a project")

    track = db.query(models.Track).filter(models.Track.id == link.track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    # Record listen event
    ip = request.client.host if request.client else "unknown"
    ip_hash = hashlib.sha256(ip.encode()).hexdigest()[:16]
    event = models.ListenEvent(shared_link_id=link.id, ip_hash=ip_hash)
    db.add(event)
    link.play_count += 1
    db.commit()

    return _stream_version(track, version, request)


@router.get("/s/{token}/project")
def get_shared_project(token: str, password: Optional[str] = None, db: Session = Depends(get_db)):
    link = _get_link_or_404(token, db)
    if link.password_hash and (not password or not pwd_context.verify(password, link.password_hash)):
        raise HTTPException(status_code=403, detail="Password required")
    if not link.project_id:
        raise HTTPException(status_code=400, detail="Link is for a track, not a project")

    project = db.query(models.Project).filter(models.Project.id == link.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    tracks = db.query(models.Track).filter(models.Track.project_id == project.id).all()
    return {
        "name": project.name,
        "description": project.description,
        "tracks": [
            {
                "id": t.id,
                "name": t.name,
                "versions": [{"version_number": v.version_number, "note": v.note} for v in t.versions],
                "current_version": max((v.version_number for v in t.versions), default=None),
            }
            for t in tracks
        ],
    }


@router.get("/s/{token}/stream/{track_id}")
def stream_shared_project_track(
    token: str,
    track_id: int,
    request: Request,
    version: Optional[int] = None,
    password: Optional[str] = None,
    db: Session = Depends(get_db)
):
    link = _get_link_or_404(token, db)
    if link.password_hash and (not password or not pwd_context.verify(password, link.password_hash)):
        raise HTTPException(status_code=403, detail="Password required")
    if not link.project_id:
        raise HTTPException(status_code=400, detail="Link is for a track")

    track = db.query(models.Track).filter(
        models.Track.id == track_id,
        models.Track.project_id == link.project_id
    ).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found in this project")

    ip = request.client.host if request.client else "unknown"
    ip_hash = hashlib.sha256(ip.encode()).hexdigest()[:16]
    event = models.ListenEvent(shared_link_id=link.id, ip_hash=ip_hash)
    db.add(event)
    link.play_count += 1
    db.commit()

    return _stream_version(track, version, request)


# --- Analytics ---

@router.get("/api/analytics", response_model=List[schemas.LinkAnalytics])
def get_analytics(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    track_ids = [t.id for t in db.query(models.Track.id).join(models.Project).filter(
        models.Project.user_id == user.id
    ).all()]
    project_ids = [p.id for p in db.query(models.Project.id).filter(
        models.Project.user_id == user.id
    ).all()]

    links = db.query(models.SharedLink).filter(
        (models.SharedLink.track_id.in_(track_ids)) |
        (models.SharedLink.project_id.in_(project_ids))
    ).all()

    result = []
    for link in links:
        track_name = link.track.name if link.track else None
        project_name = link.project.name if link.project else None
        result.append(schemas.LinkAnalytics(
            token=link.token,
            track_id=link.track_id,
            project_id=link.project_id,
            track_name=track_name,
            project_name=project_name,
            play_count=link.play_count,
            created_at=link.created_at,
            expires_at=link.expires_at,
            events=[schemas.ListenEventOut.model_validate(e) for e in link.listen_events[-20:]],
        ))
    return result
