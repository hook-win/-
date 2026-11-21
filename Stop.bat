@echo off
echo Stopping Qinghe local server and desktop pet...
taskkill /f /fi "WINDOWTITLE eq Qinghe Local Server*" >nul 2>nul
taskkill /f /im QinghePet.exe >nul 2>nul
echo Done. You can close the browser tab now.
timeout /t 3 >nul
exit /b 0
