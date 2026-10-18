@echo off
title Document Verification Portal & Admin CMS
cd /d "%~dp0"
echo =======================================================
echo   Starting Document Verification Portal & CMS Server
echo =======================================================
echo.
echo Checking Node.js installation...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found on your system PATH!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo Starting server on http://localhost:3000 ...
echo.
echo Public Portal:  http://localhost:3000/
echo Admin CMS:      http://localhost:3000/admin/
echo Default Login:  admin / admin123
echo.
echo Press Ctrl+C to stop the server at any time.
echo =======================================================
node server.js
pause
