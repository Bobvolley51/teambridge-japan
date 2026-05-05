# Session Checkpoint & Resume Guide

Seamlessly continue coding after your session limit resets using automated checkpoints.

## Overview

The Session Checkpoint Manager saves your coding progress, git state, and work notes, allowing you to quickly resume exactly where you left off when your context resets.

## Quick Start

### Before Context Reset (Save Your Progress)

```powershell
# Quick checkpoint with auto-generated name
.\session-manager.ps1 -Action checkpoint

# Named checkpoint for better organization
.\session-manager.ps1 -Action checkpoint -SessionName "feature-auth"
```

Or using batch file:
```bash
session-manager.bat checkpoint
session-manager.bat checkpoint feature-auth
```

### After Context Reset (Resume Work)

```powershell
# List all available checkpoints
.\session-manager.ps1 -Action list

# Resume from specific checkpoint
.\session-manager.ps1 -Action resume -SessionName "checkpoint_20260505_143000"
```

## What Gets Saved

Each checkpoint captures:

1. **Git Information**
   - Current branch name
   - Uncommitted changes (modified files)
   - Last commit message

2. **Project Snapshot**
   - Timestamp
   - Node.js version
   - npm version
   - Number of modified files

3. **Work Notes** (WORK-NOTES.md)
   - Space for you to document what you were doing
   - List of modified files
   - Code snippets and context
   - Next steps to resume

4. **Modified Files List**
   - Exact status of changed files from git

## Available Commands

### 1. Create Checkpoint
Saves current session state

```powershell
# Auto-generated name
.\session-manager.ps1 -Action checkpoint

# Custom name (recommended)
.\session-manager.ps1 -Action checkpoint -SessionName "working-on-auth"
```

**Output:**
- Creates `.session-checkpoints/<name>/` directory
- Saves `snapshot.json` - session metadata
- Saves `git-info.json` - git state
- Saves `WORK-NOTES.md` - your work documentation
- Saves `modified-files.txt` - list of changed files

### 2. Resume Checkpoint
Loads and displays checkpoint information

```powershell
# View all checkpoints first
.\session-manager.ps1 -Action list

# Resume specific checkpoint
.\session-manager.ps1 -Action resume -SessionName "feature-auth_20260505_143022"
```

**Output:**
- Displays session metadata
- Shows git status at checkpoint time
- Opens WORK-NOTES.md for reference
- Lists all modified files

### 3. List Checkpoints
Shows all available checkpoints

```powershell
.\session-manager.ps1 -Action list
```

**Output:**
```
Available Checkpoints:
================================================================================

[1] feature-auth_20260505_143022
    Created: 2026-05-05 14:30:22
    Branch:  feature/authentication
    Modified Files: 5

[2] checkpoint_20260505_142000
    Created: 2026-05-05 14:20:00
    Branch:  main
    Modified Files: 2
```

### 4. Status
Shows current working state

```powershell
.\session-manager.ps1 -Action status
```

**Output:**
```
Current Working Directory: C:\Projects\teambridge-japan

Git Status:
  Branch: main
  Status: Changes detected

Checkpoint Statistics:
  Total Checkpoints: 5
  Latest: feature-auth_20260505_143022
```

### 5. Clean
Removes checkpoints older than 7 days

```powershell
.\session-manager.ps1 -Action clean
```

## Workflow Example

### Session 1 (Before Reset)

```powershell
# Work on authentication feature
# ... make changes ...

# Create checkpoint when approaching context limit
.\session-manager.ps1 -Action checkpoint -SessionName "auth-feature-wip"

# Edit the generated WORK-NOTES.md manually
notepad .session-checkpoints\auth-feature-wip_*\WORK-NOTES.md
```

### After Context Reset (New Session)

```powershell
# Check what you were working on
.\session-manager.ps1 -Action list

# Resume from checkpoint
.\session-manager.ps1 -Action resume -SessionName "auth-feature-wip_20260505_143000"

# This shows:
# - What branch you were on
# - What files you modified
# - Your work notes explaining the progress
# - Next steps

# Continue development
npm run dev
```

## Work Notes Format

Each checkpoint includes `WORK-NOTES.md` with template sections:

```markdown
# Session Checkpoint: auth-feature_20260505_143000

**Created:** 2026-05-05 14:30:00
**Branch:** feature/authentication
**Last Commit:** a3f4b2c - Add login route

## What You Were Working On

- [ ] Add authentication form
- [ ] Implement JWT verification
- [ ] Add role-based access control

## Modified Files

M  app/api/auth/route.js
M  components/Login.jsx
A  lib/auth-utils.js

## Next Steps

- [ ] Test login flow
- [ ] Add password reset
- [ ] Write unit tests

## Code Context

Key changes made:
- Created `lib/auth-utils.js` with JWT functions
- Updated Login component with form validation
- Added auth route handler

---
**Checkpoint ID:** auth-feature_20260505_143000
```

Edit this manually to add context that will help you resume!

## Checkpoint Directory Structure

```
.session-checkpoints/
├── sessions.log                          # Log of all checkpoint actions
├── auth-feature_20260505_143000/
│   ├── snapshot.json                     # Project state metadata
│   ├── git-info.json                     # Git branch and status
│   ├── modified-files.txt                # List of changed files
│   └── WORK-NOTES.md                     # Your session notes (EDIT THIS!)
└── checkpoint_20260505_142000/
    ├── snapshot.json
    ├── git-info.json
    ├── modified-files.txt
    └── WORK-NOTES.md
```

## Best Practices

### 1. Use Descriptive Names
```powershell
# Good - describes the feature
.\session-manager.ps1 -Action checkpoint -SessionName "login-oauth-integration"

# Less helpful - generic
.\session-manager.ps1 -Action checkpoint
```

### 2. Update Work Notes Immediately
After creating a checkpoint, open and edit the WORK-NOTES.md file:

```powershell
# Find the checkpoint name from list
.\session-manager.ps1 -Action list

# Edit the work notes
notepad ".session-checkpoints\<checkpoint-name>\WORK-NOTES.md"
```

### 3. Regular Cleanup
Remove old checkpoints monthly:

```powershell
# Remove checkpoints older than 7 days
.\session-manager.ps1 -Action clean

# Manual removal
Remove-Item .session-checkpoints\<old-checkpoint> -Recurse
```

### 4. Commit Before Major Changes
After resuming from a checkpoint, commit your work:

```powershell
git add .
git commit -m "Resume feature work from checkpoint"
npm run dev
```

## Integration with Automation

The session manager works alongside your main automation script:

```powershell
# Before session ends: save checkpoint
.\session-manager.ps1 -Action checkpoint -SessionName "current-work"

# After context reset: resume and continue
.\session-manager.ps1 -Action resume -SessionName "current-work"
npm run dev
```

## Session Log

All checkpoint actions are logged in `.session-checkpoints/sessions.log`:

```
[20260505_143000] Created checkpoint: auth-feature_20260505_143000 (Branch: feature/authentication)
[20260505_143500] Resumed checkpoint: auth-feature_20260505_143000
[20260505_150000] Created checkpoint: auth-feature_20260505_150000 (Branch: feature/authentication)
```

Review this log to track your session history.

## Troubleshooting

### Checkpoint Not Creating
```powershell
# Ensure you're in the project directory
Get-Location
cd "C:\Users\Bob\Dropbox\Bob\Volleyball\Teambridge Japan\teambridge-japan"

# Ensure git is initialized
git status
```

### Can't Find a Checkpoint
```powershell
# List all available checkpoints
.\session-manager.ps1 -Action list

# Check checkpoint directory
dir .session-checkpoints
```

### Delete a Specific Checkpoint
```powershell
Remove-Item ".session-checkpoints\<checkpoint-name>" -Recurse -Force
```

## Advanced Usage

### Backup Checkpoints
```powershell
# Zip all checkpoints
Compress-Archive -Path ".session-checkpoints" -DestinationPath "session-backups.zip"
```

### Compare Two Checkpoints
```powershell
# View files modified in different checkpoints
Get-Content ".session-checkpoints\checkpoint1\modified-files.txt"
Get-Content ".session-checkpoints\checkpoint2\modified-files.txt"
```

## Next Session Setup

Create an alias for faster access:

```powershell
# In PowerShell profile ($PROFILE)
function checkpoint { & ".\session-manager.ps1" -Action checkpoint -SessionName $args }
function resume { & ".\session-manager.ps1" -Action resume -SessionName $args }
function checkpoints { & ".\session-manager.ps1" -Action list }
```

Then use:
```powershell
checkpoint "auth-work"
resume "auth-work_20260505_143000"
checkpoints
```

## Notes

- Checkpoints include git information but DO NOT modify your repository
- Commits must be made manually with `git commit`
- Work notes are for YOUR reference - update them as you work
- Old checkpoints are automatically suggested for cleanup after 7 days
- Never commit `.session-checkpoints/` to git (it's in .gitignore)
