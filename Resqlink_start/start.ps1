# ===============================================================
# RESQLINK Legacy Path Compatibility Forwarder
# Points from 'Resqlink_start\start.ps1' to 'Resqlink\start.ps1'
# ===============================================================

$realScript = Join-Path $PSScriptRoot "..\Resqlink\start.ps1"
if (Test-Path $realScript) {
    & $realScript
} else {
    Write-Error "Could not find $realScript"
}
