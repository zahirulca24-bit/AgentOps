@echo off
title AgentOps Installer
echo ========================================================
echo             Installing AgentOps Dependencies            
echo ========================================================
echo.

echo Installing Backend Dependencies...
cd /d %~dp0backend
call npm install

echo.
echo Installing Frontend Dependencies...
cd /d %~dp0frontend
call npm install

echo.
echo ========================================================
echo  Dependencies successfully installed!
echo  Run start.bat to launch backend and frontend servers.
echo ========================================================
echo.
pause
