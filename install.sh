#!/usr/bin/env bash
set -euo pipefail

REPO="https://github.com/axcenestacogido/unreleased.git"
DIR="musicvault"
PORT="${PORT:-8080}"

echo ""
echo "  MusicVault installer"
echo "  ─────────────────────────────────────"
echo ""

# Prerequisites check
for cmd in git docker; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "  ERROR: '$cmd' is not installed. Please install it first."
    exit 1
  fi
done

if ! docker compose version &>/dev/null; then
  echo "  ERROR: Docker Compose v2 is required (docker compose, not docker-compose)."
  exit 1
fi

# Clone or update
if [ -d "$DIR/.git" ]; then
  echo "  [1/4] Updating existing install in ./$DIR …"
  git -C "$DIR" pull --ff-only
else
  echo "  [1/4] Cloning repository …"
  git clone "$REPO" "$DIR"
fi

cd "$DIR"

# Generate .env if it doesn't exist
if [ ! -f .env ]; then
  echo "  [2/4] Generating secret key …"
  SECRET=$(openssl rand -hex 32 2>/dev/null || python3 -c "import secrets; print(secrets.token_hex(32))")
  cat > .env <<ENV
SECRET_KEY=$SECRET
PORT=$PORT
ACCESS_TOKEN_EXPIRE_MINUTES=10080
ENV
  echo "        .env created."
else
  echo "  [2/4] Using existing .env"
fi

# Build and start
echo "  [3/4] Building images (this takes a few minutes the first time) …"
docker compose build --quiet

echo "  [4/4] Starting services …"
docker compose up -d

echo ""
echo "  ✓  MusicVault is running at  http://localhost:$PORT"
echo ""
echo "  First run: open the URL, create an account, and start uploading."
echo ""
echo "  Useful commands:"
echo "    docker compose -f $DIR/docker-compose.yml logs -f   # view logs"
echo "    docker compose -f $DIR/docker-compose.yml down      # stop"
echo "    docker compose -f $DIR/docker-compose.yml pull      # update images"
echo ""
echo "  iOS PWA: open http://<your-local-ip>:$PORT in Safari,"
echo "           tap Share → Add to Home Screen."
echo ""
