@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo.
echo   +======================================+
echo   ^|     KYROO MOBILE - Starting Up       ^|
echo   +======================================+
echo.

:: -- Check Node.js --
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo   [ERROR] Node.js is not installed.
    pause
    exit /b 1
)

:: -- Check npm --
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo   [ERROR] npm is not installed.
    pause
    exit /b 1
)

:: -- Install dependencies --
echo   [1/2] Checking dependencies...
cd mobile
if not exist node_modules (
    echo         Installing npm packages...
    call npm install --legacy-peer-deps --silent 2>nul
    echo         Done.
) else (
    echo         Dependencies OK.
)

:: -- Kill any existing Expo process on port 8081 --
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8081 " 2^>nul') do (
    if not "%%a"=="0" taskkill /PID %%a /F >nul 2>nul
)

echo   [2/2] Starting Expo...
echo.
echo   +======================================+
echo   ^|  KYROO MOBILE running on Expo        ^|
echo   ^|  Web:    http://localhost:8081        ^|
echo   ^|  Mobile: scan QR with Expo Go        ^|
echo   ^|  Press Ctrl+C to stop               ^|
echo   +======================================+
echo.
echo   Expo will open the browser automatically once the bundle is ready.
echo   Android:  npm run android (requires Android Studio)
echo   iOS:      npm run ios     (requires macOS + Xcode)
echo.

:: Expo --web opens the browser itself when the bundle is ready — no manual start needed
call npx expo start --web --clear
