# MusicVault

Self-hosted private music manager. Upload, organize, version and share your tracks — no cloud, no third parties, your hardware.

## Quick start

```bash
# Clone
git clone https://github.com/axcenestacogido/unreleased.git && cd unreleased

# (Optional) set a strong secret key
echo "SECRET_KEY=$(openssl rand -hex 32)" > .env

# Build and run
docker compose up -d --build

# Open http://localhost:8080
# Register your account on first visit
```

## Features (MVP)

- **Upload & stream** — MP3, WAV, FLAC, AAC, OGG, M4A. Drag & drop with progress bar.
- **Projects & folders** — Organise tracks in a sidebar tree.
- **Track versioning** — Upload new versions, keep full history, play any version.
- **Share links** — Password-protected, expirable public links. Play counter per link.
- **Waveform player** — WaveSurfer.js, seek, volume control, queue navigation.
- **PWA** — Installable from Safari on iOS (Add to Home Screen). Offline cache for recent audio.

## Development

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev   # proxies /api → localhost:8000
```

## Configuration

| Variable | Default | Description |
|---|---|---|
| `SECRET_KEY` | `change-me-in-production` | JWT signing key |
| `DATA_DIR` | `./backend/data` | Where DB and audio files live |
| `PORT` | `8080` | External port exposed by nginx |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `10080` (7 days) | Session duration |

## iOS (PWA)

1. Open `http://your-server-ip:8080` in Safari
2. Tap Share → "Add to Home Screen"
3. Done — works like a native app

For background audio on iOS 17+, the track must be playing before the screen locks. This is a WebKit limitation; if it becomes an issue, the next step is Capacitor + TestFlight.

## Data

All audio files and the SQLite database live in the `musicvault_data` Docker volume. Back it up with:

```bash
docker run --rm -v musicvault_data:/data -v $(pwd):/backup alpine tar czf /backup/musicvault-backup.tar.gz /data
```
