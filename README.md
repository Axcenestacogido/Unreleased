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

## Features

### Core
- **Upload & stream** — MP3, WAV, FLAC, AAC, OGG, M4A. Drag & drop with progress bar.
- **Projects & folders** — Organise tracks in a sidebar tree. Move tracks between projects/folders.
- **Track versioning** — Upload new versions, full history, play any version.
- **Share links** — Password-protected, expirable links for tracks or entire projects. Play counter per link.

### Player
- **Waveform player** — Custom canvas waveform, seek, volume.
- **Pitch control** — ±12 semitones via Tone.js PitchShift.
- **Speed control** — 0.5x–2.0x independent of pitch.
- **Loop A-B** — Click A/B markers on the waveform to loop a section.

### Tools
- **Recorder** — Record from microphone and save directly to a project (MediaRecorder API).
- **Analytics** — See when and how many times each shared link was played, with anonymised IP.
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

## Desktop app (Tauri)

Wraps the frontend in a native Mac/Windows window. The FastAPI backend runs as a sidecar.

**Prerequisites:** Rust + Tauri CLI, Node 22, Python 3.12 + PyInstaller.

```bash
# 1. Compile the backend binary
cd tauri && bash build-backend.sh

# 2. Install Tauri CLI
npm install

# 3. Dev mode (backend must be running separately)
npm run dev

# 4. Build native installer
npm run build
```

The resulting `.dmg` / `.exe` / `.AppImage` includes both the frontend and backend.

## Data

All audio files and the SQLite database live in the `musicvault_data` Docker volume. Back it up with:

```bash
docker run --rm -v musicvault_data:/data -v $(pwd):/backup alpine tar czf /backup/musicvault-backup.tar.gz /data
```
