const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
require('dotenv').config();

/**
 * Script untuk inisialisasi Single Database Architecture
 * 
 * Membuat:
 * 1. Tenant "Negoes" di collection tenants
 * 2. User admin untuk tenant tersebut
 * 3. Employee di collection employees dengan tenantId
 */

async function initSingleDatabase() {
  try {
    console.log('🚀 Starting Single Database Initialization...\n');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://root:developerapptim1@127.0.0.1:27018/superkafe_v2?authSource=admin');
    console.log('✅ Connected to MongoDB:', mongoose.connection.name);

    // 1. Create Tenant
    console.log('\n📦 Creating Tenant...');
    
    // Check if tenant already exists
    let tenant = await Tenant.findOne({ slug: 'negoes' });
    
    if (tenant) {
      console.log('⚠️  Tenant "negoes" already exists');
      console.log('   ID:', tenant._id);
      console.log('   Name:', tenant.name);
      console.log('   Active:', tenant.isActive);
    } else {
      tenant = await Tenant.create({
        name: 'Negoes',
        slug: 'negoes',
        dbName: 'superkafe_v2', // Single database
        isActive: true,
        ownerEmail: 'admin@negoes.com',
        subscriptionPlan: 'trial',
        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('✅ Tenant created successfully');
      console.log('   ID:', tenant._id);
      console.log('   Slug:', tenant.slug);
      console.log('   Name:', tenant.name);
    }

    // 2. Create User (if not exists)
    console.log('\n👤 Creating User...');
    
    let user = await User.findOne({ email: 'admin@negoes.com' });
    
    if (user) {
      console.log('⚠️  User already exists');
      console.log('   Email:', user.email);
      console.log('   Has Completed Setup:', user.hasCompletedSetup);
      
      // Update user with tenant info if not set
      if (!user.tenantId || !user.tenantSlug) {
        user.tenantId = tenant._id;
        user.tenantSlug = tenant.slug;
        user.hasCompletedSetup = true;
        await user.save();
        console.log('✅ User updated with tenant info');
      }
    } else {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      user = await User.create({
        email: 'admin@negoes.com',
        password: hashedPassword,
        name: 'Admin Negoes',
        authProvider: 'local',
        isVerified: true,
        hasCompletedSetup: true,
        tenantId: tenant._id,
        tenantSlug: tenant.slug,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('✅ User created successfully');
      console.log('   Email:', user.email);
      console.log('   Password: admin123 (please change after first login)');
    }

    // 3. Create Employee (with tenantId)
    console.log('\n👨‍💼 Creating Employee...');
    
    const Employee = mongoose.model('Employee', require('../models/Employee').schema);
    
    let employee = await Employee.findOne({ 
      email: 'admin@negoes.com',
      tenantId: tenant._id 
    });
    
    if (employee) {
      console.log('⚠️  Employee already exists');
      console.log('   Email:', employee.email);
      console.log('   Role:', employee.role);
    } else {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      employee = await Employee.create({
        tenantId: tenant._id, // CRITICAL: tenantId for isolation
        id: `emp_${Date.now()}`, // Required field
        email: 'admin@negoes.com',
        password: hashedPassword,
        name: 'Admin Negoes',
        username: 'admin',
        role: 'admin',
        role_access: ['POS', 'Kitchen', 'Meja', 'Keuangan', 'Laporan', 'Menu', 'Pengaturan'], // Array of strings
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('✅ Employee created successfully');
      console.log('   Email:', employee.email);
      console.log('   Role:', employee.role);
      console.log('   TenantId:', employee.tenantId);
    }

    // 4. Create Sample Menu Items (with tenantId)
    console.log('\n🍽️  Creating Sample Menu Items...');
    
    const MenuItem = mongoose.model('MenuItem', require('../models/MenuItem').schema);
    const Category = mongoose.model('Category', require('../models/Category').schema);
    
    // Create category first
    let category = await Category.findOne({ 
      id: 'cat_coffee',
      tenantId: tenant._id 
    });
    
    if (!category) {
      category = await Category.create({
        tenantId: tenant._id,
        id: 'cat_coffee',
        name: 'Kopi',
        emoji: '☕',
        order: 1
      });
      console.log('✅ Category "Kopi" created');
    }
    
    // Create sample menu items
    const sampleMenuItems = [
      {
        tenantId: tenant._id,
        id: 'menu_kopi_susu',
        name: 'Kopi Susu',
        price: 15000,
        base_price: 10000,
        category: 'cat_coffee',
        categoryId: category._id,
        description: 'Kopi susu nikmat',
        is_active: true,
        use_stock_check: false,
        order: 1
      },
      {
        tenantId: tenant._id,
        id: 'menu_kopi_hitam',
        name: 'Kopi Hitam',
        price: 12000,
        base_price: 8000,
        category: 'cat_coffee',
        categoryId: category._id,
        description: 'Kopi hitam original',
        is_active: true,
        use_stock_check: false,
        order: 2
      },
      {
        tenantId: tenant._id,
        id: 'menu_es_kopi',
        name: 'Es Kopi',
        price: 18000,
        base_price: 12000,
        category: 'cat_coffee',
        categoryId: category._id,
        description: 'Kopi dingin segar',
        is_active: true,
        use_stock_check: false,
        order: 3
      }
    ];
    
    for (const item of sampleMenuItems) {
      const existing = await MenuItem.findOne({ 
        id: item.id,
        tenantId: tenant._id 
      });
      
      if (!existing) {
        await MenuItem.create(item);
        console.log(`✅ Menu item "${item.name}" created`);
      } else {
        console.log(`⚠️  Menu item "${item.name}" already exists`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ INITIALIZATION COMPLETE!');
    console.log('='.repeat(60));
    console.log('\n📊 Summary:');
    console.log('   Database:', mongoose.connection.name);
    console.log('   Tenant:', tenant.name, `(${tenant.slug})`);
    console.log('   Tenant ID:', tenant._id);
    console.log('   User:', user.email);
    console.log('   Employee:', employee.email, `(${employee.role})`);
    console.log('\n🔐 Login Credentials:');
    console.log('   Email: admin@negoes.com');
    console.log('   Password: admin123');
    console.log('\n🌐 Access:');
    console.log('   Frontend: http://localhost:5174/auth/login');
    console.log('   Dashboard: http://localhost:5174/negoes/admin/dashboard');
    console.log('\n⚠️  IMPORTANT:');
    console.log('   1. Restart backend server');
    console.log('   2. Clear browser localStorage');
    console.log('   3. Login with credentials above');
    console.log('   4. Change password after first login');
    console.log('\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during initialization:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run initialization
initSingleDatabase();
