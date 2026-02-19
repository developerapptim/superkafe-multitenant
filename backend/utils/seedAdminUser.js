const bcrypt = require('bcryptjs');

/**
 * Utility function untuk membuat user admin di database tenant
 * Digunakan oleh TenantController dan seedTenant script
 */
const seedAdminUser = async (tenantDB, tenantName, userData = {}) => {
  try {
    console.log('[SEED ADMIN] Memulai seeding user admin...');
    
    // Load Employee model untuk tenant database
    const EmployeeModel = tenantDB.model('Employee', require('../models/Employee').schema);
    
    // Cek apakah admin dengan email/username sudah ada
    const existingAdmin = await EmployeeModel.findOne({
      $or: [
        { username: userData.username || 'admin' },
        { email: userData.email }
      ]
    });
    
    if (existingAdmin) {
      console.log('[SEED ADMIN] User admin sudah ada di database tenant');
      return {
        success: true,
        existed: true,
        admin: {
          id: existingAdmin.id,
          username: existingAdmin.username,
          email: existingAdmin.email,
          name: existingAdmin.name,
          role: existingAdmin.role
        }
      };
    }
    
    // Hash password
    let hashedPassword;
    if (userData.password) {
      // Password dari user input
      hashedPassword = await bcrypt.hash(userData.password, 10);
    } else {
      // Password default untuk script seeding
      const defaultPassword = 'admin123';
      hashedPassword = await bcrypt.hash(defaultPassword, 10);
    }
    
    // Generate unique ID untuk employee
    const employeeId = `EMP-${Date.now()}`;
    
    // Data admin
    const adminData = {
      id: employeeId,
      username: userData.username || 'admin',
      email: userData.email || null,
      password: hashedPassword,
      name: userData.name || 'Administrator',
      role: 'admin',
      role_access: ['POS', 'Kitchen', 'Meja', 'Keuangan', 'Laporan', 'Menu', 'Pegawai', 'Pengaturan'],
      phone: userData.phone || '',
      address: '',
      salary: 0,
      daily_rate: 0,
      status: 'active',
      is_logged_in: false,
      isActive: true,
      isVerified: userData.isVerified || false, // Default false, perlu verifikasi email
      authProvider: userData.authProvider || 'local',
      googleId: userData.googleId || null
    };
    
    // Buat user admin
    const newAdmin = await EmployeeModel.create(adminData);
    
    console.log('[SEED ADMIN] ✓ User admin berhasil dibuat!');
    
    return {
      success: true,
      existed: false,
      admin: {
        id: newAdmin.id,
        username: newAdmin.username,
        email: newAdmin.email,
        name: newAdmin.name,
        role: newAdmin.role,
        isVerified: newAdmin.isVerified
      },
      credentials: userData.password ? null : {
        username: 'admin',
        password: 'admin123' // Return plain password hanya untuk script seeding
      }
    };
    
  } catch (error) {
    console.error('[SEED ADMIN ERROR] Gagal seeding user admin:', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};

module.exports = { seedAdminUser };
