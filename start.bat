@echo off
title Empathetic AI Travel Assistant - Launcher

echo ==================================================
echo       STARTING EMPATHETIC AI TRAVEL ASSISTANT
echo ==================================================

:: --- STEP 1: CHECK FOR FFMPEG ---
echo [1/3] Checking for FFmpeg...
where ffmpeg >nul 2>nul
if %errorlevel% neq 0 (
    echo    [!] FFmpeg NOT found in system PATH.
    echo    [+] 'static-ffmpeg' will be installed automatically to handle audio.
    :: We set a variable to inject the pip install command later
    set "FFMPEG_INSTALL_CMD=pip install static-ffmpeg &&"
) else (
    echo    [OK] FFmpeg found in system! 
    echo    [-] Skipping 'static-ffmpeg' installation.
    set "FFMPEG_INSTALL_CMD="
)

:: --- STEP 2: START BACKEND ---
echo [2/3] Launching Backend Server...
:: Command explanation:
:: 1. Enter backend folder
:: 2. Create venv (if missing)
:: 3. Activate venv
:: 4. Install requirements
:: 5. (Conditional) Install static-ffmpeg if needed
:: 6. Run the app
start "BACKEND - Python Flask" cmd /k "cd backend && python -m venv venv && call venv\Scripts\activate && pip install -r requirements.txt && %FFMPEG_INSTALL_CMD% python app.py"

:: --- STEP 3: START FRONTEND ---
echo [3/3] Launching Frontend...
:: Command explanation:
:: 1. Enter frontend folder
:: 2. Install dependencies (if missing)
:: 3. Run development server
start "FRONTEND - React Vite" cmd /k "cd frontend && npm install && npm run dev"

echo.
echo ==================================================
echo    DONE! Two terminal windows have been opened.
echo    Please do not close them while using the app.
echo ==================================================
echo.
pause