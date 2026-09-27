@echo off
title RESQLINK AI SERVICE (Port 5001)
cd /d "%~dp0"
echo ========================================
echo   RESQLINK AI SERVICE (Port 5001)
echo ========================================
if exist "venv\Scripts\python.exe" (
    venv\Scripts\python.exe app.py
) else (
    echo [WARN] venv\Scripts\python.exe not found. Running with global python...
    python app.py
)
if errorlevel 1 (
    echo.
    echo [ERROR] AI Service exited with error code %errorlevel%
    pause
)
