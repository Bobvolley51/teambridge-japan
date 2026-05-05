# PowerShell Automation Guide - Teambridge Japan

Complete automation for database operations, build tasks, deployment, and data management.

## Quick Start

### PowerShell Method (Recommended)
```powershell
# Full setup and build
.\automate.ps1 -Task full-setup

# Or individual tasks
.\automate.ps1 -Task setup
.\automate.ps1 -Task build
```

### Batch File Method (Windows)
```bash
automate.bat setup
automate.bat dev
automate.bat build
```

## Available Tasks

### 1. **setup** - Initialize Development Environment
Sets up your development environment by:
- Checking for Node.js installation
- Installing npm dependencies
- Creating/validating `.env.local` file
- Verifying database connection files

```powershell
.\automate.ps1 -Task setup
```

### 2. **dev** - Start Development Server
Launches the Next.js development server on `http://localhost:3000`

```powershell
.\automate.ps1 -Task dev
```

Equivalent to: `npm run dev`

### 3. **build** - Build for Production
Compiles the Next.js project for production deployment

```powershell
.\automate.ps1 -Task build
```

Equivalent to: `npm run build`

### 4. **database-migrate** - Run Database Migrations
Processes all SQL schema files in sequence:
- schema.sql
- schema_profiles.sql
- schema_channels.sql
- schema_events.sql
- schema_notifications.sql
- schema_account_requests_v2.sql

```powershell
.\automate.ps1 -Task database-migrate
```

**Note:** Configure your database connection in `.env.local` before running.

### 5. **backup** - Create Project Backup
Creates a timestamped backup of your project:
- Source code (app/, components/, lib/)
- Configuration files
- Database schemas
- Environment variables (encrypted)

```powershell
.\automate.ps1 -Task backup
```

Default backup location: `./backups/teambridge-backup_YYYYMMDD_HHMMSS.zip`

Custom backup path:
```powershell
.\automate.ps1 -Task backup -BackupPath "C:\Backups\Teambridge"
```

### 6. **clean** - Remove Build Artifacts
Cleans up build directories and temporary files:
- `.next/` - Next.js build output
- `node_modules/` - Dependencies (can be reinstalled with `npm install`)
- `.dist/` - Build artifacts
- `*.log` - Log files

```powershell
.\automate.ps1 -Task clean
```

### 7. **full-setup** - Complete Setup and Build
Runs the entire automation sequence:
1. Initialize environment (setup)
2. Install dependencies
3. Build for production

```powershell
.\automate.ps1 -Task full-setup
```

## Database Configuration

### Supabase Setup
Your project uses Supabase for the database. Required environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://vlzxpbndvvzktuccavfg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ACCESS_TOKEN=your_access_token
```

These are already configured in `.env.local`.

### Running Migrations
To apply database schemas to Supabase:

```powershell
# Check Supabase connection
.\automate.ps1 -Task setup

# Run migrations
.\automate.ps1 -Task database-migrate
```

## Deployment Workflow

### Pre-Deployment Checklist
```powershell
# 1. Create backup of current state
.\automate.ps1 -Task backup

# 2. Clean build artifacts
.\automate.ps1 -Task clean

# 3. Fresh install and build
.\automate.ps1 -Task full-setup

# 4. Run tests (if configured)
npm test

# 5. Build for production
.\automate.ps1 -Task build

# 6. Deploy to Vercel
vercel deploy --prod
```

## Backup and Restore

### Creating Backups
```powershell
# Automatic timestamped backup
.\automate.ps1 -Task backup

# Custom backup location
.\automate.ps1 -Task backup -BackupPath "D:\ProjectBackups"
```

### Restore from Backup
```powershell
# Extract the backup zip file
Expand-Archive -Path "backups\teambridge-backup_20260505_143000.zip" -DestinationPath "."

# Reinstall dependencies
npm install
```

## Advanced Usage

### Custom Database Path
```powershell
.\automate.ps1 -Task database-migrate -DatabasePath "C:\Data\Databases"
```

### Chaining Tasks
```powershell
# Setup → Build → Backup
.\automate.ps1 -Task setup; .\automate.ps1 -Task build; .\automate.ps1 -Task backup
```

### Running with Elevated Privileges
Some operations may require administrator access:

```powershell
# Run PowerShell as Administrator, then:
.\automate.ps1 -Task full-setup
```

## Troubleshooting

### "ExecutionPolicy" Error
If you see: `cannot be loaded because running scripts is disabled...`

Solution:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Node.js Not Found
Install from: https://nodejs.org/

```powershell
node --version  # Verify installation
npm --version   # Verify npm
```

### Environment Variables Not Set
```powershell
# Check .env.local exists
Test-Path .env.local

# View contents (remove sensitive data before sharing)
Get-Content .env.local
```

### Backup Fails
Ensure backup directory is writable:
```powershell
# Create backup directory manually
New-Item -ItemType Directory -Path "./backups" -Force
```

## Project Structure

```
teambridge-japan/
├── app/                 # Next.js app directory
├── components/          # React components
├── lib/                 # Utilities and libraries
├── public/              # Static files
├── schema*.sql          # Database schemas
├── package.json         # Dependencies
├── .env.local          # Environment variables
├── automate.ps1        # Main automation script
└── automate.bat        # Windows launcher
```

## Environment Variables

All required environment variables are in `.env.local`:
- **NEXT_PUBLIC_SUPABASE_URL** - Supabase project URL
- **NEXT_PUBLIC_SUPABASE_ANON_KEY** - Anonymous key for client-side requests
- **SUPABASE_SERVICE_ROLE_KEY** - Service role key for server-side operations
- **SUPABASE_ACCESS_TOKEN** - Personal access token for Supabase CLI
- **ANTHROPIC_API_KEY** - Claude AI API key
- **DEEPL_API_KEY** - DeepL translation API key

## Scripts Summary

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server |
| `npm run build` | Build for production |
| `npm run start` | Run production build |
| `npm run lint` | Run ESLint |

## Getting Help

For issues or questions:
1. Check the troubleshooting section above
2. Review `.env.local` configuration
3. Ensure all dependencies are installed: `npm install`
4. Check Node.js version: `node --version` (requires v18+)

## Notes

- The automation script is designed to be idempotent (safe to run multiple times)
- Backups are created in `./backups/` directory
- Always backup before major operations
- Keep `.env.local` secure - never commit to version control
- Test migrations in development before production
