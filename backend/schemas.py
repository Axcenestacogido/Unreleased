from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


# Auth
class UserCreate(BaseModel):
    username: str
    password: str

class UserOut(BaseModel):
    id: int
    username: str
    created_at: datetime
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    user_id: Optional[int] = None


# Projects
class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = None
    cover_image: Optional[str] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    cover_image: Optional[str] = None

class ProjectOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    color: Optional[str]
    cover_image: Optional[str]
    created_at: datetime
    class Config:
        from_attributes = True


# Folders
class FolderCreate(BaseModel):
    name: str

class FolderUpdate(BaseModel):
    name: str

class FolderOut(BaseModel):
    id: int
    project_id: int
    name: str
    created_at: datetime
    class Config:
        from_attributes = True


# Track Versions
class TrackVersionOut(BaseModel):
    id: int
    version_number: int
    original_filename: str
    file_size: int
    duration: Optional[int]
    mime_type: str
    note: Optional[str]
    created_at: datetime
    class Config:
        from_attributes = True


# Tracks
class TrackUpdate(BaseModel):
    name: Optional[str] = None
    folder_id: Optional[int] = None
    project_id: Optional[int] = None
    bpm: Optional[int] = None
    key_signature: Optional[str] = None
    lyrics: Optional[str] = None

class ListenEventOut(BaseModel):
    timestamp: datetime
    ip_hash: Optional[str]
    class Config:
        from_attributes = True

class LinkAnalytics(BaseModel):
    token: str
    track_id: Optional[int]
    project_id: Optional[int]
    track_name: Optional[str]
    project_name: Optional[str]
    play_count: int
    created_at: datetime
    expires_at: Optional[datetime]
    events: List[ListenEventOut] = []
    class Config:
        from_attributes = True

class StemOut(BaseModel):
    id: int
    track_id: int
    name: str
    volume: float
    file_size: int
    created_at: datetime
    class Config:
        from_attributes = True

class StemUpdate(BaseModel):
    name: Optional[str] = None
    volume: Optional[float] = None

class TrackOut(BaseModel):
    id: int
    project_id: int
    folder_id: Optional[int]
    name: str
    bpm: Optional[int] = None
    key_signature: Optional[str] = None
    lyrics: Optional[str] = None
    project_name: Optional[str] = None
    project_cover_image: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime]
    versions: List[TrackVersionOut] = []
    stems: List[StemOut] = []
    class Config:
        from_attributes = True


# Shared Links
class SharedLinkCreate(BaseModel):
    track_id: Optional[int] = None
    project_id: Optional[int] = None
    password: Optional[str] = None
    expires_at: Optional[datetime] = None

class SharedLinkOut(BaseModel):
    id: int
    token: str
    track_id: Optional[int]
    project_id: Optional[int]
    expires_at: Optional[datetime]
    play_count: int
    created_at: datetime
    class Config:
        from_attributes = True

class ShareAccess(BaseModel):
    password: Optional[str] = None
