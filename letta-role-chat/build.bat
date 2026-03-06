@echo off
chcp 65001 >nul 2>&1
title Letta Chat - One-Click Build ^& Launch
setlocal enabledelayedexpansion

set "ROOT=%~dp0"
set "DOCKER_DIR=%ROOT%Docker"
set "WEB_DIR=%ROOT%apps\web"
set "DESKTOP_DIR=%ROOT%apps\desktop"
set "RELEASE_DIR=%DESKTOP_DIR%\release"

echo.
echo  ==========================================
echo   Letta Chat - One-Click Build ^& Launch
echo  ==========================================
echo.

:: ========================================
:: 1. Start Docker (API + Web backend)
:: ========================================
echo [1/6] Starting Docker containers...

:: Check Docker daemon is running
docker info >nul 2>&1
if !ERRORLEVEL! EQU 0 goto docker_ready

:: Docker not running, try to start it
echo       [WARN] Docker daemon not running, starting Docker Desktop...
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe" 2>nul
echo       Waiting for Docker to start...
set /a DWAIT=0

:wait_docker
docker info >nul 2>&1
if !ERRORLEVEL! EQU 0 goto docker_ready
if !DWAIT! GEQ 90 (
    echo [ERROR] Docker failed to start within 90 seconds!
    echo         Please start Docker Desktop manually and retry.
    pause
    exit /b 1
)
timeout /t 3 /nobreak >nul
set /a DWAIT+=3
goto wait_docker

:docker_ready
echo       Docker daemon is running.

:: Start/recreate containers (detached)
cd /d "%DOCKER_DIR%"
docker compose up -d 2>&1
if !ERRORLEVEL! NEQ 0 (
    echo [ERROR] Docker compose up failed!
    pause
    exit /b 1
)

:: Wait for API to be healthy
echo       Waiting for API service to be healthy...
set /a WAIT=0
:wait_api
if !WAIT! GEQ 120 (
    echo       [WARN] API health check timeout ^(120s^), continuing anyway...
    goto api_ready
)
docker inspect --format="{{.State.Health.Status}}" letta-api 2>nul | findstr /i "healthy" >nul 2>&1
if !ERRORLEVEL! EQU 0 goto api_ready
timeout /t 3 /nobreak >nul
set /a WAIT+=3
goto wait_api

:api_ready
echo [OK] Docker containers running ^(API :3001, Web :5173^)

:: ========================================
:: 2. Kill old EXE & clean artifacts
:: ========================================
echo [2/6] Cleaning previous build artifacts...

:: Kill running Letta Chat process (release file lock)
taskkill /f /im "Letta Chat.exe" >nul 2>&1

:: Wait a moment for file handles to release
timeout /t 2 /nobreak >nul

:: Clean desktop dist (old TS output)
if exist "%DESKTOP_DIR%\dist" (
    echo       Removing desktop\dist\...
    rmdir /s /q "%DESKTOP_DIR%\dist"
)

:: Clean electron-builder release & cache
if exist "%RELEASE_DIR%" (
    echo       Removing desktop\release\...
    rmdir /s /q "%RELEASE_DIR%"
)

:: Clean web dist
if exist "%WEB_DIR%\dist" (
    echo       Removing web\dist\...
    rmdir /s /q "%WEB_DIR%\dist"
)

echo [OK] Old artifacts cleaned.

:: ========================================
:: 3. Install dependencies (if needed)
:: ========================================
echo [3/6] Checking dependencies...

cd /d "%WEB_DIR%"
if not exist "node_modules" (
    echo       Installing web dependencies...
    call npm install
    if !ERRORLEVEL! NEQ 0 (
        echo [ERROR] Web npm install failed!
        pause
        exit /b 1
    )
)

cd /d "%DESKTOP_DIR%"
if not exist "node_modules" (
    echo       Installing desktop dependencies...
    call npm install
    if !ERRORLEVEL! NEQ 0 (
        echo [ERROR] Desktop npm install failed!
        pause
        exit /b 1
    )
)

echo [OK] Dependencies ready.

:: ========================================
:: 4. Build Web frontend
:: ========================================
echo [4/6] Building Web frontend ^(Vite^)...

cd /d "%WEB_DIR%"
call npm run build
if !ERRORLEVEL! NEQ 0 (
    echo [ERROR] Web build failed!
    pause
    exit /b 1
)

if not exist "%WEB_DIR%\dist\index.html" (
    echo [ERROR] Web build output missing ^(dist/index.html not found^)!
    pause
    exit /b 1
)

echo [OK] Web frontend built  -^> apps/web/dist/

:: ========================================
:: 5. Compile Desktop TypeScript & Package EXE
:: ========================================
echo [5/6] Compiling Desktop TypeScript ^& packaging EXE...

cd /d "%DESKTOP_DIR%"

call npx tsc
if !ERRORLEVEL! NEQ 0 (
    echo [ERROR] TypeScript compile failed!
    pause
    exit /b 1
)

if not exist "%DESKTOP_DIR%\dist\main.js" (
    echo [ERROR] TypeScript output missing ^(dist/main.js not found^)!
    pause
    exit /b 1
)

echo       TypeScript compiled OK, now packaging...

call npx electron-builder --win
if !ERRORLEVEL! NEQ 0 (
    echo [ERROR] electron-builder failed!
    pause
    exit /b 1
)

echo [OK] EXE packaged  -^> apps/desktop/release/

:: ========================================
:: 6. Launch the EXE
:: ========================================
echo [6/6] Launching Letta Chat...

set "EXE_FILE=%RELEASE_DIR%\win-unpacked\Letta Chat.exe"

if not exist "!EXE_FILE!" (
    echo [ERROR] EXE not found: !EXE_FILE!
    explorer "%RELEASE_DIR%"
    pause
    exit /b 1
)

echo.
echo  ==========================================
echo   Build complete!
echo.
echo   EXE : !EXE_FILE!
echo   API : http://localhost:3001
echo   Web : http://localhost:5173
echo  ==========================================
echo.
echo  Starting Letta Chat...

:: Launch EXE (detached)
start "" "!EXE_FILE!"

echo.
echo  Letta Chat is running!
echo  Press any key to close this window.
pause >nul
