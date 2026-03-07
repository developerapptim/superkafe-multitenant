require('dotenv').config();

// Validate environment variables before any other initialization
const { validateAndExit } = require('./utils/envValidator');
validateAndExit();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const statusMonitor = require('express-status-monitor');
const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Initialize App
const app = express();
const http = require('http'); // New: Required for Socket.io
const { Server } = require("socket.io"); // New: Socket.io
const server = http.createServer(app); // New: Create HTTP server

const allowedOrigins = [
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'https://superkafe.com',
  'https://www.superkafe.com',
  'https://api.superkafe.com',
  'http://localhost',
  'capacitor://localhost'
];

const corsOptions = {
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Rejected origin: ${origin}`);
      callback(null, false); // Fail gracefully instead of crashing
    }
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id', 'x-tenant-slug', 'x-api-key'],
  exposedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id', 'x-tenant-slug']
};

// Initialize Socket.io
const io = new Server(server, {
  cors: corsOptions
});

// ====== CLUSTER MODE PREPARATION ======
// To use PM2 Cluster Mode, you MUST uncomment this block so Socket.io works across workers.
// Prerequisites: Install Redis on VPS and run: npm install redis @socket.io/redis-adapter

const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("redis");

// Gunakan REDIS_URL dari environment (Docker), atau fallback ke localhost (Docker Lokal)
const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

const pubClient = createClient({ url: redisUrl });
const subClient = pubClient.duplicate();

Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
  io.adapter(createAdapter(pubClient, subClient));
  console.log(`✅ Redis Adapter for Socket.io enabled (Connected to ${redisUrl})`);
}).catch((err) => {
  console.error(`⚠️ Redis Connection Failed (URL: ${redisUrl}):`, err.message);
  console.warn("⚠️ Socket.io will fallback to in-memory adapter.");
});

// ======================================

// Attach io to app for use in controllers
app.set('io', io);

// Socket.io Connection Handler
io.on('connection', (socket) => {
  console.log('⚡ Client connected:', socket.id);

  // Join tenant room for targeted subscription events
  socket.on('join:tenant', (tenantSlug) => {
    if (tenantSlug && typeof tenantSlug === 'string') {
      socket.join(tenantSlug.toLowerCase());
      console.log(`📎 ${socket.id} joined tenant room: ${tenantSlug}`);
    }
  });

  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

app.use(compression());

// Security: Helmet for Header vulnerabilities.
// Adjust contentSecurityPolicy and crossOriginResourcePolicy so we don't break frontend assets (upload images)
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: false,
}));

// Security: Data Sanitize to prevent NoSQL Injection attacks
app.use(mongoSanitize());

// Performance/Monitoring: Real-time dashboard at /status
app.use(statusMonitor({
  title: 'Superkafe API Status',
  path: '/status',
  spans: [{ interval: 1, retention: 60 }, { interval: 5, retention: 60 }, { interval: 15, retention: 60 }]
}));

// Documentation: Swagger UI at /api-docs
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Superkafe Core API',
      version: '1.0.0',
      description: 'API Documentation for Superkafe SaaS',
    },
    servers: [
      {
        url: 'http://localhost:5001',
        description: 'Development server',
      },
      {
        url: 'https://api.superkafe.com',
        description: 'Production server',
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      parameters: {
        tenantIdParam: {
          name: 'x-tenant-id',
          in: 'header',
          description: 'Tenant ID required for scoped resources',
          required: false, // Make it optional since not all routes need it
          schema: {
            type: 'string',
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./routes/*.js'],
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customSiteTitle: "Superkafe API" }));

app.use(cors(corsOptions));
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));

// NEW: Request Logging (Slow Queries)
const slowQueryLogger = require('./middleware/slowQueryLogger');
const logger = require('./utils/logger');
const { initSubscriptionCron } = require('./cron/subscriptionNotifier');

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
  .then(async () => {
    console.log(`✅ Connected to MongoDB (${MONGODB_URI.includes('mongodb+srv') ? 'Atlas' : 'Local'})`);
    // [TEMPORARY MIGRATION] Drop global unique indexes that cause multitenant seeding issues
    try {
      const db = mongoose.connection.db;
      if (db) {
        const collections = ['categories', 'menuitems', 'tables'];
        for (const col of collections) {
          try {
            const collection = db.collection(col);
            const indexes = await collection.indexes();
            if (indexes.some(idx => idx.name === 'id_1')) {
              await collection.dropIndex('id_1');
              console.log(`✅ Dropped global id_1 index from ${col}`);
            }
            if (col === 'tables' && indexes.some(idx => idx.name === 'number_1')) {
              await collection.dropIndex('number_1');
              console.log(`✅ Dropped global number_1 index from ${col}`);
            }
          } catch (e) { /* collection might not exist yet */ }
        }
      }
    } catch (err) {
      console.error('⚠️ Could not check/drop global indexes:', err.message);
    }

    // Start Cron Jobs
    initSubscriptionCron();
  })
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
app.use('/api/tenants', require('./routes/themeRoutes')); // Theme management routes
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
    logger.error('[TENANT SCOPING ERROR] Cross-tenant modification attempt', {
      requestId,
      severity: 'HIGH',
      errorMessage: err.message,
      errorCode: err.code,
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
    logger.warn('[VALIDATION ERROR]', {
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
  logger.error('[UNHANDLED ERROR]', {
    requestId,
    severity: 'ERROR',
    errorMessage: err.message,
    errorName: err.name,
    errorCode: err.code,
    stack: err.stack,
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
server.listen(PORT, () => logger.info(`🚀 Server running on port ${PORT}`)); // Listen on server, not app