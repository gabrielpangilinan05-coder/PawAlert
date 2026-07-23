@echo off
title PawAlert Cloudflare tunnel
cd /d "%~dp0"

echo.
echo  ========================================
echo   PawAlert - Public tunnel (Cloudflare)
echo  ========================================
echo.
echo  Shares Facebook / phones a public URL.
echo  Keep this tunnel window OPEN while sharing.
echo.
echo  Make sure the app is running first:
echo    npm run fast   OR   npm run dev
echo  (http://localhost:3000)
echo.

where cloudflared >nul 2>&1
if errorlevel 1 (
  echo  cloudflared not found. Trying winget install...
  winget install --id Cloudflare.cloudflared -e --accept-package-agreements --accept-source-agreements
  where cloudflared >nul 2>&1
  if errorlevel 1 (
    echo.
    echo  ERROR: cloudflared still not in PATH.
    echo  Download: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
    echo.
    pause
    exit /b 1
  )
)

if not exist "%~dp0storage" mkdir "%~dp0storage"
echo. > "%~dp0storage\cloudflare-tunnel.log"

echo  Starting cloudflared -^> http://127.0.0.1:3000 ...
start "PawAlert Cloudflare" cmd /c "cloudflared tunnel --url http://127.0.0.1:3000 1>> \"%~dp0storage\cloudflare-tunnel.log\" 2>&1"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync-public-url.ps1"
if errorlevel 1 (
  echo.
  pause
  exit /b 1
)

echo  Keep the "PawAlert Cloudflare" window open.
echo  Restart npm (dev/fast) if it was already running, then Share again.
echo.
pause
