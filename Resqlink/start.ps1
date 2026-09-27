# ===============================================================
# RESQLINK Emergency Response Management System
# One-Click Startup Script
# Run this from PowerShell: .\start.ps1
# ===============================================================

$ROOT = $PSScriptRoot
$NODE = "$ROOT\node-v20.11.0-win-x64"

# Add bundled Node.js to PATH for this session
if (Test-Path $NODE) {
    $env:PATH = "$NODE;$env:PATH"
}

# Auto-configure Windows Firewall for LAN device access if running as Administrator
try {
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if ($isAdmin) {
        $fwRule = Get-NetFirewallRule -DisplayName "RESQLINK Web (Port 5173)" -ErrorAction SilentlyContinue
        if (-not $fwRule) {
            New-NetFirewallRule -DisplayName "RESQLINK Web (Port 5173)" -Direction Inbound -LocalPort 5173 -Protocol TCP -Action Allow -Profile Any -ErrorAction SilentlyContinue | Out-Null
            New-NetFirewallRule -DisplayName "RESQLINK Backend (Port 3000)" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow -Profile Any -ErrorAction SilentlyContinue | Out-Null
            New-NetFirewallRule -DisplayName "RESQLINK Emergency (Port 4000)" -Direction Inbound -LocalPort 4000 -Protocol TCP -Action Allow -Profile Any -ErrorAction SilentlyContinue | Out-Null
            New-NetFirewallRule -DisplayName "RESQLINK AI Service (Port 5001)" -Direction Inbound -LocalPort 5001 -Protocol TCP -Action Allow -Profile Any -ErrorAction SilentlyContinue | Out-Null
            if (Test-Path "$NODE\node.exe") {
                New-NetFirewallRule -DisplayName "RESQLINK Node Runtime" -Direction Inbound -Program "$NODE\node.exe" -Action Allow -Profile Any -ErrorAction SilentlyContinue | Out-Null
            }
        }
    }
} catch {
    # Non-elevated session, continue normally
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Red
Write-Host "  RESQLINK - Starting Up               " -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red
Write-Host ""

# --- 1. Check XAMPP MySQL (Port 3306) ------------------------
Write-Host "[ 1/5 ] Checking MySQL (port 3306)..." -ForegroundColor Yellow
$mysqlRunning = (netstat -an | Select-String ":3306.*LISTENING")
if ($mysqlRunning) {
    Write-Host "        [OK] MySQL is already running" -ForegroundColor Green
} else {
    Write-Host "        [WARN] MySQL is NOT running. Attempting auto-start..." -ForegroundColor Yellow
    $mysqlBatch = @("C:\xamppresqlink\mysql_start.bat", "C:\xampp\mysql_start.bat") | Where-Object { Test-Path $_ } | Select-Object -First 1
    if ($mysqlBatch) {
        Start-Process cmd -ArgumentList "/c", "`"$mysqlBatch`"" -WindowStyle Hidden
        Start-Sleep -Seconds 3
        $mysqlRunning = (netstat -an | Select-String ":3306.*LISTENING")
    }
    if ($mysqlRunning) {
        Write-Host "        [OK] MySQL started successfully" -ForegroundColor Green
    } else {
        Write-Host "        [WARN] Please open XAMPP Control Panel and start MySQL manually." -ForegroundColor Red
        Write-Host ""
        Read-Host "Press ENTER after starting MySQL to continue..."
    }
}

# Helper: kill any process holding a given TCP port
function Stop-PortProcess {
    param([int]$Port)
    $portPids = netstat -ano | Select-String ":$Port\s" | ForEach-Object {
        ($_ -split '\s+')[-1]
    } | Sort-Object -Unique | Where-Object { $_ -match '^\d+$' -and [int]$_ -ne 0 }
    foreach ($procId in $portPids) {
        Stop-Process -Id ([int]$procId) -Force -ErrorAction SilentlyContinue
    }
}

# Helper: launch a cmd window via a temporary .bat file to avoid ampersand parsing issues
function Start-CmdScript {
    param([string]$Title, [string]$Commands)
    $tmpBat = [System.IO.Path]::GetTempFileName() + ".bat"
    $batContent = "@echo off`r`ntitle $Title`r`n$Commands"
    [System.IO.File]::WriteAllText($tmpBat, $batContent, [System.Text.Encoding]::ASCII)
    Start-Process -FilePath "cmd.exe" -ArgumentList "/k `"$tmpBat`"" -WindowStyle Normal
}

# --- 2. Backend (Port 3000) ----------------------------------
Write-Host ""
Write-Host "[ 2/5 ] Starting Backend (port 3000)..." -ForegroundColor Yellow
Write-Host "        Stopping any stale process on port 3000..." -ForegroundColor Gray
Stop-PortProcess -Port 3000
Start-Sleep -Seconds 1
$backendBat = "$ROOT\backend\run_backend.bat"
if (Test-Path $backendBat) {
    Start-Process -FilePath "cmd.exe" -ArgumentList "/k `"$backendBat`"" -WindowStyle Normal
} else {
    $cmds = "set PATH=$NODE;%PATH%`r`ncd /d `"$ROOT\backend`"`r`nnode src/app.js"
    Start-CmdScript -Title "BACKEND (3000)" -Commands $cmds
}
Start-Sleep -Seconds 2
Write-Host "        [OK] Backend started in new window" -ForegroundColor Green

# --- 3. Frontend (Port 5173) ---------------------------------
Write-Host ""
Write-Host "[ 3/5 ] Starting Frontend (port 5173)..." -ForegroundColor Yellow
Write-Host "        Stopping any stale process on port 5173..." -ForegroundColor Gray
Stop-PortProcess -Port 5173
Start-Sleep -Seconds 1
# Clear Vite cache to prevent Pre-transform / stale module errors
$viteCache = "$ROOT\frontend\node_modules\.vite"
if (Test-Path $viteCache) {
    Remove-Item -Recurse -Force $viteCache -ErrorAction SilentlyContinue
    Write-Host "        Cleared Vite cache." -ForegroundColor Gray
}
$frontendBat = "$ROOT\frontend\run_frontend.bat"
if (Test-Path $frontendBat) {
    Start-Process -FilePath "cmd.exe" -ArgumentList "/k `"$frontendBat`"" -WindowStyle Normal
} else {
    $cmds = "set PATH=$NODE;%PATH%`r`ncd /d `"$ROOT\frontend`"`r`nnpm run dev"
    Start-CmdScript -Title "FRONTEND (5173)" -Commands $cmds
}
Start-Sleep -Seconds 2
Write-Host "        [OK] Frontend started in new window" -ForegroundColor Green

# --- 4. AI Service (Port 5001) -------------------------------
Write-Host ""
Write-Host "[ 4/5 ] Starting AI Service (port 5001)..." -ForegroundColor Yellow
$pyExe = "$ROOT\ai-service\venv\Scripts\python.exe"
$aiBat = "$ROOT\ai-service\run_ai.bat"
if (Test-Path $pyExe) {
    Write-Host "        Stopping any stale process on port 5001..." -ForegroundColor Gray
    Stop-PortProcess -Port 5001
    Start-Sleep -Seconds 1
    if (Test-Path $aiBat) {
        Start-Process -FilePath "cmd.exe" -ArgumentList "/k `"$aiBat`"" -WindowStyle Normal
    } else {
        $cmds = "cd /d `"$ROOT\ai-service`"`r`nvenv\Scripts\python.exe app.py"
        Start-CmdScript -Title "AI SERVICE (5001)" -Commands $cmds
    }
    Start-Sleep -Seconds 2
    Write-Host "        [OK] AI Service started in new window" -ForegroundColor Green
} else {
    Write-Host "        [INFO] Python runtime not configured locally. AI Service skipped." -ForegroundColor Gray
}

# --- 5. Emergency Live Telemetry App (Port 4000) -------------
$emergAppDir = "$ROOT\..\emergency-app"
$emergBat = "$emergAppDir\start_emergency_app.bat"
if (Test-Path $emergBat) {
    Write-Host ""
    Write-Host "[ 5/5 ] Starting Emergency Telemetry Server (port 4000)..." -ForegroundColor Yellow
    $port4000 = (netstat -an | Select-String ":4000.*LISTENING")
    if ($port4000) {
        Write-Host "        [INFO] Port 4000 already in use - Emergency App is already running." -ForegroundColor Cyan
    } else {
        Start-Process -FilePath "cmd.exe" -ArgumentList "/k `"$emergBat`"" -WindowStyle Normal
        Start-Sleep -Seconds 1
        Write-Host "        [OK] Emergency App started in new window" -ForegroundColor Green
    }
}

# --- Done ----------------------------------------------------
$lanIp = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { 
    $_.InterfaceAlias -notmatch 'Loopback|vEthernet|WSL|Default' -and 
    $_.IPAddress -notmatch '^169\.254\.' 
} | Select-Object -ExpandProperty IPAddress -First 1)

if (-not $lanIp) {
    $lanIp = "127.0.0.1"
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  All services started successfully!      " -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  [Local Machine Access]" -ForegroundColor Yellow
Write-Host "  Main Web App : http://localhost:5173" -ForegroundColor White
Write-Host "  Backend API  : http://localhost:3000" -ForegroundColor White
Write-Host "  AI Service   : http://localhost:5001" -ForegroundColor White
if (Test-Path $emergBat) {
    Write-Host "  Emergency NOC: http://localhost:4000" -ForegroundColor White
}
Write-Host "  API Health   : http://localhost:3000/health" -ForegroundColor White
Write-Host ""
Write-Host "  [Other Devices (Phones / Laptops / Tablets)]" -ForegroundColor Yellow
Write-Host "  Main Web App : http://${lanIp}:5173" -ForegroundColor Green
Write-Host "  Backend API  : http://${lanIp}:3000" -ForegroundColor White
if (Test-Path $emergBat) {
    Write-Host "  Emergency NOC: http://${lanIp}:4000" -ForegroundColor White
}
Write-Host ""
Write-Host "  To access on another device, connect it to the same Wi-Fi and open:" -ForegroundColor Cyan
Write-Host "  >> http://${lanIp}:5173 <<" -ForegroundColor Green
Write-Host ""
Write-Host "Default Admin Credentials:" -ForegroundColor Yellow
Write-Host "  Super Admin  : superadmin@resqlink.gov.ph" -ForegroundColor White
Write-Host "  Password     : Admin@123456" -ForegroundColor White
Write-Host ""
Write-Host "Close the spawned terminal windows to stop services." -ForegroundColor Gray
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Open default browser
Start-Process "http://localhost:5173"