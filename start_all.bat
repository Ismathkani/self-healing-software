@echo off
echo ========================================================
echo Starting Self-Healing Software All-in-One Portal...
echo ========================================================
start "Backend Service (Port 3001)" cmd /k "cd /d %~dp0backend && node src/app.js"
start "AI Service (Port 5000)" cmd /k "cd /d %~dp0ai_service && .\.venv\Scripts\python.exe -m uvicorn app:app --host 0.0.0.0 --port 5000"
start "Demo Target Site (Port 4000)" cmd /k "cd /d %~dp0 && node scripts/demo_host.js"
start "Frontend Dashboard (Port 5173)" cmd /k "cd /d %~dp0frontend && npm run dev"
echo.
echo All 4 services launched in background windows!
echo Access your portal anytime at: http://localhost:5173
echo ========================================================
