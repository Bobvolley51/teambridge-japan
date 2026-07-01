$inputText = [Console]::In.ReadToEnd()
try { $json = $inputText | ConvertFrom-Json } catch { exit 0 }
if (-not ($json.tool_input.command -match '\bbuild\b')) { exit 0 }
$proj = "c:\Users\Bob\Dropbox\Bob\Privat\Claude\Teambridge Japan\teambridge-japan"
Push-Location $proj
$result = & npm run lint 2>&1
$exitCode = $LASTEXITCODE
Pop-Location
if ($exitCode -ne 0) {
    $msg = ($result | ForEach-Object { $_.ToString() }) -join "`n"
    @{ continue = $false; stopReason = "ESLint failed - fix before building:`n$msg" } | ConvertTo-Json -Compress
    exit 1
}
