/**
 * Script to verify that all tenant-scoped models have proper compound indexes
 * Task 5.3: Create indexes on tenantId fields
 */

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Load all models
const modelsDir = path.join(__dirname, '../models');
const modelFiles = fs.readdirSync(modelsDir).filter(file => file.endsWith('.js'));

console.log('🔍 Verifying compound indexes on tenant-scoped models...\n');

// Models that should NOT have tenant scoping
const globalModels = ['User', 'Tenant'];

// Load all models
modelFiles.forEach(file => {
    require(path.join(modelsDir, file));
});

// Get all registered models
const models = mongoose.modelNames();

let totalModels = 0;
let modelsWithIndexes = 0;
let modelsWithoutIndexes = 0;
let globalModelCount = 0;

console.log('📊 Index Verification Report:\n');
console.log('=' .repeat(80));

models.forEach(modelName => {
    const Model = mongoose.model(modelName);
    const indexes = Model.schema.indexes();
    
    // Check if this is a global model
    if (globalModels.includes(modelName)) {
        console.log(`⚪ ${modelName.padEnd(25)} - GLOBAL MODEL (no tenant scoping expected)`);
        globalModelCount++;
        return;
    }
    
    totalModels++;
    
    // Check for tenantId compound indexes
    const tenantIndexes = indexes.filter(index => {
        const fields = index[0];
        return fields.tenantId !== undefined;
    });
    
    if (tenantIndexes.length > 0) {
        console.log(`✅ ${modelName.padEnd(25)} - ${tenantIndexes.length} compound index(es)`);
        tenantIndexes.forEach(idx => {
            const fields = Object.keys(idx[0]).join(', ');
            console.log(`   └─ {${fields}}`);
        });
        modelsWithIndexes++;
    } else {
        console.log(`❌ ${modelName.padEnd(25)} - NO compound indexes found`);
        modelsWithoutIndexes++;
    }
});

console.log('=' .repeat(80));
console.log('\n📈 Summary:');
console.log(`   Total tenant-scoped models: ${totalModels}`);
console.log(`   Models with compound indexes: ${modelsWithIndexes}`);
console.log(`   Models without compound indexes: ${modelsWithoutIndexes}`);
console.log(`   Global models (excluded): ${globalModelCount}`);

if (modelsWithoutIndexes === 0) {
    console.log('\n✅ SUCCESS: All tenant-scoped models have compound indexes!');
    process.exit(0);
} else {
    console.log('\n⚠️  WARNING: Some models are missing compound indexes.');
    process.exit(1);
}
