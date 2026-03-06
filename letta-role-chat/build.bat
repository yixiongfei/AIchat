@echo off
title Letta Chat - Build EXE

echo.
echo  ==========================================
echo   Letta Chat - Build Windows EXE
echo  ==========================================
echo.

:: ========================================
:: 1. Build Web frontend
:: ========================================
echo [1/3] Building Web frontend...

cd /d "%~dp0apps\web"

if not exist "node_modules" (
    echo       Installing web dependencies...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Web npm install failed!
        pause
        exit /b 1
    )
)

call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Web build failed!
    pause
    exit /b 1
)

echo [OK] Web frontend built  -^> apps/web/dist/

:: ========================================
:: 2. Compile Desktop TypeScript
:: ========================================
echo [2/3] Compiling Desktop TypeScript...

cd /d "%~dp0apps\desktop"

if not exist "node_modules" (
    echo       Installing desktop dependencies...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Desktop npm install failed!
        pause
        exit /b 1
    )
)

call npx tsc
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] TypeScript compile failed!
    pause
    exit /b 1
)

echo [OK] TypeScript compiled  -^> apps/desktop/dist/

:: ========================================
:: 3. Package with electron-builder
:: ========================================
echo [3/3] Packaging EXE with electron-builder...

call npx electron-builder --win
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] electron-builder failed!
    pause
    exit /b 1
)

echo.
echo  ==========================================
echo   Build complete!
echo.
echo   Output: apps\desktop\release\
echo.
echo   Files:
dir /b "%~dp0apps\desktop\release\*.exe" 2>nul
echo  ==========================================
echo.

:: Open output folder
explorer "%~dp0apps\desktop\release"

pause
