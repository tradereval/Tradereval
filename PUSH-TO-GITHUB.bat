@echo off
echo.
echo  ============================================
echo   Push complete TraderEval site to GitHub
echo  ============================================
echo.

set "GIT=C:\Program Files\Git\cmd\git.exe"
set "GH=C:\Program Files\GitHub CLI\gh.exe"

cd /d "%~dp0"

if not exist "%GH%" (
  echo GitHub CLI not found. Install from https://cli.github.com/
  pause
  exit /b 1
)

echo Step 1: Log in to GitHub (browser will open)...
echo         Choose: GitHub.com - HTTPS - Login with browser
echo.
"%GH%" auth status >nul 2>&1
if errorlevel 1 (
  "%GH%" auth login -h github.com -p https -w
)

echo.
echo Step 2: Uploading all files to github.com/tradereval/Tradereval ...
echo.

"%GIT%" add -A
"%GIT%" commit -m "Complete site upload" 2>nul
"%GIT%" branch -M main
"%GIT%" remote remove origin 2>nul
"%GIT%" remote add origin https://github.com/tradereval/Tradereval.git

"%GH%" auth setup-git
"%GIT%" pull origin main --allow-unrelated-histories -X ours --no-edit 2>nul
"%GIT%" push -u origin main

if errorlevel 1 (
  echo.
  echo Push failed. Try again or ask for help in Cursor chat.
  pause
  exit /b 1
)

echo.
echo SUCCESS! GitHub updated with css, js, and api folders.
echo.
echo Next: Vercel will redeploy in ~1 minute automatically.
echo       Open your Vercel link to test.
echo.
pause
