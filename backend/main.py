import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from sqlalchemy import text

from database import engine
import models
from config import COVERS_DIR
from events import event_bus
from routes import auth, projects, tracks, share
from routes.events import router as events_router

models.Base.metadata.create_all(bind=engine)

# Safe column migrations for existing databases
def _migrate():
    migrations = [
        ("tracks", "artist", "VARCHAR"),
        ("tracks", "album", "VARCHAR"),
        ("tracks", "year", "INTEGER"),
        ("tracks", "genre", "VARCHAR"),
        ("projects", "cover_path", "VARCHAR"),
    ]
    with engine.connect() as conn:
        for table, col, col_type in migrations:
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
                conn.commit()
            except Exception:
                pass

_migrate()

app = FastAPI(title="MusicVault", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    event_bus.set_loop(asyncio.get_event_loop())


app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(tracks.router)
app.include_router(share.router)
app.include_router(events_router)

# Serve cover images
app.mount("/covers", StaticFiles(directory=str(COVERS_DIR)), name="covers")

# Serve frontend in production
frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="static")
