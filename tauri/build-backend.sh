#!/usr/bin/env bash
# Compila el backend FastAPI como binario standalone usando PyInstaller
# Requiere: pip install pyinstaller
# El binario resultante va en src-tauri/binaries/musicvault-backend

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/../backend"
OUT_DIR="$SCRIPT_DIR/src-tauri/binaries"

mkdir -p "$OUT_DIR"

cd "$BACKEND_DIR"
pip install pyinstaller --quiet

pyinstaller \
  --onefile \
  --name musicvault-backend \
  --distpath "$OUT_DIR" \
  --add-data "*.py:." \
  main.py

echo "✓ Backend compiled: $OUT_DIR/musicvault-backend"
echo ""
echo "Next:"
echo "  cd tauri && npm install && npm run build"
