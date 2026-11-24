@echo off
title AIOTA Smart Home Servers
echo ========================================================
echo       AIOTA SMART HOME - SYSTEM SERVERS
echo ========================================================
echo Starting Backend (FastAPI on Port 8000)...
start "AIOTA Backend" /min cmd /c "cd /d "%~dp0backend" && .venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000"

echo Starting Frontend (Vite on Port 5173)...
start "AIOTA Frontend" /min cmd /c "cd /d "%~dp0frontend" && "C:\Users\Asus\.nodejs\node-v22.12.0-win-x64\npm.cmd" run dev -- --host 0.0.0.0"

echo.
echo Servers are running in the background!
echo Local Link:   http://localhost:5173/
echo Mobile Link:  http://192.168.1.10:5173/
echo Backend API:  http://192.168.1.10:8000/
echo ========================================================
echo Keep this window open or minimize it.
pause
