# Quick Fix Script for E11000 Error (PowerShell)
# This script automates the fix for duplicate key error on dbName field

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "SuperKafe E11000 Error Fix Script" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Verify .env file
Write-Host "Step 1: Checking .env configuration..." -ForegroundColor Yellow
$envContent = Get-Content "backend\.env" -Raw
if ($envContent -match "superkafe_v2") {
    Write-Host "✅ .env file is correct (using superkafe_v2)" -ForegroundColor Green
} else {
    Write-Host "❌ .env file needs update" -ForegroundColor Red
    Write-Host "Please update MONGODB_URI in backend\.env to use superkafe_v2" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 2: Run migration script
Write-Host "Step 2: Running migration script to drop unique indexes..." -ForegroundColor Yellow
Push-Location backend
node scripts/dropDbNameIndexAllDatabases.js
$migrationExitCode = $LASTEXITCODE
Pop-Location

if ($migrationExitCode -eq 0) {
    Write-Host "✅ Migration completed successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Migration failed with exit code $migrationExitCode" -ForegroundColor Red
    Write-Host "Check logs above for details" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 3: Restart backend (optional)
Write-Host "Step 3: Backend restart required" -ForegroundColor Yellow
Write-Host "Please restart your backend server:" -ForegroundColor White
Write-Host "  - If using pm2: pm2 restart superkafe-backend" -ForegroundColor White
Write-Host "  - If using npm: Stop (Ctrl+C) and run 'npm start' again" -ForegroundColor White
Write-Host ""

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Fix completed! Next steps:" -ForegroundColor Green
Write-Host "1. Restart backend server" -ForegroundColor White
Write-Host "2. Test tenant creation at /setup-cafe" -ForegroundColor White
Write-Host "3. Verify no E11000 errors" -ForegroundColor White
Write-Host "==========================================" -ForegroundColor Cyan
