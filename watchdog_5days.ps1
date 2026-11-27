<#
.SYNOPSIS
  AIOTA 5-Day Resilient Watchdog & Keep-Alive Supervisor
  Keeps backend, cloudflared tunnel, and Vercel connection alive for 120 hours (5 days).
#>

param(
    [int]$DurationHours = 120
)

$ErrorActionPreference = "SilentlyContinue"

# 1. Prevent Windows System Sleep & Hibernation using Win32 API
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class SleepUtil {
    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern uint SetThreadExecutionState(uint esFlags);
    public const uint ES_CONTINUOUS = 0x80000000;
    public const uint ES_SYSTEM_REQUIRED = 0x00000001;
    public const uint ES_AWAYMODE_REQUIRED = 0x00000040;
}
"@ -ErrorAction SilentlyContinue

# Set continuous system required + away mode (prevents sleep, allows screen to turn off safely)
[SleepUtil]::SetThreadExecutionState([SleepUtil]::ES_CONTINUOUS -bor [SleepUtil]::ES_SYSTEM_REQUIRED -bor [SleepUtil]::ES_AWAYMODE_REQUIRED) | Out-Null

$EndTime = (Get-Date).AddHours($DurationHours)
$TunnelUrl = "https://dallas-dishes-retained-federation.trycloudflare.com"
$LogPath = "$PSScriptRoot\watchdog_uptime.log"

function Log-Message($msg) {
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $line = "[$timestamp] $msg"
    Write-Output $line
    Add-Content -Path $LogPath -Value $line -ErrorAction SilentlyContinue
}

Log-Message "=== AIOTA 5-Day Keep-Alive Watchdog Started ==="
Log-Message "Target Duration: $DurationHours hours (until $((Get-Date).AddHours($DurationHours).ToString('yyyy-MM-dd HH:mm:ss')))"
Log-Message "Monitored Tunnel: $TunnelUrl"

$iteration = 0

while ((Get-Date) -lt $EndTime) {
    $iteration++
    [SleepUtil]::SetThreadExecutionState([SleepUtil]::ES_CONTINUOUS -bor [SleepUtil]::ES_SYSTEM_REQUIRED -bor [SleepUtil]::ES_AWAYMODE_REQUIRED) | Out-Null

    # A. Check FastAPI Backend on port 8000
    $backendAlive = $false
    try {
        $res = Invoke-WebRequest -Uri "http://localhost:8000/api/health" -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
        if ($res.StatusCode -eq 200) { $backendAlive = $true }
    } catch {}

    if (-not $backendAlive) {
        Log-Message "[WATCHDOG WARNING] Backend port 8000 unresponsive. Reviving FastAPI..."
        $pythonPath = "c:\Users\Asus\Downloads\AIOTA_Smart_Home\backend\.venv\Scripts\python.exe"
        Start-Process -FilePath $pythonPath -ArgumentList "-m uvicorn app.main:app --host 0.0.0.0 --port 8000" -WorkingDirectory "c:\Users\Asus\Downloads\AIOTA_Smart_Home\backend" -WindowStyle Hidden
        Start-Sleep -Seconds 4
    }

    # B. Check Cloudflare Tunnel process
    $cfProcess = Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue
    if (-not $cfProcess) {
        Log-Message "[WATCHDOG WARNING] cloudflared process stopped. Restarting tunnel..."
        $cfPath = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
        Start-Process -FilePath $cfPath -ArgumentList "tunnel --url http://localhost:8000" -WindowStyle Hidden
        Start-Sleep -Seconds 6
    }

    # C. Keep-alive heartbeat ping to Cloudflare Tunnel (prevents idle drop)
    try {
        $tunnelPing = Invoke-WebRequest -Uri "$TunnelUrl/api/telemetry?limit=1" -TimeoutSec 6 -UseBasicParsing -ErrorAction SilentlyContinue
        if ($tunnelPing.StatusCode -eq 200 -and ($iteration % 20 -eq 0)) {
            Log-Message "[HEARTBEAT OK] Tunnel & Backend fully healthy (Iteration $iteration)"
        }
    } catch {
        Log-Message "[TUNNEL PROBE] Tunnel ping error. Will retry next cycle."
    }

    # Check every 30 seconds
    Start-Sleep -Seconds 30
}

Log-Message "=== AIOTA 5-Day Watchdog Completed Successfully ==="
