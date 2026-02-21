# ✅ Google OAuth Deployment Checklist
## SuperKafe Multi-Tenant System

---

## 📋 Pre-Deployment Verification

### 1. Backend Configuration

```bash
cd backend
cat .env | grep GOOGLE
```

**Expected Output:**
```
GOOGLE_CLIENT_ID=706624374984-qg1ueivbvougs0gff3842jkgvf9qurno.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
```

- [ ] GOOGLE_CLIENT_ID configured
- [ ] GOOGLE_CLIENT_SECRET configured
- [ ] FRONTEND_URL set to production URL
- [ ] JWT_SECRET configured
- [ ] MONGODB_URI configured

### 2. Frontend Configuration

```bash
cd frontend
cat .env | grep GOOGLE
```

**Expected Output:**
```
VITE_GOOGLE_CLIENT_ID=706624374984-qg1ueivbvougs0gff3842jkgvf9qurno.apps.googleusercontent.com
```

- [ ] VITE_GOOGLE_CLIENT_ID configured
- [ ] VITE_API_URL points to production API

### 3. Google Cloud Console

Login ke: https://console.cloud.google.com/

**Verify Credentials:**
- [ ] Client ID: `706624374984-qg1ueivbvougs0gff3842jkgvf9qurno.apps.googleusercontent.com`
- [ ] Client Secret: `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`

**Authorized JavaScript Origins:**
- [ ] `https://superkafe.com`
- [ ] `http://localhost:5174` (for development)

**Authorized Redirect URIs:**
- [ ] `https://superkafe.com/api/auth/google/callback`
- [ ] `http://localhost:5001/api/auth/google/callback` (for development)

### 4. Code Verification

```bash
# Check controller
cat backend/controllers/GoogleAuthController.js | grep "const googleAuth"
cat backend/controllers/GoogleAuthController.js | grep "const googleCallback"

# Check routes
cat backend/routes/googleAuthRoutes.js | grep "router.post"
cat backend/routes/googleAuthRoutes.js | grep "router.get"

# Check server.js
cat backend/server.js | grep "googleAuthRoutes"
```

- [ ] `googleAuth` function exists
- [ ] `googleCallback` function exists
- [ ] POST `/api/auth/google` route registered
- [ ] GET `/api/auth/google/callback` route registered
- [ ] Routes mounted in `server.js`

---

## 🚀 Deployment Steps

### Step 1: Backup Database

```bash
# Backup main database
mongodump --uri="mongodb://..." --db=superkafe_v2 --out=/backup/$(date +%Y%m%d)

# Backup tenant databases
mongodump --uri="mongodb://..." --db=superkafe_demo --out=/backup/$(date +%Y%m%d)
```

- [ ] Main database backed up
- [ ] Tenant databases backed up
- [ ] Backup verified

### Step 2: Update Code

```bash
# Pull latest code
cd /path/to/superkafe
git pull origin main

# Verify files
ls -la backend/controllers/GoogleAuthController.js
ls -la backend/routes/googleAuthRoutes.js
ls -la backend/.env
ls -la frontend/.env
```

- [ ] Code pulled successfully
- [ ] All files present
- [ ] No merge conflicts

### Step 3: Install Dependencies

```bash
# Backend
cd backend
npm install

# Verify google-auth-library
npm list google-auth-library
# Expected: google-auth-library@10.5.0

# Frontend (if needed)
cd ../frontend
npm install @react-oauth/google
```

- [ ] Backend dependencies installed
- [ ] `google-auth-library` version 10.5.0+
- [ ] Frontend dependencies installed (if implementing UI)

### Step 4: Build & Deploy

```bash
# Stop services
docker-compose down

# Rebuild images
docker-compose build backend
docker-compose build frontend

# Start services
docker-compose up -d

# Verify containers
docker ps
```

- [ ] Containers stopped
- [ ] Images rebuilt
- [ ] Containers started
- [ ] All containers running

### Step 5: Verify Services

```bash
# Check backend logs
docker logs superkafe-backend | tail -50

# Check for errors
docker logs superkafe-backend | grep -i error

# Check Google auth routes
docker logs superkafe-backend | grep "GOOGLE"
```

**Expected Logs:**
```
✅ Connected to MongoDB
🚀 Server running on port 5001
📁 Static uploads folder: /usr/src/app/public/uploads
```

- [ ] Backend started successfully
- [ ] No critical errors
- [ ] MongoDB connected
- [ ] Routes loaded

---

## 🧪 Testing Phase

### Test 1: Health Check

```bash
# Backend health
curl https://superkafe.com/api/test

# Expected: 200 OK
```

- [ ] Backend accessible
- [ ] API responding

### Test 2: Google Auth Endpoint

```bash
# Test with invalid token (should return 401)
curl -X POST https://superkafe.com/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{"idToken":"invalid","tenantSlug":"demo"}'

# Expected: 401 Unauthorized
# Response: {"success":false,"message":"Google token tidak valid"}
```

- [ ] Endpoint accessible
- [ ] Returns proper error for invalid token

### Test 3: Auto-Register (New User)

**Get Google ID Token:**
1. Go to: https://developers.google.com/oauthplayground/
2. Select: Google OAuth2 API v2
3. Authorize and get `id_token`

```bash
# Test with real token
curl -X POST https://superkafe.com/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{
    "idToken": "PASTE_REAL_TOKEN_HERE",
    "tenantSlug": "demo"
  }'

# Expected: 200 OK
# Response: {"success":true,"isNewUser":true,"token":"...","user":{...}}
```

**Verify in Database:**
```bash
mongo superkafe_demo
db.employees.findOne({ authProvider: "google" })
```

**Expected Fields:**
```javascript
{
  id: "EMP-...",
  email: "user@gmail.com",
  name: "User Name",              // ✅ From Google
  image: "https://lh3.google...", // ✅ From Google
  googleId: "1234567890",         // ✅ Google User ID
  authProvider: "google",
  isVerified: true,
  password: null,
  role: "admin"
}
```

- [ ] User created successfully
- [ ] Name from Google saved
- [ ] Profile picture from Google saved
- [ ] `googleId` populated
- [ ] `isVerified` is true
- [ ] `password` is null
- [ ] JWT token returned

### Test 4: Auto-Login (Existing User)

```bash
# Login with same token again
curl -X POST https://superkafe.com/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{
    "idToken": "SAME_TOKEN_AS_ABOVE",
    "tenantSlug": "demo"
  }'

# Expected: 200 OK
# Response: {"success":true,"isNewUser":false,"token":"...","user":{...}}
```

- [ ] Login successful
- [ ] `isNewUser` is false
- [ ] Same user data returned
- [ ] New JWT token generated

### Test 5: Redirect Flow

**Browser Test:**
1. Open: `https://superkafe.com/login`
2. Click "Login via Google" button
3. Select Google account
4. Observe redirect

**Expected Behavior:**
- [ ] Google popup appears
- [ ] User can select account
- [ ] Redirect to: `https://superkafe.com/auth/callback?token=...&tenant=...&isNewUser=...`
- [ ] Token in URL
- [ ] Frontend saves token
- [ ] Redirect to dashboard

### Test 6: Multi-Tenant Isolation

```bash
# Create second tenant
mongo superkafe_v2
db.tenants.insertOne({
  name: "Test Cafe",
  slug: "test",
  dbName: "superkafe_test",
  isActive: true,
  status: "trial",
  trialExpiresAt: new Date(Date.now() + 10*24*60*60*1000)
})

# Login to different tenant
curl -X POST https://superkafe.com/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{
    "idToken": "GOOGLE_TOKEN",
    "tenantSlug": "test"
  }'
```

**Verify:**
```bash
# Check user in test tenant database
mongo superkafe_test
db.employees.findOne({ authProvider: "google" })

# Should be separate from demo tenant
```

- [ ] User created in correct tenant database
- [ ] Tenant isolation working
- [ ] JWT includes correct tenant info

---

## 🔒 Security Verification

### 1. HTTPS Configuration

```bash
# Check SSL certificate
curl -I https://superkafe.com

# Expected: HTTP/2 200
```

- [ ] HTTPS enabled
- [ ] Valid SSL certificate
- [ ] No mixed content warnings

### 2. CORS Configuration

```bash
# Check CORS headers
curl -I https://superkafe.com/api/auth/google \
  -H "Origin: https://superkafe.com"

# Expected headers:
# Access-Control-Allow-Origin: https://superkafe.com
# Access-Control-Allow-Credentials: true
```

- [ ] CORS configured
- [ ] Credentials allowed
- [ ] Origin whitelist correct

### 3. Token Security

```bash
# Decode JWT token (use jwt.io)
# Verify payload includes:
# - id
# - email
# - role
# - tenant
# - tenantDbName
# - exp (7 days from now)
```

- [ ] JWT includes required fields
- [ ] Expiry set to 7 days
- [ ] Signed with JWT_SECRET

### 4. Environment Variables

```bash
# Verify secrets not exposed
curl https://superkafe.com/api/test

# Should NOT return:
# - GOOGLE_CLIENT_SECRET
# - JWT_SECRET
# - MONGODB_URI
```

- [ ] Secrets not exposed in API
- [ ] Environment variables secure
- [ ] No sensitive data in logs

---

## 📊 Monitoring Setup

### 1. Log Monitoring

```bash
# Real-time logs
docker logs -f superkafe-backend | grep "GOOGLE AUTH"

# Error logs
docker logs superkafe-backend 2>&1 | grep -i error | tail -50
```

**Expected Logs:**
```
[GOOGLE AUTH] Token verified for: { email: '...', name: '...', picture: '...' }
[GOOGLE AUTH] ✅ Auto-Login - Email sudah terdaftar: { ... }
[GOOGLE AUTH] 🆕 Auto-Register - Akun baru dibuat: { ... }
```

- [ ] Logs showing successful auth
- [ ] No error logs
- [ ] User data logged correctly

### 2. Database Monitoring

```bash
# Count Google users
mongo superkafe_demo
db.employees.count({ authProvider: "google" })

# Check recent registrations
db.employees.find({ authProvider: "google" }).sort({ createdAt: -1 }).limit(5)
```

- [ ] Google users tracked
- [ ] Registration timestamps correct
- [ ] Data integrity maintained

### 3. Performance Monitoring

```bash
# Response time test
time curl -X POST https://superkafe.com/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{"idToken":"test","tenantSlug":"demo"}'

# Expected: < 2 seconds
```

- [ ] Response time acceptable
- [ ] No timeout errors
- [ ] Server load normal

---

## 🐛 Rollback Plan

### If Issues Occur:

```bash
# 1. Stop services
docker-compose down

# 2. Restore previous version
git checkout HEAD~1

# 3. Rebuild
docker-compose build

# 4. Start services
docker-compose up -d

# 5. Restore database (if needed)
mongorestore --uri="mongodb://..." --db=superkafe_v2 /backup/YYYYMMDD/superkafe_v2
```

- [ ] Rollback procedure documented
- [ ] Backup available
- [ ] Team notified

---

## ✅ Final Checklist

### Backend
- [ ] Code deployed
- [ ] Environment variables configured
- [ ] Dependencies installed
- [ ] Services running
- [ ] Logs clean

### Frontend
- [ ] Code deployed
- [ ] Environment variables configured
- [ ] Google Sign-In button working
- [ ] Callback page functional
- [ ] Token storage working

### Database
- [ ] Backup created
- [ ] Connections stable
- [ ] Indexes created
- [ ] Data integrity verified

### Security
- [ ] HTTPS enabled
- [ ] CORS configured
- [ ] Secrets secure
- [ ] Token validation working

### Testing
- [ ] Health check passed
- [ ] Auto-register tested
- [ ] Auto-login tested
- [ ] Multi-tenant tested
- [ ] Redirect flow tested

### Monitoring
- [ ] Logs monitored
- [ ] Errors tracked
- [ ] Performance acceptable
- [ ] Alerts configured

### Documentation
- [ ] Implementation guide available
- [ ] Quick start guide available
- [ ] API documentation updated
- [ ] Team trained

---

## 🎉 Deployment Complete!

**Sign-off:**

- [ ] Technical Lead approved
- [ ] QA testing passed
- [ ] Production deployment successful
- [ ] Monitoring active
- [ ] Team notified

**Date**: _______________
**Deployed By**: _______________
**Verified By**: _______________

---

## 📞 Support Contacts

**If issues occur:**

1. Check logs: `docker logs superkafe-backend`
2. Verify database: `mongo superkafe_v2`
3. Test endpoints: `curl https://superkafe.com/api/test`
4. Review documentation: `GOOGLE_OAUTH_IMPLEMENTATION.md`

**Emergency Rollback:**
```bash
git checkout HEAD~1
docker-compose down && docker-compose up -d
```

---

**Status**: Ready for Production ✅
**Last Updated**: 2024
**Version**: 1.0.0
