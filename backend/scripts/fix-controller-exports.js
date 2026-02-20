/**
 * Script untuk memperbaiki pola export di semua controller files secara otomatis
 * 
 * Usage: node scripts/fix-controller-exports.js
 */

const fs = require('fs');
const path = require('path');

const controllersDir = path.join(__dirname, '../controllers');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function fixFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const fileName = path.basename(filePath);
  
  let modified = content;
  const functionNames = [];
  
  // Step 1: Find all exports.functionName patterns and collect function names
  const exportsPattern = /exports\.(\w+)\s*=/g;
  let match;
  
  while ((match = exportsPattern.exec(content)) !== null) {
    functionNames.push(match[1]);
  }
  
  if (functionNames.length === 0) {
    return { fileName, modified: false, functionCount: 0 };
  }
  
  // Step 2: Replace exports.functionName with const functionName
  modified = modified.replace(/exports\.(\w+)\s*=/g, 'const $1 =');
  
  // Step 3: Check if module.exports already exists
  const hasModuleExports = /module\.exports\s*=/.test(modified);
  
  // Step 4: Add module.exports at the end if not exists
  if (!hasModuleExports) {
    // Remove trailing whitespace and ensure single newline at end
    modified = modified.trimEnd();
    
    // Add module.exports block
    modified += '\n\nmodule.exports = {\n';
    functionNames.forEach((name, index) => {
      if (index === functionNames.length - 1) {
        modified += `  ${name}\n`;
      } else {
        modified += `  ${name},\n`;
      }
    });
    modified += '};\n';
  }
  
  // Step 5: Write back to file
  fs.writeFileSync(filePath, modified, 'utf8');
  
  return { fileName, modified: true, functionCount: functionNames.length };
}

function main() {
  log('\n🔧 Fixing Controller Export Patterns\n', 'cyan');
  log('='.repeat(60), 'cyan');
  
  const files = fs.readdirSync(controllersDir)
    .filter(file => file.endsWith('.js') && !file.endsWith('.snippet'));
  
  let totalFixed = 0;
  let totalFunctions = 0;
  
  files.forEach(file => {
    const filePath = path.join(controllersDir, file);
    const result = fixFile(filePath);
    
    if (result.modified) {
      log(`✓ Fixed ${result.fileName} (${result.functionCount} functions)`, 'green');
      totalFixed++;
      totalFunctions += result.functionCount;
    } else {
      log(`  ${result.fileName} - No changes needed`, 'blue');
    }
  });
  
  log('\n' + '='.repeat(60), 'cyan');
  log('\n📊 Summary:', 'cyan');
  log(`Total files processed: ${files.length}`, 'blue');
  log(`Files fixed: ${totalFixed}`, 'green');
  log(`Total functions converted: ${totalFunctions}`, 'green');
  
  if (totalFixed > 0) {
    log('\n✅ All controller files have been standardized!', 'green');
    log('\nNext steps:', 'yellow');
    log('1. Run: node scripts/check-controller-exports.js', 'cyan');
    log('2. Test your application to ensure everything works', 'cyan');
  } else {
    log('\n✅ All files were already using the standard pattern!', 'green');
  }
  
  log('');
}

main();
