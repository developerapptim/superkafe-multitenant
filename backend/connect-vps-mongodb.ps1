# SSH Tunnel Script untuk MongoDB VPS
# Membuat tunnel dari localhost:27018 ke MongoDB di VPS

Write-Host "SSH Tunnel ke MongoDB VPS" -ForegroundColor Cyan
Write-Host ""

# Konfigurasi VPS
$VPS_HOST = "76.13.196.116"
$VPS_USER = "root"
$VPS_SSH_PORT = 22
$LOCAL_PORT = 27018
$REMOTE_MONGODB_HOST = "127.0.0.1"
$REMOTE_MONGODB_PORT = 27018

Write-Host "Konfigurasi:" -ForegroundColor Yellow
Write-Host "  VPS Host: $VPS_HOST"
Write-Host "  VPS User: $VPS_USER"
Write-Host "  Local Port: $LOCAL_PORT"
Write-Host "  Remote MongoDB: $REMOTE_MONGODB_HOST`:$REMOTE_MONGODB_PORT"
Write-Host ""

# Cek apakah port sudah digunakan
$portInUse = Get-NetTCPConnection -LocalPort $LOCAL_PORT -ErrorAction SilentlyContinue

if ($portInUse) {
    Write-Host "Port $LOCAL_PORT sudah digunakan!" -ForegroundColor Yellow
    Write-Host "Proses yang menggunakan port:" -ForegroundColor Yellow
    Get-Process -Id $portInUse.OwningProcess | Select-Object Id, ProcessName, StartTime
    Write-Host ""
    $kill = Read-Host "Matikan proses tersebut? (y/n)"
    if ($kill -eq "y") {
        Stop-Process -Id $portInUse.OwningProcess -Force
        Write-Host "Proses dihentikan" -ForegroundColor Green
        Start-Sleep -Seconds 2
    } else {
        Write-Host "Dibatalkan" -ForegroundColor Red
        exit 1
    }
}

Write-Host "Membuat SSH tunnel..." -ForegroundColor Cyan
Write-Host ""
Write-Host "Tips:" -ForegroundColor Yellow
Write-Host "  - Biarkan window ini tetap terbuka"
Write-Host "  - Tekan Ctrl+C untuk menutup tunnel"
Write-Host "  - Masukkan password SSH jika diminta"
Write-Host ""
Write-Host "Tunnel akan aktif di: 127.0.0.1:$LOCAL_PORT" -ForegroundColor Green
Write-Host ""

# Build SSH command
$forwardSpec = "$LOCAL_PORT`:$REMOTE_MONGODB_HOST`:$REMOTE_MONGODB_PORT"
$sshTarget = "$VPS_USER@$VPS_HOST"

# Jalankan SSH tunnel
& ssh -L $forwardSpec $sshTarget -p $VPS_SSH_PORT -N
