@echo off
REM Session Checkpoint Manager Launcher
REM Allows saving and resuming coding sessions across context resets

setlocal enabledelayedexpansion

if "%1"=="" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0session-manager.ps1"
    goto end
)

REM Execute PowerShell script with parameters
if "%1"=="checkpoint" (
    if "%2"=="" (
        powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0session-manager.ps1" -Action checkpoint
    ) else (
        powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0session-manager.ps1" -Action checkpoint -SessionName %2
    )
) else if "%1"=="resume" (
    if "%2"=="" (
        powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0session-manager.ps1" -Action resume
    ) else (
        powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0session-manager.ps1" -Action resume -SessionName %2
    )
) else if "%1"=="list" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0session-manager.ps1" -Action list
) else if "%1"=="status" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0session-manager.ps1" -Action status
) else if "%1"=="clean" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0session-manager.ps1" -Action clean
) else (
    echo Usage: session-manager.bat [action] [options]
    echo.
    echo Actions:
    echo   checkpoint [name] - Save current session checkpoint
    echo   resume [name]     - Resume from a checkpoint
    echo   list              - List all checkpoints
    echo   status            - Show current session status
    echo   clean             - Remove old checkpoints
)

:end
endlocal
