# Email Verification & Google Auth Guide

## 📧 Email Verification System

### Overview
Sistem registrasi SuperKafe sekarang menggunakan email verification dengan OTP (One-Time Password) 6 digit untuk keamanan yang lebih baik.

### Flow Registrasi

```
1. User mengisi form registrasi (name, slug, email, password)
   ↓
2. Backend membuat tenant + database
   ↓
3. Backend membuat user admin dengan isVerified=false
   ↓
4. Backend generate OTP 6 digit
   ↓
5. Backend kirim OTP ke email user
   ↓
6. User memasukkan OTP di halaman verifikasi
   ↓
7. Backend verify OTP
   ↓
8. User.isVerified = true
   ↓
9. User dapat login
```

### API Endpoints

#### 1. Register Tenant (dengan Email)
```bash
POST /api/tenants/register
Content-Type: application/json

{
  "name": "Zona Mapan Coffee",
  "slug": "zona-mapan",
  "email": "admin@zonamapan.com",
  "password": "securepassword123",
  "adminName": "John Doe" // optional
}

Response:
{
  "success": true,
  "message": "Tenant berhasil didaftarkan. Silakan cek email Anda untuk kode verifikasi.",
  "data": {
    "id": "...",
    "name": "Zona Mapan Coffee",
    "slug": "zona-mapan",
    "email": "admin@zonamapan.com",
    "requiresVerification": true
  }
}
```

#### 2. Verify OTP
```bash
POST /api/verify/otp
Content-Type: application/json

{
  "email": "admin@zonamapan.com",
  "otpCode": "123456",
  "tenantSlug": "zona-mapan"
}

Response:
{
  "success": true,
  "message": "Email berhasil diverifikasi! Anda sekarang dapat login.",
  "data": {
    "email": "admin@zonamapan.com",
    "name": "John Doe",
    "isVerified": true
  }
}
```

#### 3. Resend OTP
```bash
POST /api/verify/resend-otp
Content-Type: application/json

{
  "email": "admin@zonamapan.com",
  "tenantSlug": "zona-mapan"
}

Response:
{
  "success": true,
  "message": "Kode OTP baru telah dikirim ke email Anda"
}
```

### Email Templates

#### OTP Email
- Subject: `Kode Verifikasi SuperKafe - [Tenant Name]`
- Content: Glassmorphism design dengan OTP 6 digit
- Expiry: 10 menit
- Features:
  - Responsive design
  - Gradient background
  - Clear OTP display
  - Security warnings

#### Welcome Email
- Subject: `Selamat Datang di SuperKafe - [Tenant Name]`
- Content: Welcome message dengan informasi akun
- Features:
  - Login button
  - Account information
  - Next steps guide

### SMTP Configuration

#### Gmail Setup
1. Enable 2-Factor Authentication di Google Account
2. Generate App Password:
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Copy the generated password
3. Update .env:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   ```

#### Other SMTP Providers

**SendGrid:**
```
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

**Mailgun:**
```
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@your-domain.mailgun.org
SMTP_PASS=your-mailgun-password
```

**AWS SES:**
```
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=your-ses-smtp-username
SMTP_PASS=your-ses-smtp-password
```

### Database Schema Updates

#### Employee Model
```javascript
{
  // ... existing fields
  email: String, // Email untuk authentication
  isVerified: Boolean, // Status verifikasi email
  otpCode: String, // OTP code (6 digit)
  otpExpiry: Date, // Expiry time untuk OTP
  googleId: String, // Google ID untuk OAuth
  authProvider: String // 'local' atau 'google'
}
```

### Security Features

1. **Password Hashing**: Semua password di-hash dengan bcrypt (salt rounds: 10)
2. **OTP Expiry**: OTP berlaku 10 menit
3. **Email Validation**: Format email divalidasi dengan regex
4. **Password Strength**: Minimal 6 karakter
5. **Unique Email**: Email harus unik per tenant

### Error Handling

#### Common Errors
```javascript
// Email sudah terdaftar
{
  "success": false,
  "message": "Email sudah digunakan"
}

// OTP tidak valid
{
  "success": false,
  "message": "Kode OTP tidak valid"
}

// OTP expired
{
  "success": false,
  "message": "Kode OTP sudah kadaluarsa. Silakan minta kode baru."
}

// Email sudah terverifikasi
{
  "success": false,
  "message": "Email sudah terverifikasi"
}
```

---

## 🔐 Google Authentication

### Overview
SuperKafe mendukung login dengan Google OAuth untuk kemudahan dan keamanan.

### Flow Google Auth

```
1. User klik "Login with Google" di frontend
   ↓
2. Google OAuth popup muncul
   ↓
3. User pilih akun Google
   ↓
4. Frontend dapat ID Token dari Google
   ↓
5. Frontend kirim ID Token + tenant slug ke backend
   ↓
6. Backend verify token dengan Google
   ↓
7. Backend cari/buat user di database tenant
   ↓
8. Backend return JWT token
   ↓
9. User logged in
```

### Setup Google OAuth

#### 1. Create Google OAuth Credentials
1. Go to: https://console.cloud.google.com/
2. Create new project atau pilih existing
3. Enable Google+ API
4. Go to Credentials → Create Credentials → OAuth 2.0 Client ID
5. Application type: Web application
6. Authorized JavaScript origins:
   - `http://localhost:5002` (development)
   - `https://yourdomain.com` (production)
7. Authorized redirect URIs:
   - `http://localhost:5002/auth/callback` (development)
   - `https://yourdomain.com/auth/callback` (production)
8. Copy Client ID and Client Secret

#### 2. Update .env
```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

### API Endpoint

#### Google Auth
```bash
POST /api/auth/google
Content-Type: application/json

{
  "idToken": "google-id-token-here",
  "tenantSlug": "zona-mapan"
}

Response:
{
  "success": true,
  "message": "Login dengan Google berhasil",
  "token": "jwt-token-here",
  "user": {
    "id": "EMP-xxx",
    "username": "johndoe",
    "email": "john@gmail.com",
    "name": "John Doe",
    "role": "admin",
    "isVerified": true,
    "authProvider": "google"
  }
}
```

### Frontend Integration

#### Install Google OAuth Library
```bash
npm install @react-oauth/google
```

#### Setup Google OAuth Provider
```jsx
import { GoogleOAuthProvider } from '@react-oauth/google';

function App() {
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      {/* Your app */}
    </GoogleOAuthProvider>
  );
}
```

#### Google Login Button
```jsx
import { GoogleLogin } from '@react-oauth/google';
import { tenantAPI } from './services/api';

function LoginPage() {
  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const tenantSlug = localStorage.getItem('tenant_slug') || 'warkop-pusat';
      
      const response = await axios.post('/api/auth/google', {
        idToken: credentialResponse.credential,
        tenantSlug: tenantSlug
      });

      if (response.data.success) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        // Redirect to dashboard
      }
    } catch (error) {
      console.error('Google login failed:', error);
    }
  };

  return (
    <GoogleLogin
      onSuccess={handleGoogleSuccess}
      onError={() => console.log('Login Failed')}
    />
  );
}
```

### User Creation Logic

#### First Google User
- Automatically becomes **admin**
- Has full access to all features
- Email is pre-verified (Google verified)

#### Subsequent Google Users
- Role: **kasir** (default)
- Can be changed by admin
- Email is pre-verified

### Security Considerations

1. **Token Verification**: ID Token diverifikasi dengan Google API
2. **Tenant Isolation**: User hanya bisa akses tenant yang sesuai dengan slug
3. **No Password**: Google auth users tidak memiliki password
4. **Email Verified**: Email dari Google sudah terverifikasi otomatis

### Troubleshooting

#### Error: "Google token tidak valid"
- Pastikan GOOGLE_CLIENT_ID di .env benar
- Cek apakah token sudah expired
- Verify authorized origins di Google Console

#### Error: "Tenant tidak ditemukan"
- Pastikan tenant_slug benar
- Cek apakah tenant aktif (isActive: true)

#### User tidak bisa login setelah Google auth
- Cek apakah user.isActive = true
- Cek apakah tenant.isActive = true
- Verify JWT token generation

---

## 🧪 Testing

### Test Email Verification
```bash
# 1. Register tenant
curl -X POST http://localhost:5001/api/tenants/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Coffee",
    "slug": "test-coffee",
    "email": "test@example.com",
    "password": "password123"
  }'

# 2. Check email for OTP code

# 3. Verify OTP
curl -X POST http://localhost:5001/api/verify/otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "otpCode": "123456",
    "tenantSlug": "test-coffee"
  }'

# 4. Login
curl -X POST http://localhost:5001/api/login \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: test-coffee" \
  -d '{
    "username": "test@example.com",
    "password": "password123"
  }'
```

### Test Google Auth
```bash
# Get Google ID Token from frontend, then:
curl -X POST http://localhost:5001/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{
    "idToken": "google-id-token-here",
    "tenantSlug": "test-coffee"
  }'
```

---

## 📝 Best Practices

1. **Email Verification**: Always verify email before allowing login
2. **OTP Security**: Never log OTP codes in production
3. **Password Strength**: Enforce strong password requirements
4. **Rate Limiting**: Implement rate limiting for OTP requests
5. **SMTP Reliability**: Use reliable SMTP provider (SendGrid, AWS SES)
6. **Google OAuth**: Keep Client Secret secure, never expose to frontend
7. **JWT Expiry**: Set appropriate expiry time (7 days recommended)
8. **Error Messages**: Don't reveal too much information in error messages

---

## 🔄 Migration from Old System

If you have existing tenants with default password:

```bash
# Users need to:
1. Request password reset (future feature)
2. Or admin can manually update password in database
3. Or use Google OAuth for easier login
```

---

## 📞 Support

For issues with email verification or Google auth:
1. Check SMTP configuration
2. Verify Google OAuth credentials
3. Check logs for detailed error messages
4. Test with different email providers
