# 🎨 Google OAuth Frontend Implementation
## SuperKafe - UI Integration Complete

---

## ✅ Yang Sudah Diimplementasikan

### 1. Komponen & Utilities

**File Baru:**
- `frontend/src/components/GoogleSignInButton.jsx` - Reusable Google button component
- `frontend/src/utils/googleAuth.js` - Google script loader & utilities

### 2. Halaman yang Sudah Diupdate

#### A. TenantRegister.jsx (`/auth/register`)

**Fitur Baru:**
- ✅ Tombol "Daftar dengan Google" di bawah tombol "Daftar Sekarang"
- ✅ Desain standar Google (putih dengan logo G berwarna)
- ✅ Validasi: Alamat Link (slug) wajib diisi sebelum klik Google
- ✅ Auto-load Google Sign-In script
- ✅ Handling tenant slug untuk registrasi tenant baru
- ✅ Auto-redirect ke dashboard setelah berhasil

**Flow:**
```
1. User isi "Alamat Link (URL)" → contoh: "warkop-pusat"
2. User klik "Daftar dengan Google"
3. Google popup muncul → pilih akun
4. Backend buat tenant baru + user admin
5. Redirect ke /admin/dashboard
```

#### B. TenantLogin.jsx (`/auth/login`)

**Fitur Baru:**
- ✅ Tombol "Masuk dengan Google" di bawah tombol "Masuk"
- ✅ Desain standar Google (putih dengan logo G berwarna)
- ✅ Validasi: Tenant Slug wajib diisi sebelum klik Google
- ✅ Auto-load Google Sign-In script
- ✅ Support auto-register jika email belum terdaftar
- ✅ Auto-redirect ke dashboard setelah berhasil

**Flow:**
```
1. User isi "Tenant Slug" → contoh: "warkop-pusat"
2. User klik "Masuk dengan Google"
3. Google popup muncul → pilih akun
4. Backend cek: email ada? → Login | email baru? → Register
5. Redirect ke /admin/dashboard
```

---

## 🎨 UI Design

### Tombol Google Sign-In

**Styling:**
```jsx
<button className="w-full py-3 px-4 bg-white text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 border border-gray-300 shadow-sm">
  <FcGoogle className="w-5 h-5" />
  <span>Daftar dengan Google</span>
</button>
```

**Features:**
- Logo Google berwarna (FcGoogle dari react-icons)
- Background putih (sesuai brand guidelines Google)
- Border abu-abu
- Hover effect: bg-gray-50
- Disabled state: opacity 50%
- Full width responsive

### Divider "atau"

```jsx
<div className="relative">
  <div className="absolute inset-0 flex items-center">
    <div className="w-full border-t border-white/10"></div>
  </div>
  <div className="relative flex justify-center text-sm">
    <span className="px-4 bg-transparent text-white/40">atau</span>
  </div>
</div>
```

---

## 🔧 Technical Implementation

### Google Script Loading

**File: `frontend/src/utils/googleAuth.js`**

```javascript
// Auto-load Google Identity Services script
loadGoogleScript()
  .then(() => {
    setGoogleScriptReady(true);
  })
  .catch((error) => {
    console.error('[Google Auth] Failed to load:', error);
  });
```

**Script URL:**
```
https://accounts.google.com/gsi/client
```

### OAuth Flow

**1. Initialize Token Client:**
```javascript
const client = window.google.accounts.oauth2.initTokenClient({
  client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
  scope: 'email profile openid',
  callback: async (response) => {
    // Handle response
  }
});
```

**2. Request Access Token:**
```javascript
client.requestAccessToken();
```

**3. Get User Info:**
```javascript
const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
  headers: {
    Authorization: `Bearer ${response.access_token}`
  }
});
const userInfo = await userInfoResponse.json();
```

**4. Send to Backend:**
```javascript
const backendResponse = await api.post('/auth/google', {
  idToken: userInfo.sub,
  tenantSlug: formData.slug,
  email: userInfo.email,
  name: userInfo.name,
  picture: userInfo.picture
});
```

---

## 📋 Environment Variables

**File: `frontend/.env`**

```env
VITE_API_URL=https://superkafe.com/api
VITE_GOOGLE_CLIENT_ID=706624374984-qg1ueivbvougs0gff3842jkgvf9qurno.apps.googleusercontent.com
```

**Verification:**
```bash
cd frontend
cat .env | grep GOOGLE
```

---

## 🧪 Testing Checklist

### Register Page (`/auth/register`)

- [ ] Halaman load tanpa error
- [ ] Google script loaded (check console)
- [ ] Tombol "Daftar dengan Google" muncul
- [ ] Tombol disabled jika slug kosong
- [ ] Tombol enabled setelah isi slug
- [ ] Klik tombol → Google popup muncul
- [ ] Pilih akun Google → loading state
- [ ] Success → redirect ke dashboard
- [ ] Token tersimpan di localStorage
- [ ] User data tersimpan di localStorage

### Login Page (`/auth/login`)

- [ ] Halaman load tanpa error
- [ ] Google script loaded (check console)
- [ ] Tombol "Masuk dengan Google" muncul
- [ ] Tombol disabled jika tenant slug kosong
- [ ] Tombol enabled setelah isi tenant slug
- [ ] Klik tombol → Google popup muncul
- [ ] Pilih akun Google → loading state
- [ ] Success → redirect ke dashboard
- [ ] Token tersimpan di localStorage
- [ ] User data tersimpan di localStorage

### Error Handling

- [ ] Slug kosong → toast error
- [ ] Tenant tidak ditemukan → toast error
- [ ] Google popup ditutup → no error
- [ ] Network error → toast error
- [ ] Backend error → toast error dengan message

---

## 🎯 User Experience

### Loading States

**1. Script Loading:**
```
"Memuat Google Sign-In..."
```

**2. Button Disabled:**
```
"Isi Alamat Link terlebih dahulu"  // Register
"Isi Tenant Slug terlebih dahulu"  // Login
```

**3. Processing:**
```
"Memproses..."
```

### Success Messages

**Register (New User):**
```
"Akun berhasil dibuat dengan Google! Selamat datang!"
```

**Login (Existing User):**
```
"Login dengan Google berhasil!"
```

**Register (New Tenant + User):**
```
"Registrasi dengan Google berhasil! Selamat datang!"
```

### Error Messages

```
"Alamat Link (URL) wajib diisi terlebih dahulu"
"Tenant slug wajib diisi terlebih dahulu"
"Google Sign-In belum siap. Silakan refresh halaman."
"Pendaftaran dengan Google gagal"
"Login dengan Google gagal"
"Tenant tidak ditemukan"
"Google token tidak valid"
```

---

## 🔍 Debugging

### Console Logs

**Success Flow:**
```
[Google Auth] Script ready
[Google Auth] User info: { email: '...', name: '...', picture: '...' }
```

**Error Flow:**
```
[Google Auth] Failed to load: Error...
Google OAuth Error: { error: '...' }
Backend auth error: { message: '...' }
```

### Browser DevTools

**Check Script Loaded:**
```javascript
// Console
typeof window.google !== 'undefined'
// Expected: true
```

**Check Environment:**
```javascript
// Console
import.meta.env.VITE_GOOGLE_CLIENT_ID
// Expected: "706624374984-qg1ueivbvougs0gff3842jkgvf9qurno.apps.googleusercontent.com"
```

**Check LocalStorage:**
```javascript
// Console
localStorage.getItem('token')
localStorage.getItem('user')
localStorage.getItem('tenant_slug')
```

---

## 📱 Mobile Responsive

**Tombol Google:**
- Full width pada mobile
- Touch-friendly (py-3 = 12px padding)
- Clear tap target (min 44px height)
- Smooth transitions

**Google Popup:**
- Native Google popup (responsive by default)
- Works on mobile browsers
- Supports mobile app deep linking

---

## 🚀 Deployment

### Build Frontend

```bash
cd frontend
npm run build
```

### Verify Build

```bash
# Check if Google Client ID is in build
grep -r "706624374984" dist/

# Should find it in compiled JS files
```

### Deploy

```bash
# Copy build to server
scp -r dist/* user@server:/var/www/superkafe/

# Or use Docker
docker-compose build frontend
docker-compose up -d frontend
```

---

## ✅ Implementation Complete

### Files Modified

1. `frontend/src/pages/auth/TenantRegister.jsx`
   - Added Google Sign-Up button
   - Added Google OAuth flow
   - Added slug validation

2. `frontend/src/pages/auth/TenantLogin.jsx`
   - Added Google Sign-In button
   - Added Google OAuth flow
   - Added tenant slug validation

### Files Created

1. `frontend/src/components/GoogleSignInButton.jsx`
   - Reusable Google button component

2. `frontend/src/utils/googleAuth.js`
   - Google script loader
   - OAuth utilities

3. `frontend/.env.example`
   - Environment template

### Backend Support

1. `backend/controllers/GoogleAuthController.js`
   - Updated to support direct auth data
   - Support both token verification and direct data

2. `backend/.env`
   - Google credentials configured

---

## 📞 Next Steps

1. **Test di Development:**
   ```bash
   cd frontend
   npm run dev
   ```

2. **Test Register Flow:**
   - Buka: http://localhost:5174/auth/register
   - Isi "Alamat Link"
   - Klik "Daftar dengan Google"
   - Verify redirect ke dashboard

3. **Test Login Flow:**
   - Buka: http://localhost:5174/auth/login
   - Isi "Tenant Slug"
   - Klik "Masuk dengan Google"
   - Verify redirect ke dashboard

4. **Deploy to Production:**
   - Build frontend
   - Deploy to server
   - Test dengan domain production

---

**Status**: ✅ UI Implementation Complete
**Last Updated**: 2024
**Ready for Testing**: Yes
