@echo off
cd /d "%~dp0"
start "" http://127.0.0.1:8099/
node serve.js
pause
