@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo.
echo   +======================================+
echo   ^|        KYROO - Starting Up           ^|
echo   +======================================+
echo.

:: -- Check Docker --
where docker >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo   [ERROR] Docker is not installed.
    pause
    exit /b 1
)

:: -- Check Node.js --
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo   [ERROR] Node.js is not installed.
    pause
    exit /b 1
)

:: -- Load .env --
if exist .env (
    for /f "usebackq tokens=1,* delims==" %%a in (.env) do (
        set "%%a=%%b"
    )
)

:: -- Start database in Docker --
echo   [1/4] Starting database...
docker compose up -d --wait 2>nul
if %ERRORLEVEL% neq 0 (
    echo         Failed to start database. Is Docker running?
    pause
    exit /b 1
)
echo         Database ready.

:: -- Install dependencies --
echo   [2/4] Checking dependencies...
cd backend
if not exist node_modules (
    echo         Installing npm packages...
    call npm install --silent 2>nul
) else (
    echo         Dependencies OK.
)
cd ..

:: -- Kill any existing process on port 3000 --
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " 2^>nul') do (
    if not "%%a"=="0" taskkill /PID %%a /F >nul 2>nul
)

:: -- Start server and open browser --
echo   [3/4] Starting server...
echo   [4/4] Opening browser...
timeout /t 2 /nobreak >nul
start http://localhost:3000

echo.
echo   +======================================+
echo   ^|   KYROO running at localhost:3000    ^|
echo   ^|   Press Ctrl+C to stop              ^|
echo   +======================================+
echo.
echo   Database: Docker (kyroo-db)
echo   Server:   Node.js (localhost:3000)
echo.
echo   To stop everything:
echo     Ctrl+C (server)
echo     docker compose down (database)
echo.

:: Run server in foreground (keeps window alive)
node backend\server.js
