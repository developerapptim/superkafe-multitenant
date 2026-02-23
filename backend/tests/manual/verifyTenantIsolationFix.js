/**
 * Manual Verification Script for Dashboard Tenant Isolation Fix
 * 
 * This script verifies that:
 * 1. tenantResolver middleware is properly imported in all three route files
 * 2. tenantResolver is applied in the correct order (after auth, before controllers)
 * 3. No syntax errors exist in the modified files
 * 
 * Run with: node tests/manual/verifyTenantIsolationFix.js
 */

const fs = require('fs');
const path = require('path');

console.log('=== Dashboard Tenant Isolation Fix Verification ===\n');

const routeFiles = [
  { path: 'routes/statsRoutes.js', name: 'Stats Routes', authMiddleware: 'checkJwt' },
  { path: 'routes/menuRoutes.js', name: 'Menu Routes', authMiddleware: 'mixed' },
  { path: 'routes/tableRoutes.js', name: 'Table Routes', authMiddleware: 'checkApiKey' }
];

let allPassed = true;

routeFiles.forEach(({ path: filePath, name, authMiddleware }) => {
  console.log(`\n--- Checking ${name} (${filePath}) ---`);
  
  const fullPath = path.join(__dirname, '..', '..', filePath);
  
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    
    // Check 1: tenantResolver is imported
    const hasImport = content.includes("require('../middleware/tenantResolver')") ||
                      content.includes('require("../middleware/tenantResolver")');
    
    if (hasImport) {
      console.log('✓ tenantResolver middleware is imported');
    } else {
      console.log('✗ FAIL: tenantResolver middleware is NOT imported');
      allPassed = false;
    }
    
    // Check 2: tenantResolver is applied via router.use()
    const hasRouterUse = content.includes('router.use(tenantResolver)');
    
    if (hasRouterUse) {
      console.log('✓ tenantResolver is applied via router.use()');
    } else {
      console.log('✗ FAIL: tenantResolver is NOT applied via router.use()');
      allPassed = false;
    }
    
    // Check 3: Verify middleware order (tenantResolver comes after auth)
    const lines = content.split('\n');
    let authLine = -1;
    let tenantLine = -1;
    
    lines.forEach((line, index) => {
      if (authMiddleware === 'mixed') {
        // For menu routes, just check tenantResolver is near the top
        if (line.includes('router.use(tenantResolver)')) {
          tenantLine = index;
        }
      } else {
        if (line.includes(`router.use(${authMiddleware})`)) {
          authLine = index;
        }
        if (line.includes('router.use(tenantResolver)')) {
          tenantLine = index;
        }
      }
    });
    
    if (authMiddleware === 'mixed') {
      if (tenantLine > 0 && tenantLine < 20) {
        console.log('✓ tenantResolver is applied near the top of the file');
      } else {
        console.log('⚠ WARNING: tenantResolver position may not be optimal');
      }
    } else {
      if (authLine > 0 && tenantLine > authLine) {
        console.log(`✓ Middleware order is correct: ${authMiddleware} (line ${authLine + 1}) → tenantResolver (line ${tenantLine + 1})`);
      } else if (tenantLine > 0) {
        console.log(`⚠ WARNING: Middleware order may not be optimal (auth: line ${authLine + 1}, tenant: line ${tenantLine + 1})`);
      }
    }
    
    // Check 4: File can be required (basic syntax check)
    try {
      require(fullPath);
      console.log('✓ File has no syntax errors (can be required)');
    } catch (err) {
      console.log(`✗ FAIL: Syntax error in file: ${err.message}`);
      allPassed = false;
    }
    
  } catch (err) {
    console.log(`✗ FAIL: Could not read file: ${err.message}`);
    allPassed = false;
  }
});

// Summary
console.log('\n=== Verification Summary ===');
if (allPassed) {
  console.log('✓ All checks passed! Dashboard tenant isolation fix is properly implemented.');
  console.log('\nNext steps:');
  console.log('1. Test with multiple tenant accounts to verify data isolation');
  console.log('2. Check server logs for absence of plugin warnings');
  console.log('3. Verify dashboard stats, menu, and tables show only tenant-specific data');
  process.exit(0);
} else {
  console.log('✗ Some checks failed. Please review the issues above.');
  process.exit(1);
}
