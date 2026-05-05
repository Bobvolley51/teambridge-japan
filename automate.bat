@echo off
REM Teambridge Japan - PowerShell Automation Launcher
REM This batch file runs the PowerShell automation script

setlocal enabledelayedexpansion

if "%1"=="" (
    echo.
    echo Teambridge Japan Automation Tool
    echo ==================================
    echo.
    echo Usage: automate.bat [task] [options]
    echo.
    echo Available Tasks:
    echo   setup           - Initialize development environment
    echo   dev             - Start development server
    echo   build           - Build project for production
    echo   database-migrate - Run database migrations
    echo   backup          - Create project backup
    echo   clean           - Remove build artifacts
    echo   full-setup      - Complete setup and build
    echo.
    echo Examples:
    echo   automate.bat setup
    echo   automate.bat dev
    echo   automate.bat build
    echo.
    goto end
)

REM Execute PowerShell script with parameters
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0automate.ps1" -Task %1 %2 %3 %4 %5

:end
endlocal
