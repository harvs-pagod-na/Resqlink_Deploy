@echo off
title RESQLINK FRONTEND (Port 5173)
cd /d "%~dp0"
set "PATH=%~dp0..\node-v20.11.0-win-x64;%PATH%"
echo ========================================
echo   RESQLINK FRONTEND (Port 5173)
echo ========================================
call npm run dev
if errorlevel 1 (
    echo.
    echo [ERROR] Frontend exited with error code %errorlevel%
    pause
)
