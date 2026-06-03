#Requires -Version 5.1
<#
.SYNOPSIS
    MusicVault installer for Windows
.DESCRIPTION
    Clones the repo, generates a secret key, builds Docker images and starts the app.
    Requires: Docker Desktop (https://www.docker.com/products/docker-desktop/)
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Repo    = "https://github.com/axcenestacogido/unreleased.git"
$Branch  = "claude/sleepy-ritchie-btYBt"
$Dir     = "musicvault"
$Port    = if ($env:PORT) { $env:PORT } else { "8080" }
$InstDir = Join-Path $HOME $Dir   # always installs to C:\Users\<you>\musicvault

# Move to user home so we always have write permission
Set-Location $HOME

Write-Host ""
Write-Host "  MusicVault installer" -ForegroundColor White
Write-Host "  " + ("─" * 37)
Write-Host ""

# Prerequisites
foreach ($cmd in @("git", "docker")) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Host "  ERROR: '$cmd' not found." -ForegroundColor Red
        if ($cmd -eq "docker") {
            Write-Host "  Install Docker Desktop from https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow
        } else {
            Write-Host "  Install Git from https://git-scm.com/download/win" -ForegroundColor Yellow
        }
        exit 1
    }
}

try { docker compose version | Out-Null } catch {
    Write-Host "  ERROR: Docker Compose v2 not found. Update Docker Desktop." -ForegroundColor Red
    exit 1
}

# Clone or update
if (Test-Path "$InstDir\.git") {
    Write-Host "  [1/4] Updating existing install in $InstDir ..."
    git -C $InstDir fetch origin
    git -C $InstDir checkout $Branch 2>$null
    git -C $InstDir pull --ff-only origin $Branch
} else {
    Write-Host "  [1/4] Cloning into $InstDir ..."
    git clone -b $Branch $Repo $InstDir
}

Set-Location $InstDir

# Generate .env
if (-not (Test-Path ".env")) {
    Write-Host "  [2/4] Generating secret key ..."
    $bytes  = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $secret = -join ($bytes | ForEach-Object { $_.ToString("x2") })
    @"
SECRET_KEY=$secret
PORT=$Port
ACCESS_TOKEN_EXPIRE_MINUTES=10080
"@ | Set-Content ".env" -Encoding UTF8
    Write-Host "        .env created."
} else {
    Write-Host "  [2/4] Using existing .env"
}

# Build (--no-cache ensures fresh build when source files change)
Write-Host "  [3/4] Building images (a few minutes the first time) ..."
docker compose build

# Start
Write-Host "  [4/4] Starting services ..."
docker compose up -d

Write-Host ""
Write-Host "  OK  MusicVault running at  http://localhost:$Port" -ForegroundColor Green
Write-Host ""
Write-Host "  First run: open the URL in your browser and create an account."
Write-Host ""
Write-Host "  Useful commands (cd into $InstDir first):"
Write-Host "    docker compose logs -f    # view logs"
Write-Host "    docker compose down       # stop"
Write-Host "    docker compose up -d      # restart"
Write-Host ""
