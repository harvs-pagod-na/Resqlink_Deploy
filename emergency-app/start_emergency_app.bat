@echo off
title RESQLINK Emergency Server (Port 4000)
cd /d "%~dp0"
echo ====================================================
echo   STARTING RESQLINK EMERGENCY APP (PORT 4000)
echo ====================================================
if exist "%~dp0..\Resqlink\node-v20.11.0-win-x64" set "PATH=%~dp0..\Resqlink\node-v20.11.0-win-x64;%PATH%"
if exist "%~dp0..\Resqlink_start\node-v20.11.0-win-x64" set "PATH=%~dp0..\Resqlink_start\node-v20.11.0-win-x64;%PATH%"
node server.js
if errorlevel 1 (
    echo.
    echo [ERROR] Emergency app exited with error code %errorlevel%
    pause
)
