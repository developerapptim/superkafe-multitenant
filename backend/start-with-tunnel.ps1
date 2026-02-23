# Start Backend with SSH Tunnel
# Usage: .\start-with-tunnel.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Starting Backend with SSH Tunnel" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Start SSH tunnel in background
Write-Host "[1/3] Starting SSH tunnel..." -ForegroundColor Yellow
$tunnelJob = Start-Job -ScriptBlock {
    ssh -L 27018:localhost:27017 -N root@76.13.196.116
}

# Step 2: Wait for tunnel to establish
Write-Host "[2/3] Waiting for tunnel to establish (10 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Step 3: Check if tunnel is active
Write-Host "[3/3] Checking tunnel status..." -ForegroundColor Yellow
$portCheck = Get-NetTCPConnection -LocalPort 27018 -ErrorAction SilentlyContinue

if ($portCheck) {
    Write-Host "OK Tunnel is active on port 27018" -ForegroundColor Green
    Write-Host ""
    Write-Host "Starting backend..." -ForegroundColor Cyan
    Write-Host ""
    
    # Start backend
    npm start
    
    # Cleanup: Stop tunnel when backend stops
    Write-Host ""
    Write-Host "Stopping SSH tunnel..." -ForegroundColor Yellow
    Stop-Job -Job $tunnelJob
    Remove-Job -Job $tunnelJob
} else {
    Write-Host "X Tunnel failed to establish!" -ForegroundColor Red
    Write-Host "  Please check:" -ForegroundColor Yellow
    Write-Host "  1. VPS is accessible (ping 76.13.196.116)" -ForegroundColor White
    Write-Host "  2. SSH credentials are correct" -ForegroundColor White
    Write-Host "  3. Port 27018 is not in use" -ForegroundColor White
    
    # Cleanup
    Stop-Job -Job $tunnelJob
    Remove-Job -Job $tunnelJob
    exit 1
}
