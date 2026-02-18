const express = require('express');
const router = express.Router();
const tenantResolver = require('../middleware/tenantResolver');

/**
 * Route untuk testing tenant resolver middleware
 * Endpoint ini menampilkan informasi database yang sedang aktif
 * 
 * Usage:
 * GET /api/test/tenant-info
 * Header: x-tenant-id: cabang-jakarta
 */
router.get('/tenant-info', tenantResolver, async (req, res) => {
  try {
    // Ambil informasi tenant dari middleware
    const { tenant, tenantDB } = req;

    // Dapatkan informasi koneksi database
    const dbInfo = {
      name: tenantDB.name,
      host: tenantDB.host,
      port: tenantDB.port,
      readyState: tenantDB.readyState, // 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
      readyStateText: ['disconnected', 'connected', 'connecting', 'disconnecting'][tenantDB.readyState]
    };

    // Response sukses dengan informasi tenant dan database
    res.json({
      success: true,
      message: 'Tenant berhasil di-resolve',
      data: {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          dbName: tenant.dbName
        },
        database: dbInfo,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[TEST ERROR] Error in tenant-info endpoint:', {
      error: error.message,
      stack: error.stack,
      tenant: req.tenant?.slug
    });

    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil informasi tenant'
    });
  }
});

/**
 * Route untuk testing koneksi database tenant
 * Endpoint ini mencoba melakukan query sederhana ke database tenant
 * 
 * Usage:
 * GET /api/test/db-connection
 * Header: x-tenant-id: cabang-jakarta
 */
router.get('/db-connection', tenantResolver, async (req, res) => {
  try {
    const { tenant, tenantDB } = req;

    // Test koneksi dengan query sederhana
    const collections = await tenantDB.db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    res.json({
      success: true,
      message: 'Koneksi database tenant berhasil',
      data: {
        tenant: tenant.slug,
        dbName: tenant.dbName,
        collections: collectionNames,
        collectionCount: collectionNames.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[TEST ERROR] Error testing database connection:', {
      error: error.message,
      stack: error.stack,
      tenant: req.tenant?.slug
    });

    res.status(500).json({
      success: false,
      message: 'Gagal menguji koneksi database tenant'
    });
  }
});

module.exports = router;
