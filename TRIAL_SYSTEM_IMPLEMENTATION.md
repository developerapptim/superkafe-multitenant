# 🎁 Sistem Trial Gratis 10 Hari - SuperKafe

## 📋 Overview

Sistem trial gratis 10 hari telah diimplementasikan untuk memberikan kesempatan kepada tenant baru mencoba SuperKafe sebelum berlangganan.

## ✨ Fitur Utama

### 1. Auto Trial 10 Hari
- Setiap tenant baru otomatis mendapat trial 10 hari
- Dimulai dari tanggal registrasi
- Akses penuh ke semua fitur selama masa trial

### 2. Status Tracking
- **trial**: Masa percobaan (10 hari)
- **paid**: Sudah berlangganan
- **expired**: Trial habis, belum bayar
- **suspended**: Ditangguhkan oleh admin

### 3. Middleware Protection
- Blokir akses ke fitur premium jika trial habis
- Response 403 dengan pesan jelas
- Logging untuk monitoring

### 4. Visual Banner di Dashboard
- Badge hijau: > 3 hari tersisa
- Banner kuning: ≤ 3 hari tersisa (peringatan)
- Banner merah: Trial habis
- Progress bar visual
- Tombol upgrade

## 🏗️ Implementasi Backend

### Tenant Model Update

```javascript
// backend/models/Tenant.js

const tenantSchema = new mongoose.Schema({
  // ... existing fields ...
  
  // Trial & Subscription Fields
  status: {
    type: String,
    enum: ['trial', 'paid', 'expired', 'suspended'],
    default: 'trial'
  },
  trialExpiresAt: {
    type: Date,
    required: true,
    default: function() {
      // Set trial 10 hari dari sekarang
      const now = new Date();
      return new Date(now.getTime() + (10 * 24 * 60 * 60 * 1000));
    }
  },
  subscriptionExpiresAt: {
    type: Date,
    default: null
  }
});

// Virtual untuk cek trial aktif
tenantSchema.virtual('isTrialActive').get(function() {
  if (this.status !== 'trial') return false;
  return new Date() < this.trialExpiresAt;
});

// Virtual untuk hitung sisa hari
tenantSchema.virtual('trialDaysRemaining').get(function() {
  if (this.status !== 'trial') return 0;
  const now = new Date();
  const diff = this.trialExpiresAt - now;
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return days > 0 ? days : 0;
});

// Method untuk cek akses
tenantSchema.methods.canAccessFeatures = function() {
  if (this.status === 'paid') return true;
  if (this.status === 'trial' && new Date() < this.trialExpiresAt) return true;
  return false;
};
```

### Middleware Protection

```javascript
// backend/middleware/checkTrialStatus.js

const checkTrialStatus = async (req, res, next) => {
  try {
    const tenantSlug = req.headers['x-tenant-id'];
    const tenant = await Tenant.findOne({ slug: tenantSlug }).lean();
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant tidak ditemukan'
      });
    }

    const now = new Date();

    // Jika paid, allow
    if (tenant.status === 'paid') {
      return next();
    }

    // Jika trial, cek expiry
    if (tenant.status === 'trial') {
      if (now < tenant.trialExpiresAt) {
        return next(); // Trial masih aktif
      } else {
        return res.status(403).json({
          success: false,
          error: 'Masa trial habis. Silakan upgrade ke paket berbayar.',
          trialExpired: true
        });
      }
    }

    // Default: block
    return res.status(403).json({
      success: false,
      error: 'Akses tidak diizinkan'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Terjadi kesalahan saat memeriksa status trial'
    });
  }
};
```

### Controller Update

```javascript
// backend/controllers/TenantController.js

exports.registerTenant = async (req, res) => {
  // ... validation ...

  // Set trial expiry: 10 hari dari sekarang
  const trialExpiresAt = new Date();
  trialExpiresAt.setDate(trialExpiresAt.getDate() + 10);

  const newTenant = await Tenant.create({
    name: name.trim(),
    slug: slug.toLowerCase(),
    dbName,
    isActive: true,
    status: 'trial',
    trialExpiresAt: trialExpiresAt
  });

  // ... rest of code ...
};

exports.getTrialStatus = async (req, res) => {
  const { slug } = req.params;
  const tenant = await Tenant.findOne({ slug }).lean();

  if (!tenant) {
    return res.status(404).json({
      success: false,
      message: 'Tenant tidak ditemukan'
    });
  }

  const now = new Date();
  const daysRemaining = tenant.status === 'trial' 
    ? Math.ceil((tenant.trialExpiresAt - now) / (1000 * 60 * 60 * 24))
    : 0;

  res.json({
    success: true,
    data: {
      status: tenant.status,
      trialExpiresAt: tenant.trialExpiresAt,
      daysRemaining: daysRemaining > 0 ? daysRemaining : 0,
      isActive: tenant.status === 'paid' || 
                (tenant.status === 'trial' && now < tenant.trialExpiresAt)
    }
  });
};
```

### Routes

```javascript
// backend/routes/tenantRoutes.js

router.get('/:slug/trial-status', TenantController.getTrialStatus);
```

## 🎨 Implementasi Frontend

### Trial Status Banner Component

```jsx
// frontend/src/components/TrialStatusBanner.jsx

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiClock, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';
import api from '../services/api';

const TrialStatusBanner = () => {
  const [trialInfo, setTrialInfo] = useState(null);

  useEffect(() => {
    fetchTrialStatus();
  }, []);

  const fetchTrialStatus = async () => {
    const tenantSlug = localStorage.getItem('tenant_slug');
    const response = await api.get(`/tenants/${tenantSlug}/trial-status`);
    setTrialInfo(response.data.data);
  };

  const { daysRemaining, status } = trialInfo || {};

  // Tentukan warna berdasarkan sisa hari
  let bgColor, textColor, icon, message;

  if (status === 'trial' && daysRemaining > 3) {
    bgColor = 'bg-green-500/10';
    textColor = 'text-green-400';
    icon = <FiCheckCircle />;
    message = `Masa Trial: ${daysRemaining} Hari Lagi`;
  } else if (status === 'trial' && daysRemaining > 0) {
    bgColor = 'bg-yellow-500/10';
    textColor = 'text-yellow-400';
    icon = <FiAlertTriangle />;
    message = `⚠️ Peringatan: Masa Trial Sisa ${daysRemaining} Hari`;
  } else {
    bgColor = 'bg-red-500/10';
    textColor = 'text-red-400';
    icon = <FiClock />;
    message = '🔒 Masa Trial Habis. Akses Terkunci';
  }

  return (
    <motion.div
      className={`backdrop-blur-xl ${bgColor} border rounded-2xl p-4`}
    >
      <div className="flex items-center gap-3">
        <div className={textColor}>{icon}</div>
        <p className={`font-semibold ${textColor}`}>{message}</p>
      </div>
      
      {/* Progress Bar */}
      {status === 'trial' && daysRemaining > 0 && (
        <div className="mt-3 h-2 bg-white/10 rounded-full">
          <div 
            className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
            style={{ width: `${(daysRemaining / 10) * 100}%` }}
          />
        </div>
      )}
    </motion.div>
  );
};
```

### Penggunaan di Dashboard

```jsx
// frontend/src/pages/admin/Dashboard.jsx

import TrialStatusBanner from '../../components/TrialStatusBanner';

function Dashboard() {
  return (
    <div className="p-6">
      {/* Trial Status Banner */}
      <TrialStatusBanner />
      
      {/* Rest of dashboard content */}
      {/* ... */}
    </div>
  );
}
```

## 📡 API Endpoints

### Get Trial Status
```http
GET /api/tenants/:slug/trial-status

Response:
{
  "success": true,
  "data": {
    "status": "trial",
    "trialExpiresAt": "2025-03-02T10:30:00.000Z",
    "daysRemaining": 7,
    "isActive": true,
    "canAccessFeatures": true
  }
}
```

## 🔐 Middleware Usage

### Protect Routes

```javascript
// backend/routes/orderRoutes.js

const { checkTrialStatus } = require('../middleware/checkTrialStatus');

// Protect order creation
router.post('/', checkTrialStatus, OrderController.create);

// Protect order updates
router.patch('/:id', checkTrialStatus, OrderController.update);
```

### Attach Trial Info (Non-blocking)

```javascript
const { attachTrialInfo } = require('../middleware/checkTrialStatus');

// Attach info tanpa blokir
router.get('/dashboard', attachTrialInfo, DashboardController.get);

// Access trial info di controller
exports.get = (req, res) => {
  const trialInfo = req.trialInfo;
  // { status, daysRemaining, expiresAt, isActive }
};
```

## 🎯 User Flow

### Registration Flow
```
1. User register tenant baru
   ↓
2. Backend set status: 'trial'
   ↓
3. Backend set trialExpiresAt: now + 10 days
   ↓
4. User dapat akses penuh selama 10 hari
```

### Trial Active Flow
```
1. User login ke dashboard
   ↓
2. Frontend fetch trial status
   ↓
3. Tampilkan banner sesuai sisa hari:
   - > 3 hari: Badge hijau
   - ≤ 3 hari: Banner kuning (warning)
   - 0 hari: Banner merah (expired)
```

### Trial Expired Flow
```
1. User coba akses fitur (create order)
   ↓
2. Middleware cek trial status
   ↓
3. Trial expired → Block request
   ↓
4. Return 403 dengan pesan error
   ↓
5. Frontend tampilkan modal upgrade
```

## 🧪 Testing

### Test Trial Creation
```bash
# Register tenant baru
curl -X POST http://localhost:5001/api/tenants/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Warkop",
    "slug": "test-warkop",
    "email": "test@warkop.com",
    "password": "password123"
  }'

# Response akan include:
# "status": "trial"
# "trialExpiresAt": "2025-03-02T..."
# "trialDaysRemaining": 10
```

### Test Trial Status
```bash
curl http://localhost:5001/api/tenants/test-warkop/trial-status

# Response:
{
  "success": true,
  "data": {
    "status": "trial",
    "trialExpiresAt": "2025-03-02T10:30:00.000Z",
    "daysRemaining": 10,
    "isActive": true
  }
}
```

### Test Middleware Protection
```bash
# Dengan trial aktif
curl -X POST http://localhost:5001/api/orders \
  -H "x-tenant-id: test-warkop" \
  -H "Content-Type: application/json" \
  -d '{ "items": [...] }'

# Response: 200 OK (allowed)

# Dengan trial expired (manual set di DB)
# Response: 403 Forbidden
{
  "success": false,
  "error": "Masa trial habis. Silakan upgrade ke paket berbayar.",
  "trialExpired": true
}
```

## 🔄 Manual Trial Management

### Extend Trial (Admin)
```javascript
// Extend trial 7 hari lagi
await Tenant.findOneAndUpdate(
  { slug: 'test-warkop' },
  { 
    $set: { 
      trialExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  }
);
```

### Upgrade to Paid
```javascript
// Upgrade tenant ke paid
await Tenant.findOneAndUpdate(
  { slug: 'test-warkop' },
  { 
    $set: { 
      status: 'paid',
      subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 hari
    }
  }
);
```

### Suspend Tenant
```javascript
// Suspend tenant
await Tenant.findOneAndUpdate(
  { slug: 'test-warkop' },
  { $set: { status: 'suspended' } }
);
```

## 📊 Monitoring & Analytics

### Query Trial Tenants
```javascript
// Tenant dengan trial aktif
const activeTrial = await Tenant.find({
  status: 'trial',
  trialExpiresAt: { $gt: new Date() }
});

// Tenant trial akan habis dalam 3 hari
const expiringSoon = await Tenant.find({
  status: 'trial',
  trialExpiresAt: {
    $gt: new Date(),
    $lt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
  }
});

// Tenant trial sudah habis
const expired = await Tenant.find({
  status: 'trial',
  trialExpiresAt: { $lt: new Date() }
});
```

## 🚀 Future Enhancements

### Email Notifications
- Email reminder 3 hari sebelum trial habis
- Email notification saat trial habis
- Email welcome dengan info trial

### Payment Integration
- Tombol upgrade ke payment gateway
- Multiple subscription plans
- Auto-renewal

### Admin Dashboard
- List semua tenant dengan status trial
- Bulk extend trial
- Analytics trial conversion rate

## 📁 Files Created/Modified

### Backend
1. ✅ `backend/models/Tenant.js` - Added trial fields
2. ✅ `backend/middleware/checkTrialStatus.js` - NEW
3. ✅ `backend/controllers/TenantController.js` - Added getTrialStatus
4. ✅ `backend/routes/tenantRoutes.js` - Added trial-status route

### Frontend
1. ✅ `frontend/src/components/TrialStatusBanner.jsx` - NEW
2. ✅ `frontend/src/services/api.js` - Added getTrialStatus

### Documentation
1. ✅ `TRIAL_SYSTEM_IMPLEMENTATION.md` - This file

---

**Status**: ✅ Fully Implemented  
**Version**: 1.0.0  
**Last Updated**: 2025-02-20

**Sistem trial gratis 10 hari SuperKafe siap digunakan! 🎉**
