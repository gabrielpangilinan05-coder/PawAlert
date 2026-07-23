@echo off
cd /d "%~dp0"
echo Building PawAlert (production)...
call npm run build
if errorlevel 1 (
  echo Build failed.
  pause
  exit /b 1
)
echo.
echo Starting at http://localhost:3000
echo This mode is MUCH faster than npm run dev (no Compiling...).
echo.
call npm start
