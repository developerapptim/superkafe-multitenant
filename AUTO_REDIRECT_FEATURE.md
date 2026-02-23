# Auto-Redirect Feature - Active Session Detection

## Overview
Fitur auto-redirect mencegah auth loop dan meningkatkan UX dengan mendeteksi sesi aktif dan langsung mengarahkan user ke dashboard tanpa perlu login ulang.

## Problem yang Dipecahkan

### 1. Auth Loop Error
**Sebelum:**
- User sudah login tapi kembali ke landing page
- Klik tombol "Masuk" → trigger Google Auth lagi
- Error: `TypeError: n.info is not a function`
- `tenant_slug` terhapus dari localStorage
- User stuck di loop login

**Sesudah:**
- Sistem deteksi sesi aktif saat user klik "Masuk"
- Langsung redirect ke dashboard tanpa trigger auth baru
- Tidak ada error, tidak ada data yang hilang

### 2. Poor User Experience
**Sebelum:**
- User harus login berulang kali setiap kali buka landing page
- Tidak ada indikasi bahwa user sudah login

**Sesudah:**
- User langsung masuk ke dashboard jika sudah login
- Smooth transition tanpa form login

## Implementation

### 1. Auth Helper Utility (`authHelper.js`)

```javascript
// Check if token is expired
export const isTokenExpired = (token) => {
  // Decode JWT and check exp claim
  // Returns true if expired or invalid
}

// Check for active session
export const checkActiveSession = () => {
  // Validates: token, tenant_slug, user data
  // Returns session object or null
}

// Get dashboard URL
export const getDashboardUrl = () => {
  // Returns /{tenantSlug}/admin/dashboard
}

// Clear session data
export const clearAuthSession = () => {
  // Removes all auth data from localStorage
}
```

### 2. Login Pages (GlobalLogin, SimpleLogin)

**Added Features:**
- ✅ Check active session on mount
- ✅ Show loading state while checking
- ✅ Auto-redirect if valid session found
- ✅ Only show login form if no active session

```javascript
useEffect(() => {
  const session = checkActiveSession();
  
  if (session) {
    const dashboardUrl = getDashboardUrl();
    if (dashboardUrl) {
      toast.success('Sesi aktif ditemukan...');
      navigate(dashboardUrl, { replace: true });
      return;
    }
  }
  
  setCheckingSession(false);
}, [navigate]);
```

### 3. Landing Page & Navbar

**Smart Login Button:**
```javascript
const handleLoginClick = () => {
  const session = checkActiveSession();
  
  if (session) {
    // Has active session → go to dashboard
    navigate(getDashboardUrl());
  } else {
    // No session → go to login page
    navigate('/auth/login');
  }
};
```

## Token Validation

### JWT Expiration Check
```javascript
const decoded = jwtDecode(token);
const currentTime = Date.now() / 1000;

if (decoded.exp && decoded.exp < currentTime) {
  // Token expired → clear session
  clearAuthSession();
  return null;
}
```

### Session Data Validation
1. **Token exists** - Check localStorage
2. **Token valid** - Decode and check expiration
3. **Tenant slug exists** - Required for routing
4. **User data exists** - Required for context
5. **User data parseable** - Valid JSON

If any check fails → clear session and show login form

## User Flow

### Scenario 1: User dengan Sesi Aktif
1. User buka landing page
2. Klik tombol "Masuk"
3. System check: token valid ✅, tenant_slug ada ✅
4. **Instant redirect** ke `/{tenantSlug}/admin/dashboard`
5. No login form, no Google Auth trigger

### Scenario 2: User dengan Token Expired
1. User buka landing page
2. Klik tombol "Masuk"
3. System check: token expired ❌
4. **Auto clear** localStorage
5. Show login form
6. User login seperti biasa

### Scenario 3: User Baru (Belum Login)
1. User buka landing page
2. Klik tombol "Masuk"
3. System check: no token ❌
4. Show login form
5. User login seperti biasa

## Benefits

### 1. Prevents Auth Loops
- No more `n.info is not a function` errors
- No duplicate auth attempts
- Clean session management

### 2. Preserves Context
- `tenant_slug` tidak terhapus
- User data tetap tersimpan
- Smooth navigation

### 3. Better UX
- Instant access untuk returning users
- No unnecessary login steps
- Professional feel

### 4. Security
- Token expiration check
- Auto cleanup expired sessions
- Safe error handling

## Testing

### Test Case 1: Active Session
```
1. Login ke dashboard
2. Buka tab baru → landing page
3. Klik "Masuk"
Expected: Langsung ke dashboard tanpa login form
```

### Test Case 2: Expired Token
```
1. Login ke dashboard
2. Tunggu token expire (atau manipulasi localStorage)
3. Klik "Masuk"
Expected: Show login form, localStorage cleared
```

### Test Case 3: No Session
```
1. Clear localStorage
2. Buka landing page
3. Klik "Masuk"
Expected: Show login form
```

### Test Case 4: Corrupted Data
```
1. Set invalid JSON di localStorage.user
2. Klik "Masuk"
Expected: Auto clear, show login form, no crash
```

## Files Modified

1. **frontend/src/utils/authHelper.js** (NEW)
   - Token validation utilities
   - Session management functions

2. **frontend/src/pages/auth/GlobalLogin.jsx**
   - Added session check on mount
   - Added loading state
   - Auto-redirect logic

3. **frontend/src/pages/auth/SimpleLogin.jsx**
   - Added session check on mount
   - Added loading state
   - Auto-redirect logic

4. **frontend/src/pages/LandingPage.jsx**
   - Added handleLoginClick with session check

5. **frontend/src/components/landing/LandingNavbar.jsx**
   - Changed Link to button with onClick
   - Added session check logic

## Console Logs for Debugging

```javascript
// Active session found
[AUTH] Active session found { tenantSlug, userId, userEmail }
[GLOBAL LOGIN] Active session detected, redirecting to dashboard
[NAVBAR] Active session found, redirecting to dashboard

// Token expired
[AUTH] Token expired { exp, now }
[AUTH] Clearing session data

// Invalid data
[AUTH] Failed to parse user data
[AUTH] Invalid user object
```

## Future Enhancements

1. **Silent Token Refresh**
   - Auto refresh token sebelum expire
   - Seamless session extension

2. **Session Timeout Warning**
   - Show modal 5 minutes before expire
   - Option to extend session

3. **Multi-Tab Sync**
   - Sync logout across tabs
   - Broadcast channel for session updates

4. **Remember Me**
   - Longer session duration
   - Persistent login option

## Conclusion

Fitur auto-redirect memberikan pengalaman yang lebih smooth dan professional untuk user yang sudah login, sambil tetap menjaga keamanan dengan validasi token yang proper.
