const bcrypt = require('bcryptjs');

/**
 * Utility untuk membuat admin user di tenant database
 */
const seedAdminUser = async (tenantDB, cafeName, adminData, tenantId) => {
  try {
    console.log('[SEED ADMIN] Membuat admin user...');

    // Load Employee model
    const EmployeeModel = tenantDB.model('Employee', require('../models/Employee').schema);

    // Cek apakah admin sudah ada
    const existingAdmin = await EmployeeModel.findOne({ email: adminData.email });
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
      image: adminData.image || null,
      tenantId: tenantId // Tambahkan tenantId
    };

    const admin = await EmployeeModel.create(newAdmin);
    console.log('[SEED ADMIN] ✓ Admin user berhasil dibuat:', admin.email);

    return admin;

  } catch (error) {
    console.error('[SEED ADMIN ERROR]', error);
    throw error;
  }
};

module.exports = { seedAdminUser };
