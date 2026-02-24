const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Employee = require('../models/Employee');
const MenuItem = require('../models/MenuItem');
const Category = require('../models/Category');
const bcrypt = require('bcryptjs');
const { setTenantContext } = require('../utils/tenantContext');
require('dotenv').config();

/**
 * Init Universe Script - Zero-to-One Initialization
 * 
 * Creates the first tenant "Negoes" with complete setup:
 * 1. Tenant record in superkafe_v2
 * 2. Admin user with credentials
 * 3. Employee record linked to tenant
 * 4. Basic menu categories and items
 * 
 * Features:
 * - Idempotent (safe to run multiple times)
 * - Comprehensive error handling
 * - Detailed success/failure reporting
 * - Rollback on errors
 */

async function initUniverse() {
  let session = null;
  let useTransactions = false;
  
  try {
    console.log('🌌 Starting Universe Initialization...\n');

    // Step 1: Connect to Database
    console.log('📡 Connecting to database...');
    const mongoUri = process.env.MONGODB_URI || 'mongodb://root:developerapptim1@127.0.0.1:27018/superkafe_v2?authSource=admin';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to:', mongoose.connection.name);
    
    // Validate we're connected to superkafe_v2
    if (mongoose.connection.name !== 'superkafe_v2') {
      throw new Error(`Expected database 'superkafe_v2' but connected to '${mongoose.connection.name}'`);
    }

    // Check if replica set is available for transactions
    try {
      const admin = mongoose.connection.db.admin();
      const serverStatus = await admin.serverStatus();
      useTransactions = serverStatus.repl && serverStatus.repl.setName;
      
      if (useTransactions) {
        session = await mongoose.startSession();
        session.startTransaction();
        console.log('✅ Using transactions (replica set detected)');
      } else {
        console.log('⚠️  Transactions disabled (standalone MongoDB)');
      }
    } catch (err) {
      console.log('⚠️  Transactions disabled (could not detect replica set)');
      useTransactions = false;
    }

    // Step 2: Create Tenant
    console.log('\n📦 Creating Tenant "Negoes"...');
    let tenant = await Tenant.findOne({ slug: 'negoes' }).session(session || undefined);
    let tenantCreated = false;
    
    if (tenant) {
      console.log('⚠️  Tenant "negoes" already exists');
      console.log('   ID:', tenant._id);
      console.log('   Name:', tenant.name);
      console.log('   Status:', tenant.status);
      console.log('   Active:', tenant.isActive);
    } else {
      const tenantData = {
        name: 'Negoes',
        slug: 'negoes',
        dbName: 'superkafe_v2',
        isActive: true,
        status: 'trial',
        trialExpiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      if (useTransactions) {
        tenant = await Tenant.create([tenantData], { session });
        tenant = tenant[0];
      } else {
        tenant = await Tenant.create(tenantData);
      }
      
      tenantCreated = true;
      console.log('✅ Tenant created successfully');
      console.log('   ID:', tenant._id);
      console.log('   Slug:', tenant.slug);
      console.log('   Name:', tenant.name);
      console.log('   Trial expires:', tenant.trialExpiresAt.toISOString());
    }

    // Set tenant context for subsequent operations
    setTenantContext({
      id: tenant._id.toString(),
      slug: tenant.slug,
      name: tenant.name,
      dbName: tenant.dbName
    });

    // Step 3: Create User
    console.log('\n👤 Creating Admin User...');
    let user = await User.findOne({ email: 'admin@negoes.com' }).session(session || undefined);
    let userCreated = false;
    
    if (user) {
      console.log('⚠️  User already exists');
      console.log('   Email:', user.email);
      console.log('   Name:', user.name);
      console.log('   Has Completed Setup:', user.hasCompletedSetup);
      
      // Update user with tenant info if not set
      if (!user.tenantId || !user.tenantSlug || !user.hasCompletedSetup) {
        user.tenantId = tenant._id;
        user.tenantSlug = tenant.slug;
        user.hasCompletedSetup = true;
        await user.save({ session: session || undefined });
        console.log('✅ User updated with tenant info');
      }
    } else {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      const userData = {
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
      };
      
      if (useTransactions) {
        user = await User.create([userData], { session });
        user = user[0];
      } else {
        user = await User.create(userData);
      }
      
      userCreated = true;
      console.log('✅ User created successfully');
      console.log('   Email:', user.email);
      console.log('   Name:', user.name);
    }

    // Step 4: Create Employee
    console.log('\n👨‍💼 Creating Employee...');
    let employee = await Employee.findOne({ 
      email: 'admin@negoes.com',
      tenantId: tenant._id 
    }).session(session || undefined);
    let employeeCreated = false;
    
    if (employee) {
      console.log('⚠️  Employee already exists');
      console.log('   Email:', employee.email);
      console.log('   Name:', employee.name);
      console.log('   Role:', employee.role);
      console.log('   TenantId:', employee.tenantId);
    } else {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      const employeeData = {
        tenantId: tenant._id,
        id: `emp_${Date.now()}`,
        email: 'admin@negoes.com',
        password: hashedPassword,
        name: 'Admin Negoes',
        username: 'admin',
        role: 'admin',
        role_access: ['POS', 'Kitchen', 'Meja', 'Keuangan', 'Laporan', 'Menu', 'Pengaturan'],
        isActive: true,
        isVerified: true,
        authProvider: 'local',
        createdAt: new Date()
      };
      
      if (useTransactions) {
        employee = await Employee.create([employeeData], { session });
        employee = employee[0];
      } else {
        employee = await Employee.create(employeeData);
      }
      
      employeeCreated = true;
      console.log('✅ Employee created successfully');
      console.log('   Email:', employee.email);
      console.log('   Name:', employee.name);
      console.log('   Role:', employee.role);
      console.log('   TenantId:', employee.tenantId);
    }

    // Step 5: Create Menu Category
    console.log('\n🍽️  Creating Menu Category...');
    let category = await Category.findOne({ 
      id: 'cat_coffee',
      tenantId: tenant._id 
    }).session(session || undefined);
    let categoryCreated = false;
    
    if (category) {
      console.log('⚠️  Category "Kopi" already exists');
      console.log('   ID:', category.id);
      console.log('   Name:', category.name);
    } else {
      const categoryData = {
        tenantId: tenant._id,
        id: 'cat_coffee',
        name: 'Kopi',
        emoji: '☕',
        order: 1,
        createdAt: new Date()
      };
      
      if (useTransactions) {
        category = await Category.create([categoryData], { session });
        category = category[0];
      } else {
        category = await Category.create(categoryData);
      }
      
      categoryCreated = true;
      console.log('✅ Category "Kopi" created');
      console.log('   ID:', category.id);
      console.log('   Name:', category.name);
    }

    // Step 6: Create Menu Items
    console.log('\n🍵 Creating Menu Items...');
    const sampleMenuItems = [
      {
        tenantId: tenant._id,
        id: 'menu_kopi_susu',
        name: 'Kopi Susu',
        price: 15000,
        base_price: 10000,
        category: 'cat_coffee',
        categoryId: category.id,
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
        categoryId: category.id,
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
        categoryId: category.id,
        description: 'Kopi dingin segar',
        is_active: true,
        use_stock_check: false,
        order: 3
      }
    ];
    
    let menuItemsCreated = 0;
    let menuItemsSkipped = 0;
    
    for (const itemData of sampleMenuItems) {
      const existing = await MenuItem.findOne({ 
        id: itemData.id,
        tenantId: tenant._id 
      }).session(session || undefined);
      
      if (existing) {
        console.log(`⚠️  Menu item "${itemData.name}" already exists`);
        menuItemsSkipped++;
      } else {
        if (useTransactions) {
          await MenuItem.create([itemData], { session });
        } else {
          await MenuItem.create(itemData);
        }
        console.log(`✅ Menu item "${itemData.name}" created`);
        menuItemsCreated++;
      }
    }

    // Commit transaction if using transactions
    if (useTransactions && session) {
      await session.commitTransaction();
      console.log('✅ Transaction committed');
    }

    // Step 7: Success Summary
    console.log('\n' + '='.repeat(70));
    console.log('✅ UNIVERSE INITIALIZATION COMPLETE!');
    console.log('='.repeat(70));
    
    console.log('\n📊 Summary:');
    console.log('   Database:', mongoose.connection.name);
    console.log('   Tenant:', tenant.name, `(${tenant.slug})`);
    console.log('   Tenant ID:', tenant._id);
    console.log('   Status:', tenant.status);
    console.log('   Trial Expires:', tenant.trialExpiresAt.toISOString());
    
    console.log('\n📝 Created/Updated:');
    console.log('   Tenant:', tenantCreated ? '✅ Created' : '⚠️  Already exists');
    console.log('   User:', userCreated ? '✅ Created' : '⚠️  Already exists');
    console.log('   Employee:', employeeCreated ? '✅ Created' : '⚠️  Already exists');
    console.log('   Category:', categoryCreated ? '✅ Created' : '⚠️  Already exists');
    console.log('   Menu Items:', `${menuItemsCreated} created, ${menuItemsSkipped} skipped`);
    
    console.log('\n🔐 Login Credentials:');
    console.log('   Email: admin@negoes.com');
    console.log('   Password: admin123');
    
    console.log('\n🌐 Access URLs:');
    console.log('   Frontend: http://localhost:5174/auth/login');
    console.log('   Dashboard: http://localhost:5174/negoes/admin/dashboard');
    
    console.log('\n⚠️  IMPORTANT NEXT STEPS:');
    console.log('   1. Restart backend server to apply changes');
    console.log('   2. Clear browser localStorage');
    console.log('   3. Login with credentials above');
    console.log('   4. Change password after first login');
    console.log('   5. Configure tenant settings as needed');
    
    console.log('\n');

    return {
      success: true,
      tenant: {
        id: tenant._id.toString(),
        slug: tenant.slug,
        name: tenant.name,
        status: tenant.status
      },
      user: {
        email: user.email,
        name: user.name
      },
      employee: {
        email: employee.email,
        role: employee.role
      },
      menuItems: menuItemsCreated + menuItemsSkipped,
      message: 'Universe initialization completed successfully'
    };

  } catch (error) {
    // Rollback transaction on error
    if (session) {
      await session.abortTransaction();
    }
    
    console.error('\n' + '='.repeat(70));
    console.error('❌ INITIALIZATION FAILED');
    console.error('='.repeat(70));
    console.error('\n🔥 Error:', error.message);
    console.error('\n📋 Stack Trace:');
    console.error(error.stack);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Verify MongoDB is running');
    console.error('   2. Check MONGODB_URI in .env file');
    console.error('   3. Ensure database superkafe_v2 exists');
    console.error('   4. Verify network connectivity to MongoDB');
    console.error('   5. Check MongoDB logs for errors');
    console.error('\n');
    
    return {
      success: false,
      message: error.message,
      error: error.stack
    };
  } finally {
    if (session) {
      await session.endSession();
    }
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run initialization if called directly
if (require.main === module) {
  initUniverse()
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = initUniverse;
