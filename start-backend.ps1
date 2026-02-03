# start-backend.ps1 (Clean UTF-8 version)
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$ErrorActionPreference = "Stop"

$ProjectRoot = "C:\Users\lkq\my-first-threejs-app"
$BackendDir = "$ProjectRoot\backend\code"
$AppFile = "$BackendDir\app.py"
$CloudflaredPath = "C:\Users\lkq\cloudflared\cloudflared.exe"
$PythonPath = "C:\Users\lkq\miniconda3\envs\cq\python.exe"

Write-Host "Starting backend service..." -ForegroundColor Green

# Check files
if (!(Test-Path $AppFile)) {
    Write-Host "ERROR: app.py not found at $AppFile" -ForegroundColor Red
    pause
    exit 1
}
if (!(Test-Path $CloudflaredPath)) {
    Write-Host "ERROR: cloudflared.exe not found at $CloudflaredPath" -ForegroundColor Red
    pause
    exit 1
}
if (!(Test-Path $PythonPath)) {
    Write-Host "ERROR: python.exe not found at $PythonPath" -ForegroundColor Red
    Write-Host "TIP: Check if 'cq' env exists in miniconda3\envs\" -ForegroundColor Yellow
    pause
    exit 1
}

# Start Flask
Write-Host "`n[Flask] Starting..." -ForegroundColor Yellow
Start-Process -FilePath $PythonPath -ArgumentList "`"$AppFile`"" -WorkingDirectory $BackendDir -WindowStyle Hidden

Start-Sleep -Seconds 3

# Start Cloudflare Tunnel
Write-Host "`n[Cloudflare] Starting tunnel..." -ForegroundColor Cyan
& $CloudflaredPath tunnel --url http://localhost:5000

# Cleanup
Write-Host "`n[Cleanup] Stopping services..." -ForegroundColor Red
Get-Process python | Where-Object { $_.Path -eq $PythonPath } | Stop-Process -Force