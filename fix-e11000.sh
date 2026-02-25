#!/bin/bash

# Quick Fix Script for E11000 Error
# This script automates the fix for duplicate key error on dbName field

echo "=========================================="
echo "SuperKafe E11000 Error Fix Script"
echo "=========================================="
echo ""

# Step 1: Verify .env file
echo "Step 1: Checking .env configuration..."
if grep -q "superkafe_v2" backend/.env; then
    echo "✅ .env file is correct (using superkafe_v2)"
else
    echo "❌ .env file needs update"
    echo "Please update MONGODB_URI in backend/.env to use superkafe_v2"
    exit 1
fi
echo ""

# Step 2: Run migration script
echo "Step 2: Running migration script to drop unique indexes..."
cd backend
node scripts/dropDbNameIndexAllDatabases.js
MIGRATION_EXIT_CODE=$?
cd ..

if [ $MIGRATION_EXIT_CODE -eq 0 ]; then
    echo "✅ Migration completed successfully"
else
    echo "❌ Migration failed with exit code $MIGRATION_EXIT_CODE"
    echo "Check logs above for details"
    exit 1
fi
echo ""

# Step 3: Restart backend (optional)
echo "Step 3: Backend restart required"
echo "Please restart your backend server:"
echo "  - If using pm2: pm2 restart superkafe-backend"
echo "  - If using npm: Stop (Ctrl+C) and run 'npm start' again"
echo ""

echo "=========================================="
echo "Fix completed! Next steps:"
echo "1. Restart backend server"
echo "2. Test tenant creation at /setup-cafe"
echo "3. Verify no E11000 errors"
echo "=========================================="
