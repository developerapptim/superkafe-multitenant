const bcrypt = require('bcryptjs');
const Employee = require('../models/Employee');

/**
 * Utility untuk membuat admin user di tenant database
 * Updated for Unified Nexus Architecture - uses Employee model directly with tenant context
 */
const seedAdminUser = async (tenantDB, cafeName, adminData, tenantId) => {
  try {
    console.log('[SEED ADMIN] Membuat admin user...', {
      email: adminData.email,
      tenantId: tenantId
    });

    // Cek apakah admin sudah ada
    const existingAdmin = await Employee.findOne({ email: adminData.email });
    if (existingAdmin) {
      console.log('[SEED ADMIN] Admin sudah ada, skip');
      return {
        existed: true,
        admin: existingAdmin
      };
    }

    // Generate employee ID
    const employeeId = `EMP-${Date.now()}`;

    // Prepare admin data
    const newAdmin = {
      id: employeeId,
      username: adminData.username || adminData.email.split('@')[0],
      email: adminData.email,
      password: adminData.password, // Sudah hashed atau null (Google)
      name: adminData.name || 'Administrator',
      role: 'admin',
      role_access: ['*'], // Full access for admin
      phone: '',
      address: '',
      salary: 0,
      daily_rate: 0,
      status: 'active',
      is_logged_in: false,
      isActive: true,
      isVerified: adminData.isVerified || false,
      authProvider: adminData.authProvider || 'local',
      googleId: adminData.googleId || null,
      image: adminData.image || null
      // tenantId will be auto-stamped by tenant scoping plugin
    };

    const admin = await Employee.create(newAdmin);
    console.log('[SEED ADMIN] ✓ Admin user berhasil dibuat:', {
      email: admin.email,
      id: admin.id,
      role: admin.role
    });

    return {
      existed: false,
      admin: admin
    };

  } catch (error) {
    console.error('[SEED ADMIN ERROR]', {
      error: error.message,
      stack: error.stack,
      email: adminData?.email
    });
    throw error;
  }
};

module.exports = { seedAdminUser };
