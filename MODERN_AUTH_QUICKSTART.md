# 🚀 Modern Auth System - Quick Start Guide

## ✅ Yang Telah Diimplementasikan

### Backend (5 files baru)
1. ✅ `backend/controllers/GlobalAuthController.js` - Global auth logic
2. ✅ `backend/routes/globalAuthRoutes.js` - Modern auth routes
3. ✅ `backend/models/Employee.js` - Updated dengan PIN field (hashed)
4. ✅ `backend/server.js` - Routes registered

### Frontend (6 files baru)
1. ✅ `frontend/src/pages/auth/GlobalLogin.jsx` - Modern login (no tenant slug)
2. ✅ `frontend/src/pages/auth/DeviceLogin.jsx` - Shared tablet screen
3. ✅ `frontend/src/components/Numpad.jsx` - Visual PIN input
4. ✅ `frontend/src/components/AdminOverrideModal.jsx` - Admin authorization
5. ✅ `frontend/src/context/IdleContext.jsx` - Auto-lock system
6. ✅ `frontend/src/services/api.js` - Updated dengan global auth API
7. ✅ `frontend/src/App.jsx` - Updated routes dan IdleProvider

## 🎯 Cara Menggunakan

### 1. Setup PIN untuk Employees

Jalankan script ini di MongoDB atau buat endpoint untuk set PIN:

```javascript
// Di backend, buat script atau endpoint untuk set PIN
const bcrypt = require('bcryptjs');

// Hash PIN
const hashedPIN = await bcrypt.hash('123456', 10);

// Update employee
await Employee.findOneAndUpdate(
  { id: 'emp_001' },
  { pin: hashedPIN }
);
```

Atau gunakan endpoint yang sudah ada:

```bash
curl -X POST http://localhost:5001/api/auth/set-pin \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "emp_001",
    "pin": "999999",
    "tenantSlug": "warkop-pusat"
  }'
```

### 2. Test Global Login

1. Buka `http://localhost:5002/auth/login`
2. Input email: `admin@warkop.com`
3. Input password: `password123`
4. Klik "Masuk"
5. Sistem akan auto-detect tenant dan redirect ke dashboard

### 3. Test Device Login (Shared Tablet)

1. Setelah admin login, `tenant_slug` tersimpan di localStorage
2. Buka `http://localhost:5002/auth/device-login`
3. Akan muncul staff selection screen
4. Pilih staff yang ingin login
5. Input PIN (4-6 digit)
6. Klik "Masuk"

### 4. Test Auto-Lock

1. Login sebagai staff (bukan admin)
2. Biarkan idle selama 5 menit
3. Sistem akan auto-lock dan redirect ke device login
4. Staff harus input PIN lagi

### 5. Test Admin Override

Untuk menggunakan admin override di komponen lain:

```jsx
import { useState } from 'react';
import AdminOverrideModal from '../components/AdminOverrideModal';

function MyComponent() {
  const [showAdminModal, setShowAdminModal] = useState(false);

  const handleDeleteTransaction = () => {
    // Check if user is admin
    const user = JSON.parse(localStorage.getItem('user'));
    
    if (user.role !== 'admin') {
      // Require admin authorization
      setShowAdminModal(true);
    } else {
      // Admin can proceed directly
      performDelete();
    }
  };

  const handleAdminAuthorized = () => {
    // Admin PIN verified, proceed with action
    performDelete();
  };

  return (
    <>
      <button onClick={handleDeleteTransaction}>
        Delete Transaction
      </button>

      <AdminOverrideModal
        isOpen={showAdminModal}
        onClose={() => setShowAdminModal(false)}
        onSuccess={handleAdminAuthorized}
        action="menghapus transaksi ini"
      />
    </>
  );
}
```

## 🔑 API Endpoints Baru

### 1. Global Login
```
POST /api/auth/global-login
Body: { email, password }
```

### 2. PIN Login
```
POST /api/auth/login-pin
Body: { tenantSlug, employeeId, pin }
```

### 3. Get Staff List
```
GET /api/auth/staff-list/:tenantSlug
```

### 4. Verify Admin PIN
```
POST /api/auth/verify-admin-pin
Body: { tenantSlug, pin }
```

### 5. Set PIN
```
POST /api/auth/set-pin
Headers: Authorization: Bearer {token}
Body: { employeeId, pin, tenantSlug }
```

## 🎨 UI Components Baru

### Numpad Component
```jsx
import Numpad from '../components/Numpad';

<Numpad
  value={pin}
  onChange={setPin}
  maxLength={6}
  onSubmit={handleSubmit}
/>
```

### Admin Override Modal
```jsx
import AdminOverrideModal from '../components/AdminOverrideModal';

<AdminOverrideModal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  onSuccess={handleSuccess}
  action="melakukan aksi ini"
/>
```

## 🔄 Migration dari Old System

### Old Login Flow
```
User → Input tenant_slug + username + password → Login
```

### New Login Flow
```
User → Input email + password → Auto-detect tenant → Login
```

### Backward Compatibility
- Old route `/auth/tenant-login` masih ada
- Existing users bisa tetap login dengan cara lama
- Gradually migrate ke new system

## 📱 Mobile Features

### Device Binding
- Otomatis setelah admin login pertama kali
- Tersimpan di localStorage
- Bisa di-unbind dari device login screen

### Auto-Lock
- 5 menit idle timeout
- Warning 30 detik sebelumnya
- Hanya untuk non-admin roles
- Redirect ke PIN input (bukan logout complete)

### Idle Detection
- Mouse movement
- Keyboard input
- Touch events
- Scroll events

## 🧪 Testing Checklist

### Backend Tests
- [ ] Global login dengan email valid
- [ ] Global login dengan email tidak ditemukan
- [ ] PIN login dengan PIN benar
- [ ] PIN login dengan PIN salah
- [ ] Get staff list untuk tenant
- [ ] Verify admin PIN
- [ ] Set PIN untuk employee

### Frontend Tests
- [ ] Global login UI
- [ ] Device login UI (staff selection)
- [ ] Numpad input
- [ ] Admin override modal
- [ ] Auto-lock setelah 5 menit
- [ ] Warning toast sebelum auto-lock
- [ ] Device unbind

### Integration Tests
- [ ] Complete flow: Admin login → Device binding → Staff login
- [ ] Auto-lock → Re-login dengan PIN
- [ ] Admin override → Verify PIN → Allow action
- [ ] Unbind device → Redirect to global login

## 🐛 Common Issues

### Issue 1: Staff list kosong
**Cause**: Staff belum punya PIN  
**Fix**: Set PIN untuk staff menggunakan endpoint `/api/auth/set-pin`

### Issue 2: Auto-lock tidak work
**Cause**: User role adalah admin  
**Fix**: Auto-lock hanya untuk non-admin roles

### Issue 3: Device tidak ter-bind
**Cause**: Admin belum login  
**Fix**: Admin harus login dulu dengan email untuk bind device

### Issue 4: PIN tidak valid
**Cause**: PIN tidak di-hash atau format salah  
**Fix**: Pastikan PIN di-hash dengan bcrypt dan format 4-6 digit

## 📊 Key Differences

| Feature | Old System | New System |
|---------|-----------|------------|
| Login Input | Tenant slug + username + password | Email + password |
| Tenant Detection | Manual input | Auto-detect |
| Shared Tablet | Not supported | Fully supported |
| PIN Auth | Plain text | Hashed with bcrypt |
| Auto-Lock | Not available | 5 minutes idle |
| Admin Override | Not available | PIN-based |
| Device Binding | Not available | Automatic |

## 🎯 Next Steps

1. **Set PIN untuk semua employees**
   ```bash
   # Gunakan endpoint set-pin atau script manual
   ```

2. **Test global login**
   ```bash
   # Login dengan email di /auth/login
   ```

3. **Test device login**
   ```bash
   # Akses /auth/device-login setelah device ter-bind
   ```

4. **Implement admin override di fitur sensitif**
   ```jsx
   // Tambahkan AdminOverrideModal di komponen yang perlu otorisasi
   ```

5. **Monitor auto-lock behavior**
   ```bash
   # Test idle detection dan auto-lock
   ```

## 📚 Documentation

- `MODERN_AUTH_SYSTEM.md` - Complete documentation
- `MULTITENANT_IMPLEMENTATION.md` - Multitenant architecture
- `AI_RULES.md` - Development guidelines

---

**Ready to use! 🚀**

Sistem autentikasi modern SuperKafe sudah siap digunakan. Tidak perlu install dependencies tambahan, semua sudah terintegrasi!
