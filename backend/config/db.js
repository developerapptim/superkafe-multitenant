const mongoose = require('mongoose');

// Koneksi ke database utama (untuk menyimpan data tenant)
const connectMainDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/superkafe_v2', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log(`[DB] MongoDB Main Database Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`[DB ERROR] Failed to connect to main database: ${error.message}`);
    process.exit(1);
  }
};

// Cache untuk koneksi tenant (connection pooling)
const tenantConnections = {};

// Fungsi untuk mendapatkan koneksi database tenant dengan connection pooling
const getTenantDB = async (dbName) => {
  // Validasi input
  if (!dbName || typeof dbName !== 'string') {
    throw new Error('Database name is required and must be a string');
  }

  // Cek apakah koneksi sudah ada di cache (connection pooling)
  if (tenantConnections[dbName]) {
    // Verifikasi koneksi masih aktif
    if (tenantConnections[dbName].readyState === 1) {
      console.log(`[DB] Reusing cached connection for: ${dbName}`);
      return tenantConnections[dbName];
    } else {
      // Koneksi tidak aktif, hapus dari cache
      console.log(`[DB] Removing stale connection for: ${dbName}`);
      delete tenantConnections[dbName];
    }
  }

  try {
    // Ambil base URI dan ganti nama database
    const baseURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/superkafe_v2';
    const tenantURI = baseURI.replace(/\/[^\/]*(\?.*)?$/, `/${dbName}$1`);

    // Buat koneksi baru untuk tenant
    const tenantDB = mongoose.createConnection(tenantURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10, // Connection pooling
      minPoolSize: 2,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 5000
    });

    // Event listeners untuk monitoring
    tenantDB.on('connected', () => {
      console.log(`[DB] Tenant database connected: ${dbName}`);
    });

    tenantDB.on('error', (err) => {
      console.error(`[DB ERROR] Tenant database error (${dbName}):`, err.message);
    });

    tenantDB.on('disconnected', () => {
      console.log(`[DB] Tenant database disconnected: ${dbName}`);
      delete tenantConnections[dbName];
    });

    // Tunggu koneksi siap
    await new Promise((resolve, reject) => {
      tenantDB.once('open', resolve);
      tenantDB.once('error', reject);
    });

    // Simpan di cache untuk reuse
    tenantConnections[dbName] = tenantDB;
    
    console.log(`[DB] New tenant connection created and cached: ${dbName}`);
    return tenantDB;
  } catch (error) {
    console.error(`[DB ERROR] Failed to connect to tenant database (${dbName}): ${error.message}`);
    throw error;
  }
};

// Fungsi untuk menutup koneksi tenant (untuk cleanup atau maintenance)
const closeTenantDB = async (dbName) => {
  if (tenantConnections[dbName]) {
    try {
      await tenantConnections[dbName].close();
      delete tenantConnections[dbName];
      console.log(`[DB] Tenant connection closed: ${dbName}`);
    } catch (error) {
      console.error(`[DB ERROR] Failed to close tenant connection (${dbName}): ${error.message}`);
    }
  }
};

// Fungsi untuk menutup semua koneksi tenant (untuk graceful shutdown)
const closeAllTenantConnections = async () => {
  const dbNames = Object.keys(tenantConnections);
  console.log(`[DB] Closing ${dbNames.length} tenant connections...`);
  
  await Promise.all(
    dbNames.map(dbName => closeTenantDB(dbName))
  );
  
  console.log('[DB] All tenant connections closed');
};

module.exports = {
  connectMainDB,
  getTenantDB,
  closeTenantDB,
  closeAllTenantConnections
};
