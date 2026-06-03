from sqlalchemy import (
    Column, Integer, String, ForeignKey, DateTime, BigInteger, Boolean, Text
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")


class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String, nullable=True)
    cover_image = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    owner = relationship("User", back_populates="projects")
    folders = relationship("Folder", back_populates="project", cascade="all, delete-orphan")
    tracks = relationship("Track", back_populates="project", cascade="all, delete-orphan")
    shared_links = relationship("SharedLink", back_populates="project", cascade="all, delete-orphan")


class Folder(Base):
    __tablename__ = "folders"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="folders")
    tracks = relationship("Track", back_populates="folder")


class Track(Base):
    __tablename__ = "tracks"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    folder_id = Column(Integer, ForeignKey("folders.id"), nullable=True)
    name = Column(String, nullable=False)
    bpm = Column(Integer, nullable=True)
    key_signature = Column(String, nullable=True)
    lyrics = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    project = relationship("Project", back_populates="tracks")
    folder = relationship("Folder", back_populates="tracks")
    versions = relationship("TrackVersion", back_populates="track", cascade="all, delete-orphan", order_by="TrackVersion.version_number")
    shared_links = relationship("SharedLink", back_populates="track", cascade="all, delete-orphan")

    @property
    def current_version(self):
        if self.versions:
            return max(self.versions, key=lambda v: v.version_number)
        return None


class TrackVersion(Base):
    __tablename__ = "track_versions"
    id = Column(Integer, primary_key=True, index=True)
    track_id = Column(Integer, ForeignKey("tracks.id"), nullable=False)
    version_number = Column(Integer, nullable=False)
    file_path = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    file_size = Column(BigInteger, nullable=False)
    duration = Column(Integer, nullable=True)  # seconds
    mime_type = Column(String, nullable=False)
    note = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    track = relationship("Track", back_populates="versions")


class SharedLink(Base):
    __tablename__ = "shared_links"
    id = Column(Integer, primary_key=True, index=True)
    token = Column(String, unique=True, index=True, nullable=False)
    track_id = Column(Integer, ForeignKey("tracks.id"), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    password_hash = Column(String, nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    play_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    track = relationship("Track", back_populates="shared_links")
    project = relationship("Project", back_populates="shared_links")
    listen_events = relationship("ListenEvent", back_populates="link", cascade="all, delete-orphan")


class ListenEvent(Base):
    __tablename__ = "listen_events"
    id = Column(Integer, primary_key=True, index=True)
    shared_link_id = Column(Integer, ForeignKey("shared_links.id"), nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    ip_hash = Column(String, nullable=True)

    link = relationship("SharedLink", back_populates="listen_events")
