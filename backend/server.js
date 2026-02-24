require('dotenv').config();

// Validate environment variables before any other initialization
const { validateAndExit } = require('./utils/envValidator');
validateAndExit();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const compression = require('compression');

// Initialize App
const app = express();
const http = require('http'); // New: Required for Socket.io
const { Server } = require("socket.io"); // New: Socket.io
const server = http.createServer(app); // New: Create HTTP server

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins (or restrict to frontend URL in prod)
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true
  }
});

// Attach io to app for use in controllers
app.set('io', io);

// Socket.io Connection Handler
io.on('connection', (socket) => {
  console.log('⚡ Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

app.use(compression());
app.use(cors({
  origin: true,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id', 'x-api-key'],
  exposedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id']
}));
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));

// ===== STATIC FILES =====
// Serve uploads folder (images, audio, payments, etc.)
const uploadsPath = path.join(__dirname, 'public', 'uploads');
app.use('/uploads', express.static(uploadsPath));
console.log(`📁 Static uploads folder: ${uploadsPath}`);

// Serve admin and customer static files
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin')));
app.use('/', express.static(path.join(__dirname, 'public', 'customer')));

// ===== DATABASE =====
const MONGODB_URI = process.env.MONGODB_URI;
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log(`✅ Connected to MongoDB (${MONGODB_URI.includes('mongodb+srv') ? 'Atlas' : 'Local'})`))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// ===== ROUTES =====
app.use('/health', require('./routes/healthRoutes')); // Health check endpoint (no auth required)
app.use('/api/inventory', require('./routes/inventoryRoutes'));
app.use('/api/ingredients', require('./routes/inventoryRoutes')); // Alias for legacy support
app.use('/api/gramasi', require('./routes/gramasiRoutes'));
app.use('/api/menu', require('./routes/menuRoutes'));
app.use('/api/recipes', require('./routes/recipeRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/customers', require('./routes/customerRoutes'));
app.use('/api/shifts', require('./routes/shiftRoutes'));
app.use('/api/shift', require('./routes/shiftRoutes')); // Alias for singular (legacy/POS support)
app.use('/api/finance', require('./routes/financeRoutes'));

app.use('/api/tables', require('./routes/tableRoutes'));
app.use('/api/employees', require('./routes/employeeRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));
app.use('/api/admin/audit-logs', require('./routes/auditLogRoutes'));

// New Routes (Refactored)
app.use('/api', require('./routes/authRoutes')); // Mounts /login -> /api/login (LEGACY)
app.use('/api/auth', require('./routes/unifiedAuthRoutes')); // NEW: Unified auth (no tenant)
app.use('/api/setup', require('./routes/setupRoutes')); // NEW: Setup wizard
app.use('/api/auth', require('./routes/googleAuthRoutes')); // Google auth routes (LEGACY)
app.use('/api/auth', require('./routes/globalAuthRoutes')); // Global auth routes (modern system)
app.use('/api/data', require('./routes/dataRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));
app.use('/api/test', require('./routes/test')); // Testing routes untuk tenant resolver
app.use('/api/tenants', require('./routes/tenantRoutes')); // Tenant management routes
app.use('/api/migration', require('./routes/migrationRoutes')); // Migration utilities (legacy user migration)
app.use('/api/payments', require('./routes/paymentRoutes')); // Payment routes (Duitku integration)
app.use('/api/verify', require('./routes/verificationRoutes')); // Email verification routes
app.use('/api/cash', require('./routes/cashRoutes'));
app.use('/api/cash-transactions', require('./routes/cashTransactionRoutes')); // New Link
app.use('/api/expenses', require('./routes/expenseRoutes')); // Refactored OpEx
app.use('/api/debts', require('./routes/debtRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/payroll', require('./routes/payrollRoutes'));
app.use('/api/stats', require('./routes/statsRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/users', require('./routes/userRoutes'));

// ===== START SERVER =====
app.use('/api/feedback', require('./routes/feedbackRoutes'));
app.use('/api/service-request', require('./routes/serviceRequestRoutes'));
app.use('/api/reservations', require('./routes/reservationRoutes'));
app.use('/api', require('./routes/marketingRoutes')); // Marketing: vouchers, banners, apply-voucher

// ===== GLOBAL ERROR HANDLER =====
// This must be after all routes to catch errors from route handlers
app.use((err, req, res, next) => {
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Handle tenant scoping errors
  if (err.code === 'TENANT_MISMATCH') {
    console.error('[TENANT SCOPING ERROR] Cross-tenant modification attempt', {
      requestId,
      severity: 'HIGH',
      error: {
        message: err.message,
        code: err.code
      },
      tenant: req.tenant?.slug || 'unknown',
      userId: req.user?.id || 'unauthenticated',
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString()
    });
    
    return res.status(err.statusCode || 403).json({
      success: false,
      message: 'Unauthorized access to tenant data'
    });
  }
  
  // Handle validation errors
  if (err.name === 'ValidationError') {
    console.warn('[VALIDATION ERROR]', {
      requestId,
      error: err.message,
      tenant: req.tenant?.slug || 'unknown',
      path: req.path,
      timestamp: new Date().toISOString()
    });
    
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  
  // Handle all other errors
  console.error('[UNHANDLED ERROR]', {
    requestId,
    severity: 'ERROR',
    error: {
      message: err.message,
      name: err.name,
      code: err.code,
      stack: err.stack
    },
    tenant: req.tenant?.slug || 'unknown',
    userId: req.user?.id || 'unauthenticated',
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    timestamp: new Date().toISOString()
  });
  
  // Send generic error message to client (don't leak stack trace)
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.statusCode ? err.message : 'Terjadi kesalahan pada server'
  });
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`)); // Listen on server, not app