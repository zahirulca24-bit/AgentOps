@echo off
title AgentOps Runner
echo ========================================================
echo                 Starting AgentOps Platform             
echo ========================================================
echo.

echo Launching AgentOps Backend Server (Port 3001)...
start "AgentOps Backend" cmd /k "cd /d %~dp0backend && npm run dev"

echo Launching AgentOps Frontend Application (Port 3000)...
start "AgentOps Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ========================================================
echo  Backend API:  http://127.0.0.1:3001
echo  Frontend UI:  http://localhost:3000
echo ========================================================
echo.
pause
