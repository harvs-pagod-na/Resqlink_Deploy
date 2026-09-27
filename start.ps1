# RESQLINK Root Startup Script
$script = Join-Path $PSScriptRoot "Resqlink_start\start.ps1"
if (-not (Test-Path $script)) {
    $script = Join-Path $PSScriptRoot "Resqlink\start.ps1"
}
if (Test-Path $script) {
    & $script
} else {
    Write-Error "Could not find start.ps1 in Resqlink_start or Resqlink"
}
