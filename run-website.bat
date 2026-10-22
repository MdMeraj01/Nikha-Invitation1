@echo off
cd /d "%~dp0"
echo Starting Nikha Invitation website...
echo Keep this window open while using the website.
start "Nikha Invitation" http://localhost:8000
py -m http.server 8000
if errorlevel 1 python -m http.server 8000
pause
