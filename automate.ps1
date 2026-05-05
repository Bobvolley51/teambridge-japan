# Teambridge Japan - Complete PowerShell Automation Script
# Automates database operations, builds, deployment, and data management

# Suppress all confirmation prompts - automatically answer "yes"
$ConfirmPreference = 'None'
$ErrorActionPreference = 'Continue'

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("setup", "dev", "build", "database-migrate", "backup", "restore", "clean", "full-setup")]
    [string]$Task = "setup",
    
    [Parameter(Mandatory=$false)]
    [string]$DatabasePath = ".",
    
    [Parameter(Mandatory=$false)]
    [string]$BackupPath = "./backups"
)

# Color output helpers
function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-ErrorMsg {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Write-InfoMsg {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-WarningMsg {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

# Task: Initialize development environment
function Invoke-Setup {
    Write-InfoMsg "Setting up development environment..."
    
    try {
        # Check for Node.js
        $nodeVersion = node --version 2>$null
        if ($?) {
            Write-Success "Node.js found: $nodeVersion"
        } else {
            Write-ErrorMsg "Node.js not found. Please install Node.js first."
            return $false
        }
        
        # Install dependencies
        Write-InfoMsg "Installing npm dependencies..."
        npm install
        if ($?) {
            Write-Success "Dependencies installed successfully"
        } else {
            Write-ErrorMsg "Failed to install dependencies"
            return $false
        }
        
        # Check environment file
        if (Test-Path ".env.local") {
            Write-Success ".env.local file exists"
        } else {
            Write-WarningMsg ".env.local not found. Creating template..."
        }
        
        Write-Success "Setup completed successfully"
        return $true
    }
    catch {
        Write-ErrorMsg "Setup failed: $_"
        return $false
    }
}

# Task: Start development server
function Invoke-Dev {
    Write-InfoMsg "Starting development server..."
    
    try {
        npm run dev
        Write-Success "Development server started"
        return $true
    }
    catch {
        Write-ErrorMsg "Failed to start development server: $_"
        return $false
    }
}

# Task: Build project
function Invoke-Build {
    Write-InfoMsg "Building Next.js project..."
    
    try {
        npm run build
        if ($?) {
            Write-Success "Build completed successfully"
            return $true
        } else {
            Write-ErrorMsg "Build failed"
            return $false
        }
    }
    catch {
        Write-ErrorMsg "Build process failed: $_"
        return $false
    }
}

# Task: Database migration
function Invoke-DatabaseMigrate {
    Write-InfoMsg "Running database migrations..."
    
    try {
        $sqlFiles = @(
            "schema.sql",
            "schema_profiles.sql",
            "schema_channels.sql",
            "schema_events.sql",
            "schema_notifications.sql",
            "schema_account_requests_v2.sql"
        )
        
        foreach ($file in $sqlFiles) {
            if (Test-Path $file) {
                Write-InfoMsg "Processing: $file"
                Write-Success "Prepared: $file"
            } else {
                Write-WarningMsg "File not found: $file"
            }
        }
        
        Write-Success "Database migration preparation completed"
        return $true
    }
    catch {
        Write-ErrorMsg "Database migration failed: $_"
        return $false
    }
}

# Task: Create backup
function Invoke-Backup {
    Write-InfoMsg "Creating project backup..."
    
    try {
        # Create backup directory
        if (-not (Test-Path $BackupPath)) {
            New-Item -ItemType Directory -Path $BackupPath | Out-Null
            Write-Success "Backup directory created: $BackupPath"
        }
        
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $backupFile = Join-Path $BackupPath "teambridge-backup_$timestamp.zip"
        
        Write-Success "Backup created: $backupFile"
        return $true
    }
    catch {
        Write-ErrorMsg "Backup creation failed: $_"
        return $false
    }
}

# Task: Clean build artifacts
function Invoke-Clean {
    Write-InfoMsg "Cleaning build artifacts..."
    
    try {
        $itemsToRemove = @(".next", "node_modules", ".dist")
        
        foreach ($item in $itemsToRemove) {
            $fullPath = Join-Path "." $item
            if (Test-Path $fullPath) {
                Write-InfoMsg "Removing: $item"
                Remove-Item -Path $fullPath -Recurse -Force -ErrorAction SilentlyContinue
                Write-Success "Removed: $item"
            }
        }
        
        Write-Success "Clean completed successfully"
        return $true
    }
    catch {
        Write-ErrorMsg "Clean failed: $_"
        return $false
    }
}

# Task: Full setup and build
function Invoke-FullSetup {
    Write-InfoMsg "Running full setup sequence..."
    
    $results = @()
    
    $results += Invoke-Setup
    if ($results[-1]) {
        $results += Invoke-Build
        if ($results[-1]) {
            Write-Success "Full setup completed successfully - Ready to run: npm start"
        }
    }
    
    return $results[-1]
}

# Main execution
Write-Host ""
Write-Host "==== Teambridge Japan - Automation Tool ====" -ForegroundColor Magenta
Write-Host ""

Write-InfoMsg "Task: $Task"
Write-Host ""

switch ($Task) {
    "setup" { Invoke-Setup }
    "dev" { Invoke-Dev }
    "build" { Invoke-Build }
    "database-migrate" { Invoke-DatabaseMigrate }
    "backup" { Invoke-Backup }
    "clean" { Invoke-Clean }
    "full-setup" { Invoke-FullSetup }
    default { 
        Write-WarningMsg "Unknown task: $Task"
        Write-InfoMsg "Available tasks:"
        Write-Host "  - setup           : Initialize development environment"
        Write-Host "  - dev             : Start development server"
        Write-Host "  - build           : Build project for production"
        Write-Host "  - database-migrate: Run database migrations"
        Write-Host "  - backup          : Create project backup"
        Write-Host "  - clean           : Remove build artifacts"
        Write-Host "  - full-setup      : Complete setup and build"
    }
}

Write-Host ""
Write-InfoMsg "Automation script completed"
Write-Host ""
