/**
 * Script untuk memeriksa pola export di semua controller files
 * Memastikan tidak ada exports.namaFungsi yang tersisa
 * 
 * Usage: node scripts/check-controller-exports.js
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

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const fileName = path.basename(filePath);
  
  const issues = [];
  
  // Check for exports.functionName pattern
  const exportsPattern = /exports\.\w+\s*=/g;
  const matches = content.match(exportsPattern);
  
  if (matches) {
    matches.forEach(match => {
      const lineNumber = content.substring(0, content.indexOf(match)).split('\n').length;
      issues.push({
        type: 'exports.functionName',
        line: lineNumber,
        match: match.trim()
      });
    });
  }
  
  // Check for const.functionName typo
  const constTypoPattern = /const\.\w+\s*=/g;
  const typoMatches = content.match(constTypoPattern);
  
  if (typoMatches) {
    typoMatches.forEach(match => {
      const lineNumber = content.substring(0, content.indexOf(match)).split('\n').length;
      issues.push({
        type: 'const.functionName (TYPO)',
        line: lineNumber,
        match: match.trim()
      });
    });
  }
  
  // Check for exports reference in const assignment (e.g., const x = exports.y)
  const exportsRefPattern = /const\s+\w+\s*=\s*exports\.\w+/g;
  const refMatches = content.match(exportsRefPattern);
  
  if (refMatches) {
    refMatches.forEach(match => {
      const lineNumber = content.substring(0, content.indexOf(match)).split('\n').length;
      issues.push({
        type: 'exports reference in const',
        line: lineNumber,
        match: match.trim()
      });
    });
  }
  
  // Check if module.exports exists
  const hasModuleExports = /module\.exports\s*=/.test(content);
  
  return {
    fileName,
    issues,
    hasModuleExports
  };
}

function main() {
  log('\n🔍 Checking Controller Export Patterns\n', 'cyan');
  log('='.repeat(60), 'cyan');
  
  const files = fs.readdirSync(controllersDir)
    .filter(file => file.endsWith('.js') && !file.endsWith('.snippet'));
  
  let totalIssues = 0;
  let filesWithIssues = 0;
  let filesWithoutModuleExports = 0;
  
  files.forEach(file => {
    const filePath = path.join(controllersDir, file);
    const result = checkFile(filePath);
    
    if (result.issues.length > 0 || !result.hasModuleExports) {
      filesWithIssues++;
      
      log(`\n❌ ${result.fileName}`, 'red');
      
      if (result.issues.length > 0) {
        result.issues.forEach(issue => {
          log(`   Line ${issue.line}: ${issue.match}`, 'yellow');
          totalIssues++;
        });
      }
      
      if (!result.hasModuleExports) {
        log(`   ⚠️  Missing module.exports block`, 'yellow');
        filesWithoutModuleExports++;
      }
    } else {
      log(`✓ ${result.fileName}`, 'green');
    }
  });
  
  log('\n' + '='.repeat(60), 'cyan');
  log('\n📊 Summary:', 'cyan');
  log(`Total files checked: ${files.length}`, 'blue');
  log(`Files with issues: ${filesWithIssues}`, filesWithIssues > 0 ? 'red' : 'green');
  log(`Total export issues: ${totalIssues}`, totalIssues > 0 ? 'red' : 'green');
  log(`Files without module.exports: ${filesWithoutModuleExports}`, filesWithoutModuleExports > 0 ? 'yellow' : 'green');
  
  if (filesWithIssues === 0) {
    log('\n✅ All controller files follow the standard export pattern!', 'green');
  } else {
    log('\n⚠️  Some files need to be fixed:', 'yellow');
    log('1. Change exports.functionName to const functionName', 'yellow');
    log('2. Add module.exports = { ... } at the end of file', 'yellow');
    log('3. Fix any const.functionName typos', 'yellow');
  }
  
  log('');
  
  process.exit(filesWithIssues > 0 ? 1 : 0);
}

main();
