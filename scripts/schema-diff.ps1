# Compares local schema_*.sql files against live Supabase tables via MCP
# Usage: .\scripts\schema-diff.ps1
# Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local

$envFile = Join-Path $PSScriptRoot "..\\.env.local"
if (-not (Test-Path $envFile)) {
    Write-Error ".env.local not found at $envFile"
    exit 1
}

# Parse .env.local
$env_vars = @{}
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') {
        $env_vars[$matches[1].Trim()] = $matches[2].Trim().Trim('"')
    }
}

$url = $env_vars["NEXT_PUBLIC_SUPABASE_URL"]
$key = $env_vars["SUPABASE_SERVICE_ROLE_KEY"]

if (-not $url -or -not $key) {
    Write-Error "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
    exit 1
}

Write-Host "`nFetching live tables from Supabase..." -ForegroundColor Cyan

# Query information_schema for public tables
$query = "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by table_name"
$body = @{ query = $query } | ConvertTo-Json
$headers = @{
    "apikey"        = $key
    "Authorization" = "Bearer $key"
    "Content-Type"  = "application/json"
}

try {
    $resp = Invoke-RestMethod -Uri "$url/rest/v1/rpc/exec_sql" -Method POST -Headers $headers -Body $body -ErrorAction Stop
    $liveTables = $resp | ForEach-Object { $_.table_name }
} catch {
    # Fallback: use PostgREST introspection endpoint
    try {
        $resp2 = Invoke-RestMethod -Uri "$url/rest/v1/" -Headers $headers -ErrorAction Stop
        $liveTables = ($resp2.definitions.PSObject.Properties.Name)
    } catch {
        Write-Warning "Could not fetch live tables: $_"
        Write-Host "Run via Supabase MCP instead: ask Claude to list_tables and compare with local schemas." -ForegroundColor Yellow
        exit 0
    }
}

# Parse local schema files for CREATE TABLE statements
$schemaDir = Join-Path $PSScriptRoot ".."
$sqlFiles = Get-ChildItem $schemaDir -Filter "schema*.sql" | Where-Object { $_.Name -ne "schema_master_migration.sql" }

$localTables = @{}
foreach ($file in $sqlFiles) {
    $content = Get-Content $file.FullName -Raw
    $matches_found = [regex]::Matches($content, 'CREATE TABLE(?:\s+IF NOT EXISTS)?\s+(?:"?public"?\.)?"?(\w+)"?', 'IgnoreCase')
    foreach ($m in $matches_found) {
        $tname = $m.Groups[1].Value.ToLower()
        $localTables[$tname] = $file.Name
    }
}

Write-Host "`n=== Schema Diff Report ===" -ForegroundColor White
Write-Host "Local schema files: $($sqlFiles.Count) | Local tables defined: $($localTables.Count)" -ForegroundColor Gray

if ($liveTables) {
    Write-Host "Live Supabase tables: $($liveTables.Count)" -ForegroundColor Gray

    $localNames = $localTables.Keys | ForEach-Object { $_.ToLower() }
    $liveNames  = $liveTables | ForEach-Object { $_.ToLower() }

    $onlyLocal = $localNames | Where-Object { $liveNames -notcontains $_ }
    $onlyLive  = $liveNames  | Where-Object { $localNames -notcontains $_ }

    if ($onlyLocal) {
        Write-Host "`nIn local schemas but NOT on Supabase (migration pending?):" -ForegroundColor Yellow
        $onlyLocal | ForEach-Object { Write-Host "  + $_  (from: $($localTables[$_]))" -ForegroundColor Yellow }
    }
    if ($onlyLive) {
        Write-Host "`nOn Supabase but NOT in local schemas (schema drift?):" -ForegroundColor Red
        $onlyLive | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    }
    if (-not $onlyLocal -and -not $onlyLive) {
        Write-Host "`nNo drift — local schemas match live Supabase tables." -ForegroundColor Green
    }
} else {
    Write-Host "`nLocal tables defined:" -ForegroundColor Cyan
    $localTables.GetEnumerator() | Sort-Object Key | ForEach-Object {
        Write-Host "  $($_.Key)  (from: $($_.Value))"
    }
}
