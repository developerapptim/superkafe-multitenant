require('dotenv').config();
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
  credentials: true
}));
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));

// ===== STATIC FILES =====
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin')));
app.use('/', express.static(path.join(__dirname, 'public', 'customer')));

// ===== DATABASE =====
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ FATAL: MONGODB_URI is not defined in .env! Server cannot start.');
  process.exit(1);
}
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log(`✅ Connected to MongoDB (${MONGODB_URI.includes('mongodb+srv') ? 'Atlas' : 'Local'})`))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// ===== ROUTES =====
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
app.use('/api', require('./routes/authRoutes')); // Mounts /login -> /api/login
app.use('/api/data', require('./routes/dataRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`)); // Listen on server, not app