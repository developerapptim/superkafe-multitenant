Write-Host "🔍 Checking MongoDB SSH Tunnel Status..." -ForegroundColor Cyan
Write-Host ""

# Check if port 27018 is listening
$port = 27018
$connection = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue

if ($connection) {
    Write-Host "✅ SSH Tunnel AKTIF di port $port" -ForegroundColor Green
    Write-Host ""
    Write-Host "Process Info:" -ForegroundColor Yellow
    $process = Get-Process -Id $connection.OwningProcess
    Write-Host "  PID: $($process.Id)"
    Write-Host "  Name: $($process.ProcessName)"
    Write-Host "  Start Time: $($process.StartTime)"
    Write-Host ""
    Write-Host "✅ Backend seharusnya bisa connect ke MongoDB" -ForegroundColor Green
} else {
    Write-Host "❌ SSH Tunnel TIDAK AKTIF di port $port" -ForegroundColor Red
    Write-Host ""
    Write-Host "Solusi:" -ForegroundColor Yellow
    Write-Host "1. Edit file: backend\connect-vps-mongodb.ps1"
    Write-Host "   - Sesuaikan VPS_HOST, VPS_USER, dll"
    Write-Host ""
    Write-Host "2. Jalankan SSH tunnel:"
    Write-Host "   .\backend\connect-vps-mongodb.ps1" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   Atau manual:"
    Write-Host "   ssh -L 27018:127.0.0.1:27017 root@your-vps-ip -N" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "3. Biarkan window tunnel tetap terbuka"
    Write-Host ""
    Write-Host "4. Restart backend server"
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
