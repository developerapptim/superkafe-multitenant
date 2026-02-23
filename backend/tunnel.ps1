# Simple SSH Tunnel Script
# Jalankan: .\tunnel.ps1

Write-Host "Starting SSH tunnel to VPS MongoDB..." -ForegroundColor Cyan
Write-Host "VPS: 76.13.196.116" -ForegroundColor Yellow
Write-Host "Local Port: 27018" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop" -ForegroundColor Green
Write-Host ""

ssh -L 27018:localhost:27017 -N root@76.13.196.116
