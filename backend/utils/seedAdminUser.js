const bcrypt = require('bcryptjs');
const Employee = require('../models/Employee');

/**
 * Utility untuk membuat admin user di tenant database
 * Updated for Unified Nexus Architecture - uses Employee model directly with tenant context
 */
const seedAdminUser = async (tenantDB, cafeName, adminData, tenantId) => {
  try {
    console.log('[SEED ADMIN] Membuat admin user...');

    // Cek apakah admin sudah ada
    const existingAdmin = await Employee.findOne({ email: adminData.email });
    if (existingAdmin) {
      console.log('[SEED ADMIN] Admin sudah ada, skip');
      return existingAdmin;
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
      role_access: ['POS', 'Kitchen', 'Meja', 'Keuangan', 'Laporan', 'Menu', 'Pegawai', 'Pengaturan'],
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
    console.log('[SEED ADMIN] ✓ Admin user berhasil dibuat:', admin.email);

    return admin;

  } catch (error) {
    console.error('[SEED ADMIN ERROR]', error);
    throw error;
  }
};

module.exports = { seedAdminUser };
