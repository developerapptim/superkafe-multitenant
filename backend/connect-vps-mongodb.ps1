# SSH Tunnel to VPS MongoDB
# Usage: .\connect-vps-mongodb.ps1

# ============================================
# CONFIGURATION - SUDAH DIKONFIGURASI SESUAI VPS ANDA
# ============================================

$VPS_IP = "76.13.196.116"          # IP VPS dari Compass
$VPS_USER = "root"                 # Username SSH VPS (default: root)
$VPS_SSH_PORT = 22                 # Port SSH VPS
$MONGODB_PORT = 27018              # Port MongoDB di VPS (UPDATED: 27018, bukan 27017)
$LOCAL_PORT = 27018                # Port lokal (sama dengan Compass)

# ============================================
# SCRIPT - JANGAN EDIT DI BAWAH INI
# ============================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SSH Tunnel to VPS MongoDB" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if SSH is available
try {
    $sshVersion = ssh -V 2>&1
    Write-Host "OK SSH found: $sshVersion" -ForegroundColor Green
} catch {
    Write-Host "X SSH not found!" -ForegroundColor Red
    Write-Host "  Install OpenSSH: https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh_install_firstuse" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  VPS IP       : $VPS_IP" -ForegroundColor White
Write-Host "  VPS User     : $VPS_USER" -ForegroundColor White
Write-Host "  SSH Port     : $VPS_SSH_PORT" -ForegroundColor White
Write-Host "  MongoDB Port : $MONGODB_PORT" -ForegroundColor White
Write-Host "  Local Port   : $LOCAL_PORT" -ForegroundColor White
Write-Host ""

# Check if configuration is set
if ($VPS_IP -eq "76.13.196.116") {
    Write-Host "OK Configuration loaded from MongoDB Compass settings" -ForegroundColor Green
    Write-Host "  VPS IP: $VPS_IP" -ForegroundColor Cyan
    Write-Host ""
}

# Check if port is already in use
$portInUse = Get-NetTCPConnection -LocalPort $LOCAL_PORT -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Host "X Port $LOCAL_PORT is already in use!" -ForegroundColor Red
    Write-Host "  Kill the process or use different port" -ForegroundColor Yellow
    exit 1
}

Write-Host "Connecting to VPS..." -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the tunnel" -ForegroundColor Yellow
Write-Host ""

# Create SSH tunnel
# -L: Local port forwarding
# -N: Don't execute remote command
# -p: SSH port
ssh -L ${LOCAL_PORT}:localhost:${MONGODB_PORT} -N -p $VPS_SSH_PORT ${VPS_USER}@${VPS_IP}

Write-Host ""
Write-Host "Tunnel closed." -ForegroundColor Yellow
