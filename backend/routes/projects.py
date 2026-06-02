from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models
import schemas
from auth import get_current_user

router = APIRouter(prefix="/api/projects", tags=["projects"])


def get_project_or_404(project_id: int, user: models.User, db: Session) -> models.Project:
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.user_id == user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("", response_model=List[schemas.ProjectOut])
def list_projects(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    return db.query(models.Project).filter(models.Project.user_id == user.id).all()


@router.post("", response_model=schemas.ProjectOut, status_code=201)
def create_project(
    data: schemas.ProjectCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    project = models.Project(user_id=user.id, **data.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/{project_id}", response_model=schemas.ProjectOut)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    return get_project_or_404(project_id, user, db)


@router.patch("/{project_id}", response_model=schemas.ProjectOut)
def update_project(
    project_id: int,
    data: schemas.ProjectUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    project = get_project_or_404(project_id, user, db)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(project, key, value)
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=204)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    project = get_project_or_404(project_id, user, db)
    db.delete(project)
    db.commit()


# Folders
@router.get("/{project_id}/folders", response_model=List[schemas.FolderOut])
def list_folders(
    project_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    get_project_or_404(project_id, user, db)
    return db.query(models.Folder).filter(models.Folder.project_id == project_id).all()


@router.post("/{project_id}/folders", response_model=schemas.FolderOut, status_code=201)
def create_folder(
    project_id: int,
    data: schemas.FolderCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    get_project_or_404(project_id, user, db)
    folder = models.Folder(project_id=project_id, name=data.name)
    db.add(folder)
    db.commit()
    db.refresh(folder)
    return folder


@router.patch("/{project_id}/folders/{folder_id}", response_model=schemas.FolderOut)
def update_folder(
    project_id: int,
    folder_id: int,
    data: schemas.FolderUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    get_project_or_404(project_id, user, db)
    folder = db.query(models.Folder).filter(
        models.Folder.id == folder_id,
        models.Folder.project_id == project_id
    ).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    folder.name = data.name
    db.commit()
    db.refresh(folder)
    return folder


@router.delete("/{project_id}/folders/{folder_id}", status_code=204)
def delete_folder(
    project_id: int,
    folder_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    get_project_or_404(project_id, user, db)
    folder = db.query(models.Folder).filter(
        models.Folder.id == folder_id,
        models.Folder.project_id == project_id
    ).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    # Move tracks to no folder before deleting
    db.query(models.Track).filter(models.Track.folder_id == folder_id).update({"folder_id": None})
    db.delete(folder)
    db.commit()
