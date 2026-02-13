require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const compression = require('compression');

// Initialize App
const app = express();
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
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/warkop';
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

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
// app.use('/api/admin/audit-logs', require('./routes/auditLogRoutes'));

// New Routes (Refactored)
app.use('/api', require('./routes/authRoutes')); // Mounts /login -> /api/login
app.use('/api/data', require('./routes/dataRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));
app.use('/api/cash', require('./routes/cashRoutes'));
app.use('/api/cash-transactions', require('./routes/cashTransactionRoutes')); // New Link
app.use('/api/debts', require('./routes/debtRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/payroll', require('./routes/payrollRoutes'));
app.use('/api/stats', require('./routes/statsRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/users', require('./routes/userRoutes'));

// ===== START SERVER =====
app.use('/api/feedback', require('./routes/feedbackRoutes'));
app.use('/api/service-request', require('./routes/serviceRequestRoutes'));
app.use('/api', require('./routes/marketingRoutes')); // Marketing: vouchers, banners, apply-voucher

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));