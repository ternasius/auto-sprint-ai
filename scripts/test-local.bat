@echo off
REM Auto Sprint AI - Local Testing Script (Windows)
REM This script helps set up and run local testing with forge tunnel

setlocal enabledelayedexpansion

echo ==================================
echo Auto Sprint AI - Local Testing
echo ==================================
echo.

REM Step 1: Check prerequisites
echo Step 1: Checking prerequisites...
echo.

where forge >nul 2>&1
if %errorlevel% neq 0 (
    echo [X] Forge CLI not found. Install with: npm install -g @forge/cli
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('forge --version') do set FORGE_VERSION=%%i
    echo [OK] Forge CLI installed: !FORGE_VERSION!
)

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [X] Node.js not found. Please install Node.js ^>= 18.0.0
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo [OK] Node.js installed: !NODE_VERSION!
)

where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [X] npm not found. Please install npm
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
    echo [OK] npm installed: !NPM_VERSION!
)

echo.

REM Step 2: Check if logged in to Forge
echo Step 2: Checking Forge authentication...
echo.

forge whoami >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Not logged in to Forge
    echo Please run: forge login
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('forge whoami') do set FORGE_USER=%%i
    echo [OK] Logged in as: !FORGE_USER!
)

echo.

REM Step 3: Install dependencies
echo Step 3: Installing dependencies...
echo.

if not exist "package.json" (
    echo [X] package.json not found. Are you in the correct directory?
    exit /b 1
)

call npm install
if %errorlevel% neq 0 (
    echo [X] Failed to install dependencies
    exit /b 1
)
echo [OK] Dependencies installed

echo.

REM Step 4: Build the project
echo Step 4: Building the project...
echo.

call npm run build
if %errorlevel% neq 0 (
    echo [X] Build failed. Please check for errors above.
    exit /b 1
)
echo [OK] Build successful

echo.

REM Step 5: Check if app is registered
echo Step 5: Checking app registration...
echo.

if not exist "manifest.yml" (
    echo [X] manifest.yml not found
    exit /b 1
)

findstr /C:"app:" manifest.yml >nul
if %errorlevel% equ 0 (
    echo [OK] App is registered
) else (
    echo [!] App may not be registered. Run: forge register
)

echo.

REM Step 6: Prompt for deployment
echo Step 6: Deployment check...
echo.

set /p DEPLOYED="Have you deployed the app at least once? (y/n): "

if /i not "!DEPLOYED!"=="y" (
    echo [!] You need to deploy at least once before using tunnel
    echo Run: forge deploy
    echo.
    set /p DEPLOY_NOW="Deploy now? (y/n): "
    
    if /i "!DEPLOY_NOW!"=="y" (
        call forge deploy
        if %errorlevel% neq 0 (
            echo [X] Deployment failed
            exit /b 1
        )
        echo [OK] Deployment complete
    ) else (
        echo Please deploy manually and run this script again
        exit /b 0
    )
)

echo.

REM Step 7: Prompt for installation
echo Step 7: Installation check...
echo.

set /p INSTALLED="Have you installed the app in a test Jira site? (y/n): "

if /i not "!INSTALLED!"=="y" (
    echo [!] You need to install the app in a Jira site
    echo Run: forge install
    echo.
    set /p INSTALL_NOW="Install now? (y/n): "
    
    if /i "!INSTALL_NOW!"=="y" (
        call forge install
        if %errorlevel% neq 0 (
            echo [X] Installation failed
            exit /b 1
        )
        echo [OK] Installation complete
    ) else (
        echo Please install manually and run this script again
        exit /b 0
    )
)

echo.

REM Step 8: Display testing information
echo ==================================
echo Ready to Start Testing!
echo ==================================
echo.
echo Testing Resources:
echo   - Testing Guide: TESTING_GUIDE.md
echo   - Test Checklist: TEST_CHECKLIST.md
echo.
echo What to test:
echo   1. Sprint Analysis Panel (Jira Project Page)
echo   2. Issue Panel (Sprint View)
echo   3. Confluence Macro (if available)
echo   4. Data collection from Jira and Bitbucket
echo   5. Various sprint sizes and states
echo   6. Error handling and edge cases
echo.
echo Monitoring:
echo   - Watch the tunnel logs for API calls and errors
echo   - Check browser console for client-side errors
echo   - Use the test checklist to track progress
echo.

REM Step 9: Start forge tunnel
echo ==================================
echo Starting Forge Tunnel...
echo ==================================
echo.
echo [!] Keep this terminal open while testing
echo [!] Press Ctrl+C to stop the tunnel
echo.
echo Tunnel will start in 3 seconds...
timeout /t 3 /nobreak >nul

forge tunnel
