# SSH Tunnel Fix - Try Different MongoDB Ports
# Usage: .\tunnel-fix.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SSH Tunnel Diagnostic Tool" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$VPS_IP = "76.13.196.116"
$VPS_USER = "root"

Write-Host "Testing SSH connection to VPS..." -ForegroundColor Yellow
Write-Host ""

# Test 1: MongoDB di VPS port 27017 (default)
Write-Host "[Test 1] Trying MongoDB port 27017..." -ForegroundColor Cyan
Write-Host "Command: ssh -L 27018:localhost:27017 -N $VPS_USER@$VPS_IP" -ForegroundColor Gray
Write-Host ""
Write-Host "If this works, you'll see no output (tunnel is running)" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop and try next test" -ForegroundColor Yellow
Write-Host ""

ssh -L 27018:localhost:27017 -N $VPS_USER@$VPS_IP

Write-Host ""
Write-Host "Tunnel stopped." -ForegroundColor Yellow
Write-Host ""
Write-Host "If that didn't work, try Test 2:" -ForegroundColor Yellow
Write-Host ""

# Test 2: MongoDB di VPS port 27018
Write-Host "[Test 2] Trying MongoDB port 27018..." -ForegroundColor Cyan
Write-Host "Command: ssh -L 27018:localhost:27018 -N $VPS_USER@$VPS_IP" -ForegroundColor Gray
Write-Host ""

$response = Read-Host "Try Test 2? (y/n)"
if ($response -eq "y") {
    ssh -L 27018:localhost:27018 -N $VPS_USER@$VPS_IP
}
