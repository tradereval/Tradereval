@echo off
echo.
echo  TraderEval - Starting local preview...
echo.
cd /d "%~dp0"

where node >nul 2>&1
if %errorlevel%==0 (
  node server.js
  goto :end
)

set NODE="c:\Users\fundb\AppData\Local\Programs\cursor\resources\app\resources\helpers\node.exe"
if exist %NODE% (
  %NODE% server.js
  goto :end
)

echo Could not find Node.js.
echo Install from https://nodejs.org/ then double-click this file again.
pause

:end
