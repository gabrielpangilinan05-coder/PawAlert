@echo off
title PawAlert ngrok tunnel
cd /d "%~dp0"

echo.
echo  ========================================
echo   PawAlert - Public tunnel (ngrok)
echo  ========================================
echo.
echo  1. Make sure Apache is running in XAMPP.
echo  2. Keep the ngrok window OPEN while testing.
echo  3. This script auto-updates config\public.php
echo.

where ngrok >nul 2>&1
if errorlevel 1 (
  echo  ERROR: ngrok is not in PATH.
  echo  Install from https://ngrok.com/download or use:
  echo    winget install ngrok.ngrok
  echo.
  pause
  exit /b 1
)

REM If ngrok already running, just sync the URL
curl -s http://127.0.0.1:4040/api/tunnels >nul 2>&1
if not errorlevel 1 (
  echo  ngrok already running — syncing PUBLIC_BASE_URL...
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync-ngrok-url.ps1"
  echo  Done. Phone URL is above.
  echo.
  pause
  exit /b 0
)

echo  Starting ngrok on port 80...
start "PawAlert ngrok" ngrok http 80

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync-ngrok-url.ps1"
if errorlevel 1 (
  echo.
  pause
  exit /b 1
)

echo  Keep the "PawAlert ngrok" window open.
echo.
pause
