# Environment Variables Guide

This document describes all environment variables used by the SuperKafe backend application, including validation rules and setup instructions.

## Overview

The application validates all required environment variables on startup. If any required variables are missing or invalid, the application will exit with a clear error message indicating which variables need to be fixed.

## Required Variables

These variables **MUST** be set for the application to start:

### MONGODB_URI

**Description**: MongoDB connection string for the unified database

**Format**: 
- Local: `mongodb://[username:password@]host[:port]/superkafe_v2`
- Atlas: `mongodb+srv://[username:password@]cluster/superkafe_v2`

**Validation Rules**:
- Must start with `mongodb://` or `mongodb+srv://`
- Must be a valid MongoDB connection string

**Example**:
```bash
# Local MongoDB
MONGODB_URI=mongodb://localhost:27017/superkafe_v2

# MongoDB Atlas
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/superkafe_v2
```

### JWT_SECRET

**Description**: Secret key used for signing JWT authentication tokens

**Validation Rules**:
- Must be at least 32 characters long for security
- Should be a random, unpredictable string

**How to Generate**:
```bash
# Using Node.js crypto module
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using OpenSSL
openssl rand -hex 32
```

**Example**:
```bash
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

### PORT

**Description**: Port number for the HTTP server

**Validation Rules**:
- Must be a valid port number (1-65535)
- Defaults to 5001 if not provided

**Example**:
```bash
PORT=5001
```

## Optional Variables

These variables are optional and enable specific features:

### API_KEY

**Description**: API key for external integrations

**Example**:
```bash
API_KEY=your-superkafe-api-key-here
```

### SMTP Configuration

Required for email verification features:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### Google OAuth

Required for Google authentication:

```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

### Frontend URLs

```bash
FRONTEND_URL=https://superkafe.com
FRONTEND_URL_DEV=http://localhost:5174
```

### Payment Gateway (Duitku)

```bash
PAYMENT_PROVIDER=duitku
DUITKU_MODE=sandbox
DUITKU_MERCHANT_CODE=your_merchant_code
DUITKU_API_KEY=your_api_key
BACKEND_URL=http://localhost:5001
```

## Setup Instructions

### 1. Create .env File

Copy the example file:

```bash
cd backend
cp .env.example .env
```

### 2. Fill Required Variables

Edit `.env` and set all required variables:

```bash
# Required
MONGODB_URI=mongodb://localhost:27017/superkafe_v2
JWT_SECRET=<generate-a-secure-random-string>
PORT=5001

# Optional (add as needed)
API_KEY=your-api-key
SMTP_HOST=smtp.gmail.com
# ... other optional variables
```

### 3. Start the Application

```bash
npm start
```

If validation fails, you'll see a clear error message:

```
❌ Environment variable validation failed!
   2 required variable(s) are missing or invalid:

   ❌ MONGODB_URI
      Description: MongoDB connection string
      Error: Variable is missing or empty

   ❌ JWT_SECRET
      Description: Secret key for JWT token signing
      Error: Variable is missing or empty

💡 Fix these issues:
   1. Create a .env file in the backend directory if it doesn't exist
   2. Copy .env.example to .env: cp .env.example .env
   3. Fill in all required environment variables
   4. Restart the application

📖 See backend/.env.example for reference
```

## Validation Behavior

### Startup Validation

The application validates environment variables **before** any other initialization:

1. Loads `.env` file using `dotenv`
2. Validates all required variables
3. If validation fails:
   - Logs detailed error messages
   - Exits with code 1 (fail-fast)
4. If validation succeeds:
   - Logs success message
   - Continues with application startup

### Error Messages

Validation errors include:

- **Variable name**: Which variable has an issue
- **Description**: What the variable is used for
- **Error**: Specific validation error
- **Instructions**: How to fix the issue

### Warnings

Missing optional variables generate warnings but don't prevent startup:

```
⚠️  3 optional environment variable(s) not set:
   - SMTP_HOST: SMTP server host for email sending
   - GOOGLE_CLIENT_ID: Google OAuth client ID
   - PAYMENT_PROVIDER: Payment gateway provider
```

## Testing

### Unit Tests

Test the validation logic:

```bash
npm test tests/utils/envValidator.test.js
```

### Integration Tests

Test server startup validation:

```bash
npm test tests/integration/serverStartup.test.js
```

## Troubleshooting

### "MONGODB_URI must start with mongodb://"

**Problem**: Invalid MongoDB connection string format

**Solution**: Ensure your connection string starts with `mongodb://` or `mongodb+srv://`

```bash
# ❌ Wrong
MONGODB_URI=localhost:27017/superkafe_v2

# ✅ Correct
MONGODB_URI=mongodb://localhost:27017/superkafe_v2
```

### "JWT_SECRET must be at least 32 characters long"

**Problem**: JWT secret is too short

**Solution**: Generate a secure random string:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### "PORT must be a valid port number"

**Problem**: Invalid port number

**Solution**: Use a valid port number (1-65535):

```bash
# ❌ Wrong
PORT=not-a-number
PORT=0
PORT=99999

# ✅ Correct
PORT=5001
PORT=3000
PORT=8080
```

### Application exits immediately on startup

**Problem**: Required environment variables are missing or invalid

**Solution**: 
1. Check the error message for specific variables
2. Update your `.env` file
3. Restart the application

## Security Best Practices

1. **Never commit `.env` files** to version control
2. **Use strong JWT secrets** (at least 32 characters, randomly generated)
3. **Rotate secrets regularly** in production
4. **Use different secrets** for development and production
5. **Restrict database access** with proper authentication
6. **Use environment-specific configurations** (dev, staging, production)

## Production Deployment

### Environment Variables in Production

Set environment variables through your hosting platform:

**Heroku**:
```bash
heroku config:set MONGODB_URI=mongodb+srv://...
heroku config:set JWT_SECRET=...
```

**Docker**:
```bash
docker run -e MONGODB_URI=mongodb://... -e JWT_SECRET=... app
```

**Docker Compose**:
```yaml
services:
  backend:
    environment:
      - MONGODB_URI=mongodb://...
      - JWT_SECRET=...
```

**Kubernetes**:
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: backend-secrets
data:
  mongodb-uri: <base64-encoded>
  jwt-secret: <base64-encoded>
```

### Validation in CI/CD

Ensure environment variables are validated in your CI/CD pipeline:

```yaml
# .github/workflows/deploy.yml
- name: Validate Environment
  run: |
    npm run validate:env
```

## Related Documentation

- [MongoDB Setup Guide](../MONGODB_SETUP_GUIDE.md)
- [Deployment Guide](../docs/DEPLOYMENT.md)
- [Security Best Practices](../docs/SECURITY.md)

## Support

If you encounter issues with environment variable configuration:

1. Check this documentation
2. Review error messages carefully
3. Verify `.env.example` for reference
4. Check application logs for details
