# Install Required Dependencies

## New Dependencies untuk Email Verification & Google Auth

Jalankan command berikut untuk menginstall dependencies yang diperlukan:

```bash
cd backend
npm install nodemailer google-auth-library
```

### Dependencies yang Ditambahkan:

1. **nodemailer** (^6.9.0)
   - Untuk mengirim email (OTP verification, welcome email)
   - Support berbagai SMTP providers (Gmail, SendGrid, AWS SES, dll)

2. **google-auth-library** (^9.0.0)
   - Untuk verifikasi Google ID Token
   - Required untuk Google OAuth integration

### Updated package.json

```json
{
  "dependencies": {
    "bcryptjs": "^3.0.3",
    "cloudinary": "^2.9.0",
    "compression": "^1.8.1",
    "cors": "^2.8.5",
    "dotenv": "^16.0.0",
    "express": "^4.18.2",
    "google-auth-library": "^9.0.0",
    "jsonwebtoken": "^9.0.0",
    "mongoose": "^7.0.0",
    "multer": "^2.0.2",
    "node-fetch": "3.3.2",
    "nodemailer": "^6.9.0",
    "socket.io": "^4.8.3",
    "xlsx": "^0.18.5"
  }
}
```

## Setup SMTP (Gmail Example)

1. Enable 2-Factor Authentication di Google Account
2. Generate App Password:
   - https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Copy generated password

3. Update `.env`:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

## Setup Google OAuth

1. Go to: https://console.cloud.google.com/
2. Create OAuth 2.0 Client ID
3. Copy Client ID and Secret
4. Update `.env`:
```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

## Verify Installation

```bash
# Check if dependencies installed
npm list nodemailer google-auth-library

# Test email service
node -e "const nodemailer = require('nodemailer'); console.log('✓ Nodemailer installed');"

# Test Google auth library
node -e "const {OAuth2Client} = require('google-auth-library'); console.log('✓ Google Auth Library installed');"
```

## Troubleshooting

### Error: Cannot find module 'nodemailer'
```bash
npm install nodemailer --save
```

### Error: Cannot find module 'google-auth-library'
```bash
npm install google-auth-library --save
```

### SMTP Connection Error
- Check SMTP credentials in .env
- Verify 2FA and App Password for Gmail
- Check firewall/network settings

### Google OAuth Error
- Verify GOOGLE_CLIENT_ID in .env
- Check authorized origins in Google Console
- Ensure token is not expired
