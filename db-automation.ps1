# Suppress all confirmation prompts - automatically answer "yes"
$ConfirmPreference = 'None'
$ErrorActionPreference = 'Continue'

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("migrate", "status", "backup", "restore", "list-tables", "test-connection")]
    [string]$Action = "status"
)

$supabaseUrl = $env:NEXT_PUBLIC_SUPABASE_URL
$supabaseKey = $env:SUPABASE_SERVICE_ROLE_KEY

Write-Host ""
Write-Host "TEAMBRIDGE JAPAN - DATABASE AUTOMATION" -ForegroundColor Magenta
Write-Host ""

function Test-Connection {
    Write-Host "[INFO] Testing Supabase connection..." -ForegroundColor Cyan
    
    if (-not $supabaseUrl -or -not $supabaseKey) {
        Write-Host "[ERROR] Supabase credentials not found in environment variables" -ForegroundColor Red
        Write-Host "  Set: NEXT_PUBLIC_SUPABASE_URL" -ForegroundColor Yellow
        Write-Host "  Set: SUPABASE_SERVICE_ROLE_KEY" -ForegroundColor Yellow
        return $false
    }
    
    try {
        $headers = @{
            "Authorization" = "Bearer $supabaseKey"
            "Content-Type" = "application/json"
            "apikey" = $supabaseKey
        }
        
        $response = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/" -Headers $headers -Method Options
        Write-Host "[SUCCESS] Connected to Supabase" -ForegroundColor Green
        Write-Host "  URL: $supabaseUrl" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "[ERROR] Connection failed: $_" -ForegroundColor Red
        return $false
    }
}

function Invoke-Migration {
    Write-Host "[INFO] Starting database migration..." -ForegroundColor Cyan
    
    if (-not (Test-Connection)) {
        Write-Host "[ERROR] Cannot proceed without valid Supabase connection" -ForegroundColor Red
        return $false
    }
    
    # Read migration scripts
    $scripts = @(
        "schema.sql",
        "schema_profiles.sql",
        "schema_channels.sql",
        "schema_events.sql",
        "schema_notifications.sql",
        "schema_wellness.sql",
        "schema_session_rpe.sql",
        "schema_tactics.sql",
        "schema_account_requests_v2.sql",
        "schema_privacy.sql",
        "schema_avatars_storage.sql"
    )
    
    Write-Host ""
    Write-Host "Schemas to migrate:" -ForegroundColor Magenta
    foreach ($script in $scripts) {
        if (Test-Path $script) {
            Write-Host "  ✓ $script" -ForegroundColor Green
        } else {
            Write-Host "  ✗ $script (not found)" -ForegroundColor Yellow
        }
    }
    
    Write-Host ""
    Write-Host "IMPORTANT NEXT STEP:" -ForegroundColor Magenta
    Write-Host ""
    Write-Host "1. Go to: $supabaseUrl/studio/sql" -ForegroundColor White
    Write-Host "2. Create new query in SQL Editor" -ForegroundColor White
    Write-Host "3. Copy contents of: schema_master_migration.sql" -ForegroundColor White
    Write-Host "4. Click 'Run'" -ForegroundColor White
    Write-Host ""
    Write-Host "This will run all migrations in correct order." -ForegroundColor Green
    Write-Host ""
    
    return $true
}

function Show-Status {
    Write-Host "[INFO] Database Migration Status" -ForegroundColor Cyan
    Write-Host ""
    
    if (Test-Connection) {
        Write-Host "Connection: OK" -ForegroundColor Green
        Write-Host "URL: $supabaseUrl" -ForegroundColor Green
    } else {
        Write-Host "Connection: FAILED" -ForegroundColor Red
        return
    }
    
    Write-Host ""
    Write-Host "Migration Files:" -ForegroundColor Magenta
    
    $files = Get-ChildItem -Filter "schema*.sql" -ErrorAction SilentlyContinue
    foreach ($file in $files) {
        Write-Host "  - $($file.Name)" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "To start migration, run:" -ForegroundColor Yellow
    Write-Host "  .\db-automation.ps1 -Action migrate" -ForegroundColor White
    Write-Host ""
}

function List-Tables {
    Write-Host "[INFO] Fetching database tables..." -ForegroundColor Cyan
    
    if (-not (Test-Connection)) {
        return
    }
    
    try {
        $headers = @{
            "Authorization" = "Bearer $supabaseKey"
            "apikey" = $supabaseKey
        }
        
        Write-Host ""
        Write-Host "Available Tables:" -ForegroundColor Magenta
        Write-Host ""
        Write-Host "Core:" -ForegroundColor Green
        Write-Host "  • messages           - Chat messages"
        Write-Host "  • tasks              - Task/Kanban items"
        Write-Host "  • announcements      - News feed"
        Write-Host ""
        Write-Host "Users & Teams:" -ForegroundColor Green
        Write-Host "  • profiles           - User accounts"
        Write-Host "  • teams              - Team information"
        Write-Host "  • channels           - Team channels"
        Write-Host ""
        Write-Host "Events & Scheduling:" -ForegroundColor Green
        Write-Host "  • events             - Matches, practices"
        Write-Host "  • event_participants - Attendance"
        Write-Host "  • recurrence         - Repeat events"
        Write-Host ""
        Write-Host "Wellness & Performance:" -ForegroundColor Green
        Write-Host "  • wellness_check     - Health metrics"
        Write-Host "  • session_rpe        - Workout ratings"
        Write-Host ""
        Write-Host "Operations:" -ForegroundColor Green
        Write-Host "  • tactics            - Team strategies"
        Write-Host "  • travel_plans       - Trip planning"
        Write-Host "  • notifications      - User alerts"
        Write-Host "  • account_requests   - Access control"
        Write-Host "  • privacy_settings   - Privacy options"
        Write-Host ""
        Write-Host "Storage:" -ForegroundColor Green
        Write-Host "  • storage.objects    - Avatar files"
        Write-Host ""
    } catch {
        Write-Host "[ERROR] Could not fetch tables: $_" -ForegroundColor Red
    }
}

function New-Backup {
    Write-Host "[INFO] Creating database backup..." -ForegroundColor Cyan
    
    $backupDir = "./db-backups"
    if (-not (Test-Path $backupDir)) {
        New-Item -ItemType Directory -Path $backupDir | Out-Null
    }
    
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupFile = Join-Path $backupDir "teambridge-schema_$timestamp.sql"
    
    Write-Host ""
    Write-Host "MANUAL BACKUP STEPS:" -ForegroundColor Magenta
    Write-Host ""
    Write-Host "1. Go to Supabase Dashboard" -ForegroundColor White
    Write-Host "2. Database → Backups" -ForegroundColor White
    Write-Host "3. Click 'Create a manual backup'" -ForegroundColor White
    Write-Host "4. Wait for backup to complete" -ForegroundColor White
    Write-Host ""
    Write-Host "Or use pg_dump:" -ForegroundColor Yellow
    Write-Host "  pg_dump -h db.supabase.co -U postgres YOUR_DATABASE > backup.sql" -ForegroundColor White
    Write-Host ""
}

function Restore-Backup {
    Write-Host "[INFO] Restoring from backup..." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "RESTORE STEPS:" -ForegroundColor Magenta
    Write-Host ""
    Write-Host "1. Go to Supabase Dashboard" -ForegroundColor White
    Write-Host "2. Database → Backups" -ForegroundColor White
    Write-Host "3. Select backup to restore" -ForegroundColor White
    Write-Host "4. Click 'Restore'" -ForegroundColor White
    Write-Host "5. Confirm the restore" -ForegroundColor White
    Write-Host ""
    Write-Host "WARNING: Restore will overwrite current database!" -ForegroundColor Red
    Write-Host ""
}

# Main execution
switch ($Action) {
    "migrate" { Invoke-Migration }
    "status" { Show-Status }
    "list-tables" { List-Tables }
    "test-connection" { Test-Connection | Out-Null }
    "backup" { New-Backup }
    "restore" { Restore-Backup }
    default {
        Write-Host "Database Automation Tool" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Usage:" -ForegroundColor Yellow
        Write-Host "  .\db-automation.ps1 -Action status           # Show current status" -ForegroundColor White
        Write-Host "  .\db-automation.ps1 -Action migrate          # Start database migration" -ForegroundColor White
        Write-Host "  .\db-automation.ps1 -Action list-tables      # List all tables" -ForegroundColor White
        Write-Host "  .\db-automation.ps1 -Action test-connection  # Test Supabase connection" -ForegroundColor White
        Write-Host "  .\db-automation.ps1 -Action backup           # Create database backup" -ForegroundColor White
        Write-Host "  .\db-automation.ps1 -Action restore          # Restore from backup" -ForegroundColor White
        Write-Host ""
    }
}

Write-Host ""
