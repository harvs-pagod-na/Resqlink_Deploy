@echo off
title RESQLINK BACKEND (Port 3000)
cd /d "%~dp0"
set "PATH=%~dp0..\node-v20.11.0-win-x64;%PATH%"
echo ========================================
echo   RESQLINK BACKEND (Port 3000)
echo ========================================
node src/app.js
if errorlevel 1 (
    echo.
    echo [ERROR] Backend exited with error code %errorlevel%
    pause
)
