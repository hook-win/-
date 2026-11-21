@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Yuechi LifeFee Portable

echo ==========================================
echo   Yuechi LifeFee Manager v2.1 - Portable
echo ==========================================
echo.

if exist "%~dp0QinghePet.exe" (
  start "" "%~dp0QinghePet.exe"
) else (
  echo [warn] QinghePet.exe not found. Web version still works.
)

set "NODE=%~dp0node.exe"
if not exist "%NODE%" (
  where node >nul 2>nul
  if errorlevel 1 (
    echo [error] node.exe not found. Package may be incomplete.
    pause
    exit /b 1
  )
  set "NODE=node"
)

set "PORT=3000"
netstat -ano | findstr /C:":3000 " | findstr /C:"LISTENING" >nul 2>nul
if not errorlevel 1 (
  echo [warn] port 3000 is in use; using 3001.
  set "PORT=3001"
)

echo Starting local server on port %PORT% ...
start "Qinghe Local Server" /D "%~dp0website" "%NODE%" "%~dp0website\simulator\server.js"

timeout /t 3 >nul
start "" "http://localhost:%PORT%"

echo.
echo URL        : http://localhost:%PORT%
echo Desktop pet: bottom-right corner
echo Stop       : close the "Qinghe Local Server" window or run Stop.bat
echo.
echo This window closes in 5 seconds.
timeout /t 5 >nul
exit /b 0
