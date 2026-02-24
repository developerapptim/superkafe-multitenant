# Google OAuth Loading Fix

## Masalah
Google Sign-In script gagal dimuat di halaman login/register dengan error:
- "Failed to load script"
- "Google Sign-In gagal dimuat"
- **CORS Error**: "Access to script at 'https://accounts.google.com/gsi/client' from origin 'http://localhost:5174' has been blocked by CORS policy"

## Penyebab
1. Script loading timeout terlalu pendek (5 detik)
2. Tidak ada preconnect/dns-prefetch untuk mempercepat loading
3. Error handling kurang robust
4. Tidak ada fallback mechanism
5. **CRITICAL**: `crossOrigin="anonymous"` attribute menyebabkan CORS blocking

## Root Cause - CORS Issue
Google's GSI (Google Sign-In) script tidak mendukung CORS requests dengan `crossOrigin` attribute. Ketika kita menambahkan `crossOrigin="anonymous"` pada script tag atau preconnect link, browser akan melakukan CORS preflight check yang akan ditolak oleh Google's server.

### Why This Happens
- Google's GSI script is designed to be loaded as a regular script (not CORS-enabled)
- Adding `crossOrigin` attribute forces browser to treat it as a CORS request
- Google's server doesn't send proper CORS headers for this script
- Result: Browser blocks the script from loading

## Perbaikan yang Dilakukan

### 1. Removed crossOrigin Attribute (`frontend/src/utils/googleAuth.js`)
```javascript
// BEFORE (WRONG - causes CORS error)
script.crossOrigin = 'anonymous';

// AFTER (CORRECT - no CORS issues)
// DO NOT add crossOrigin attribute - it causes CORS blocking
```

### 2. Updated Preconnect Links (`frontend/index.html`)
```html
<!-- BEFORE (WRONG) -->
<link rel="preconnect" href="https://accounts.google.com" crossorigin>

<!-- AFTER (CORRECT) -->
<link rel="preconnect" href="https://accounts.google.com">
```

### 3. Improved Script Loading (`frontend/src/utils/googleAuth.js`)
- Menambahkan logging yang lebih detail untuk debugging
- Menambahkan check untuk existing script di DOM
- Menambahkan delay 100ms setelah script load untuk memastikan `window.google` tersedia
- Improved error messages

### 4. Extended Timeout (`SimpleLogin.jsx` & `SimpleRegister.jsx`)
- Timeout diperpanjang dari 5 detik menjadi 10 detik
- Error toast tidak ditampilkan otomatis, hanya saat user mencoba menggunakan Google login
- Menambahkan state `googleScriptFailed` untuk tracking

### 5. Better Error Handling
- Try-catch di `handleGoogleSignIn` dan `handleGoogleSignUp`
- Check `googleScriptReady` dan `googleScriptFailed` sebelum initialize
- User-friendly error messages

### 6. UI Improvements
- Menampilkan status "Memuat Google Sign-In..." saat loading
- Menampilkan "Google Sign-In Tidak Tersedia" jika gagal
- Button disabled saat script belum ready atau gagal
- Error message yang jelas untuk user

## Testing

### Manual Test
1. **Clear browser cache** (IMPORTANT!)
2. Buka halaman login: `http://localhost:5174/auth/login`
3. Periksa browser console untuk log Google Auth
4. Tunggu hingga button "Masuk dengan Google" aktif
5. Klik button dan pastikan popup Google muncul

### Network Test
1. Buka DevTools > Network tab
2. Filter: `accounts.google.com`
3. Refresh halaman
4. Pastikan script loaded dengan status 200 (bukan 403 atau CORS error)

### Console Check
Expected logs:
```
[Google Auth] Starting to load script...
[Google Auth] Appending script to document head
[Google Auth] Script loaded successfully
```

Should NOT see:
```
Access to script at 'https://accounts.google.com/gsi/client' has been blocked by CORS policy
```

## Troubleshooting

### Script Masih Gagal Dimuat
1. **Clear Browser Cache**: Ctrl+Shift+Delete → Clear cached images and files
2. **Hard Refresh**: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
3. **Check Internet Connection**: Pastikan koneksi internet stabil
4. **Check Browser Console**: Lihat error message detail
5. **Try Incognito Mode**: Test di incognito/private window
6. **Try Different Browser**: Test di browser lain (Chrome, Firefox, Edge)

### CORS Error Masih Muncul
1. Pastikan tidak ada `crossOrigin` attribute di script tag
2. Pastikan tidak ada `crossorigin` di preconnect links
3. Clear browser cache dan hard refresh
4. Check if any browser extension is blocking the script

### Google Client ID Invalid
1. Periksa `frontend/.env`:
   ```
   VITE_GOOGLE_CLIENT_ID=706624374984-qg1ueivbvougs0gff3842jkgvf9qurno.apps.googleusercontent.com
   ```
2. Pastikan Client ID valid di [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
3. Pastikan Authorized JavaScript origins sudah dikonfigurasi:
   - `http://localhost:5174` (development)
   - `https://superkafe.com` (production)

### Popup Blocked
1. Pastikan browser tidak memblokir popup
2. User harus klik button (tidak bisa auto-trigger)
3. Check browser popup settings

## Important Notes

### DO NOT Add crossOrigin
```javascript
// ❌ WRONG - Will cause CORS error
const script = document.createElement('script');
script.src = 'https://accounts.google.com/gsi/client';
script.crossOrigin = 'anonymous'; // DO NOT DO THIS

// ✅ CORRECT
const script = document.createElement('script');
script.src = 'https://accounts.google.com/gsi/client';
script.async = true;
script.defer = true;
// No crossOrigin attribute
```

### Preconnect Without crossorigin
```html
<!-- ❌ WRONG -->
<link rel="preconnect" href="https://accounts.google.com" crossorigin>

<!-- ✅ CORRECT -->
<link rel="preconnect" href="https://accounts.google.com">
```

## Production Checklist
- [ ] Google Client ID sudah dikonfigurasi untuk production domain
- [ ] Authorized JavaScript origins sudah ditambahkan di Google Cloud Console
- [ ] Authorized redirect URIs sudah dikonfigurasi
- [ ] Test di berbagai browser (Chrome, Firefox, Safari, Edge)
- [ ] Test di mobile devices
- [ ] Monitor error logs di production
- [ ] Verify no CORS errors in production console

## Related Files
- `frontend/src/utils/googleAuth.js` - Script loader utility (UPDATED: removed crossOrigin)
- `frontend/src/pages/auth/SimpleLogin.jsx` - Login page
- `frontend/src/pages/auth/SimpleRegister.jsx` - Register page
- `frontend/index.html` - Preconnect hints (UPDATED: removed crossorigin)
- `backend/controllers/UnifiedAuthController.js` - Backend auth handler

## References
- [Google Identity Services Documentation](https://developers.google.com/identity/gsi/web/guides/overview)
- [OAuth 2.0 for Client-side Web Applications](https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow)
- [CORS and Script Tags](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/crossorigin)
