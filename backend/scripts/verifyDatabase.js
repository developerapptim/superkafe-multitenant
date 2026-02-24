const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Employee = require('../models/Employee');
const MenuItem = require('../models/MenuItem');
const Category = require('../models/Category');
require('dotenv').config();

/**
 * Script untuk verifikasi database setelah inisialisasi
 */

async function verifyDatabase() {
  try {
    console.log('🔍 Starting Database Verification...\n');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://root:developerapptim1@127.0.0.1:27018/superkafe_v2?authSource=admin');
    console.log('✅ Connected to MongoDB:', mongoose.connection.name);

    // 1. Verify Tenant
    console.log('\n📦 Verifying Tenant...');
    const tenant = await Tenant.findOne({ slug: 'negoes' });
    
    if (tenant) {
      console.log('✅ Tenant found:');
      console.log('   ID:', tenant._id);
      console.log('   Slug:', tenant.slug);
      console.log('   Name:', tenant.name);
      console.log('   Active:', tenant.isActive);
      console.log('   DB Name:', tenant.dbName);
    } else {
      console.log('❌ Tenant NOT found!');
      process.exit(1);
    }

    // 2. Verify User
    console.log('\n👤 Verifying User...');
    const user = await User.findOne({ email: 'admin@negoes.com' });
    
    if (user) {
      console.log('✅ User found:');
      console.log('   Email:', user.email);
      console.log('   Name:', user.name);
      console.log('   Has Completed Setup:', user.hasCompletedSetup);
      console.log('   Tenant ID:', user.tenantId);
      console.log('   Tenant Slug:', user.tenantSlug);
    } else {
      console.log('❌ User NOT found!');
      process.exit(1);
    }

    // 3. Verify Employee (with manual tenantId filter since we're not in request context)
    console.log('\n👨‍💼 Verifying Employee...');
    const employee = await Employee.findOne({ 
      email: 'admin@negoes.com',
      tenantId: tenant._id 
    });
    
    if (employee) {
      console.log('✅ Employee found:');
      console.log('   ID:', employee.id);
      console.log('   Email:', employee.email);
      console.log('   Name:', employee.name);
      console.log('   Role:', employee.role);
      console.log('   Tenant ID:', employee.tenantId);
      console.log('   Role Access:', employee.role_access);
    } else {
      console.log('❌ Employee NOT found!');
      process.exit(1);
    }

    // 4. Verify Categories
    console.log('\n📂 Verifying Categories...');
    const categories = await Category.find({ tenantId: tenant._id });
    
    if (categories.length > 0) {
      console.log(`✅ Found ${categories.length} categories:`);
      categories.forEach(cat => {
        console.log(`   - ${cat.name} (${cat.id})`);
      });
    } else {
      console.log('⚠️  No categories found');
    }

    // 5. Verify Menu Items
    console.log('\n🍽️  Verifying Menu Items...');
    const menuItems = await MenuItem.find({ tenantId: tenant._id });
    
    if (menuItems.length > 0) {
      console.log(`✅ Found ${menuItems.length} menu items:`);
      menuItems.forEach(item => {
        console.log(`   - ${item.name} (Rp ${item.price.toLocaleString('id-ID')})`);
      });
    } else {
      console.log('⚠️  No menu items found');
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ DATABASE VERIFICATION COMPLETE!');
    console.log('='.repeat(60));
    console.log('\n📊 Summary:');
    console.log('   Database:', mongoose.connection.name);
    console.log('   Tenant:', tenant.name, `(${tenant.slug})`);
    console.log('   User:', user.email);
    console.log('   Employee:', employee.email, `(${employee.role})`);
    console.log('   Categories:', categories.length);
    console.log('   Menu Items:', menuItems.length);
    console.log('\n✅ All data verified successfully!');
    console.log('\n🚀 Next Steps:');
    console.log('   1. Restart backend server: cd backend && npm start');
    console.log('   2. Clear browser localStorage');
    console.log('   3. Login at: http://localhost:5174/auth/login');
    console.log('   4. Email: admin@negoes.com');
    console.log('   5. Password: admin123');
    console.log('\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during verification:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run verification
verifyDatabase();
