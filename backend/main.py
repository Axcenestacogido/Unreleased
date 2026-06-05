import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from sqlalchemy import text

from database import engine
import models
from events import event_bus
from routes import auth, projects, tracks, share, stems as stems_router
from routes.events import router as events_router

models.Base.metadata.create_all(bind=engine)

# Safe column migrations for new fields
_migrations = [
    "ALTER TABLE projects ADD COLUMN cover_image TEXT",
    "ALTER TABLE tracks ADD COLUMN bpm INTEGER",
    "ALTER TABLE tracks ADD COLUMN key_signature VARCHAR",
    "ALTER TABLE tracks ADD COLUMN lyrics TEXT",
    "CREATE TABLE IF NOT EXISTS stems (id INTEGER PRIMARY KEY, track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE, name VARCHAR NOT NULL, file_path VARCHAR NOT NULL, file_size INTEGER NOT NULL DEFAULT 0, volume REAL NOT NULL DEFAULT 1.0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
]
with engine.connect() as _conn:
    for _sql in _migrations:
        try:
            _conn.execute(text(_sql))
            _conn.commit()
        except Exception:
            pass

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
app.include_router(stems_router.router)
app.include_router(events_router)

# Serve frontend in production
frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
_share_page = Path(__file__).parent / "share_page.html"

# Always register this route so /s/{token} returns the SPA page.
# API sub-paths like /s/{token}/meta are registered above and take priority.
@app.get("/s/{token}", include_in_schema=False)
async def share_spa(token: str):
    # Prefer the full compiled React app if available
    index = frontend_dist / "index.html"
    if index.exists():
        return FileResponse(str(index))
    # Fallback: serve the standalone share page (no build required)
    return FileResponse(str(_share_page), media_type="text/html")

if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="static")
