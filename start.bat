@echo off
rem Starts a local web server (needed so YouTube / Twitch embeds and login hashing work) and opens the site.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" -Port 8080
pause
