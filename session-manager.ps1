# Suppress all confirmation prompts - automatically answer "yes"
$ConfirmPreference = 'None'
$ErrorActionPreference = 'Continue'

param([string]$Action = "checkpoint", [string]$SessionName = "")

$checkpointDir = ".session-checkpoints"

if (-not (Test-Path $checkpointDir)) { mkdir $checkpointDir }

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"

if ($Action -eq "checkpoint") {
    $name = if ($SessionName) { "$SessionName`_$timestamp" } else { "checkpoint_$timestamp" }
    $path = "$checkpointDir\$name"
    mkdir $path
    
    Write-Host "[SUCCESS] Checkpoint created: $name" -ForegroundColor Green
    Write-Host "[INFO] Location: $path" -ForegroundColor Cyan
    
    $info = @"
SESSION CHECKPOINT: $name
Created: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Working Dir: $(Get-Location)

## What You Were Working On
- Add your notes here

## Next Steps
- Resume coding from this point
"@
    
    Set-Content "$path\NOTES.txt" $info
    Write-Host "[INFO] Edit notes: $path\NOTES.txt" -ForegroundColor Cyan
}
elseif ($Action -eq "resume") {
    if ($SessionName) {
        $path = "$checkpointDir\$SessionName"
        if (Test-Path $path) {
            Write-Host "[INFO] Resuming from checkpoint: $SessionName" -ForegroundColor Cyan
            Write-Host ""
            Get-Content "$path\NOTES.txt" | Write-Host
            Write-Host ""
            Write-Host "[INFO] Ready to continue coding! Run: npm run dev" -ForegroundColor Green
        } else {
            Write-Host "[ERROR] Checkpoint not found: $SessionName" -ForegroundColor Red
        }
    } else {
        Write-Host "[INFO] Available checkpoints:" -ForegroundColor Cyan
        Get-ChildItem $checkpointDir | Where-Object { $_.PSIsContainer } | ForEach-Object { Write-Host "  - $($_.Name)" }
    }
}
elseif ($Action -eq "list") {
    Write-Host ""
    Write-Host "Available Checkpoints:" -ForegroundColor Magenta
    if (Test-Path $checkpointDir) {
        $checkpoints = @(Get-ChildItem $checkpointDir | Where-Object { $_.PSIsContainer } | Sort-Object CreationTime -Descending)
        if ($checkpoints.Count -eq 0) {
            Write-Host "  (none)" -ForegroundColor Yellow
        } else {
            for ($i = 0; $i -lt $checkpoints.Count; $i++) {
                Write-Host "  $($i+1). $($checkpoints[$i].Name)" -ForegroundColor Green
            }
        }
    }
    Write-Host ""
}
elseif ($Action -eq "status") {
    Write-Host ""
    Write-Host "Checkpoint Status:" -ForegroundColor Magenta
    Write-Host "  Current Dir: $(Get-Location)" -ForegroundColor Green
    if (Test-Path $checkpointDir) {
        $count = @(Get-ChildItem $checkpointDir | Where-Object { $_.PSIsContainer }).Count
        Write-Host "  Total Checkpoints: $count" -ForegroundColor Green
    } else {
        Write-Host "  Total Checkpoints: 0" -ForegroundColor Green
    }
    Write-Host ""
}
else {
    Write-Host ""
    Write-Host "Session Checkpoint Manager" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage:" -ForegroundColor Yellow
    Write-Host "  .\session-manager.ps1 -Action checkpoint [-SessionName 'name']" -White
    Write-Host "  .\session-manager.ps1 -Action resume [-SessionName 'checkpoint_name']" -White
    Write-Host "  .\session-manager.ps1 -Action list" -White
    Write-Host "  .\session-manager.ps1 -Action status" -White
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Yellow
    Write-Host "  .\session-manager.ps1 -Action checkpoint -SessionName 'auth-feature'" -White
    Write-Host "  .\session-manager.ps1 -Action list" -White
    Write-Host "  .\session-manager.ps1 -Action resume -SessionName 'checkpoint_20260505_113050'" -White
    Write-Host ""
}
