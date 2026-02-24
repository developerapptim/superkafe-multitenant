# Deployment Automation Guide

## Overview

The deployment automation script (`deploy.js`) provides a comprehensive, automated deployment process for the SuperKafe unified architecture. It handles environment validation, database connectivity checks, automatic initialization, and provides clear status messages throughout the deployment.

## Features

✅ **Pre-deployment Validation**
- Validates all required environment variables
- Checks database connectivity
- Verifies database name (must be `superkafe_v2`)
- Tests database operations

✅ **Automatic Initialization**
- Detects if database is empty
- Automatically runs `initUniverse` script if needed
- Creates default tenant "Negoes" with admin user
- Seeds basic menu data

✅ **Clear Status Messages**
- Color-coded console output
- Step-by-step progress tracking
- Detailed error messages with troubleshooting tips
- Success summary with next steps

✅ **Error Handling**
- Graceful error handling at each step
- Automatic rollback on failures
- Connection cleanup
- Exit codes for CI/CD integration

## Usage

### Manual Deployment

```bash
# From backend directory
npm run deploy

# Or directly
node scripts/deploy.js
```

### CI/CD Integration

The script is integrated into the GitHub Actions workflow (`.github/workflows/deploy.yml`):

```yaml
- name: Run deployment automation
  run: docker compose exec backend npm run deploy
```

### Docker Deployment

```bash
# Build and start containers
docker compose up -d

# Run deployment script inside container
docker compose exec backend npm run deploy
```

## Deployment Steps

The script executes the following steps in order:

### Step 1: Environment Validation

Validates all required environment variables:

**Required Variables:**
- `MONGODB_URI` - MongoDB connection string (must start with `mongodb://` or `mongodb+srv://`)
- `JWT_SECRET` - JWT signing secret (minimum 32 characters)
- `PORT` - Server port (optional, defaults to 5001)

**Optional Variables** (warnings only):
- `API_KEY` - External API key
- `SMTP_*` - Email configuration
- `GOOGLE_CLIENT_*` - OAuth configuration
- `PAYMENT_*` - Payment gateway configuration

**Example Output:**
```
📋 STEP 1: Validating Environment Variables
✅ All required environment variables are valid
⚠️  3 optional variable(s) not set:
   - SMTP_HOST: SMTP server host for email sending
   - GOOGLE_CLIENT_ID: Google OAuth client ID
   - PAYMENT_PROVIDER: Payment gateway provider
```

### Step 2: Database Connectivity

Tests connection to MongoDB:

- Connects to database with 10-second timeout
- Verifies database name is `superkafe_v2`
- Tests database operations (ping)
- Reports database statistics

**Example Output:**
```
🔌 STEP 2: Validating Database Connectivity
✅ Connected to database: superkafe_v2
✅ Database responding (5ms)

Database statistics:
   Collections: 12
   Data size: 2.45 MB
   Storage size: 1.23 MB
```

### Step 3: Initialization Check

Checks if database needs initialization:

- Counts existing tenants
- Checks for default tenant "negoes"
- Determines if initialization is needed

**Example Output (Empty Database):**
```
🔍 STEP 3: Checking Database Initialization Status
Found 0 tenant(s) in database
⚠️  Database is empty - initialization required
```

**Example Output (Initialized Database):**
```
🔍 STEP 3: Checking Database Initialization Status
Found 1 tenant(s) in database
✅ Database is initialized
   Default tenant: Negoes (negoes)
   Status: trial
   Active: true
```

### Step 4: Database Initialization (if needed)

Runs the `initUniverse` script if database is empty:

- Creates default tenant "Negoes"
- Creates admin user (admin@negoes.com)
- Creates employee record
- Seeds menu categories and items

**Example Output:**
```
🌌 STEP 4: Initializing Database
Running initUniverse script...

[initUniverse output...]

✅ Database initialized successfully
```

### Step 5: Final Validation

Verifies deployment success:

- Confirms default tenant exists
- Checks collection counts
- Reports final status

**Example Output:**
```
✅ STEP 5: Final Validation
✅ Default tenant verified
   Name: Negoes
   Slug: negoes
   Status: trial

✅ Database has 12 collections
```

## Success Output

When deployment completes successfully:

```
✅ DEPLOYMENT COMPLETED SUCCESSFULLY
Duration: 3.45 seconds
Database: superkafe_v2
Status: Ready for production

🎉 Next steps:
   1. Start the application: npm start
   2. Verify health endpoint: curl http://localhost:5001/health
   3. Login with credentials:
      Email: admin@negoes.com
      Password: admin123
   4. Monitor logs for any issues
```

## Error Handling

### Environment Validation Failure

```
❌ Environment validation failed!

   ❌ MONGODB_URI
      Description: MongoDB connection string
      Error: Variable is missing or empty

💡 Fix these issues:
   1. Create a .env file in the backend directory
   2. Copy .env.example to .env: cp .env.example .env
   3. Fill in all required environment variables
   4. Run deployment again
```

### Database Connectivity Failure

```
❌ Database connectivity check failed!
   Error: connect ECONNREFUSED 127.0.0.1:27017

💡 Troubleshooting:
   1. Verify MongoDB is running
   2. Check MONGODB_URI in .env file
   3. Verify network connectivity to MongoDB
   4. Check MongoDB logs for errors
   5. Ensure database superkafe_v2 exists
```

### Initialization Failure

```
❌ Database initialization failed!
   Error: Tenant creation failed

💡 Troubleshooting:
   1. Check the error message above
   2. Verify database permissions
   3. Check MongoDB logs
   4. Try running initUniverse manually: npm run init:universe
```

## Exit Codes

The script uses standard exit codes for CI/CD integration:

- `0` - Deployment successful
- `1` - Deployment failed (any step)

## Environment Setup

### Development

```bash
# 1. Copy environment template
cp backend/.env.example backend/.env

# 2. Edit environment variables
nano backend/.env

# 3. Run deployment
cd backend
npm run deploy
```

### Production

```bash
# 1. Set environment variables in CI/CD secrets
# - MONGODB_URI
# - JWT_SECRET
# - API_KEY (optional)
# - SMTP_* (optional)

# 2. Deploy via GitHub Actions
git push origin main

# 3. Monitor deployment logs
# GitHub Actions will automatically run the deployment script
```

### Docker

```bash
# 1. Create .env file
cp backend/.env.example backend/.env

# 2. Edit environment variables
nano backend/.env

# 3. Build and start containers
docker compose up -d

# 4. Run deployment inside container
docker compose exec backend npm run deploy
```

## Troubleshooting

### "Database is not superkafe_v2"

**Problem:** Connected to wrong database

**Solution:**
```bash
# Update MONGODB_URI to include database name
MONGODB_URI=mongodb://user:pass@host:port/superkafe_v2?authSource=admin
```

### "Connection timeout"

**Problem:** Cannot connect to MongoDB

**Solutions:**
1. Verify MongoDB is running: `systemctl status mongod`
2. Check firewall rules
3. Verify connection string format
4. Test connection: `mongosh "mongodb://..."`

### "JWT_SECRET too short"

**Problem:** JWT secret is less than 32 characters

**Solution:**
```bash
# Generate secure random secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Add to .env
JWT_SECRET=<generated-secret>
```

### "Deployment aborted: Final validation failed"

**Problem:** Initialization completed but validation failed

**Solutions:**
1. Check MongoDB logs for errors
2. Verify tenant was created: `npm run init:universe`
3. Check database manually:
   ```bash
   mongosh "mongodb://..."
   use superkafe_v2
   db.tenants.find()
   ```

## Manual Initialization

If you need to run initialization manually:

```bash
# Run initUniverse script directly
npm run init:universe

# Or
node scripts/initUniverse.js
```

## Verification

After deployment, verify the system is working:

```bash
# 1. Check health endpoint
curl http://localhost:5001/health

# Expected response:
# {
#   "success": true,
#   "status": "healthy",
#   "database": {
#     "connected": true,
#     "name": "superkafe_v2",
#     "responseTime": 5
#   }
# }

# 2. Verify tenant exists
curl http://localhost:5001/api/tenants

# 3. Test login
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@negoes.com","password":"admin123"}'
```

## Integration with CI/CD

### GitHub Actions

The deployment script is integrated into `.github/workflows/deploy.yml`:

```yaml
- name: Deploy to VPS
  run: |
    # Pull latest code
    git pull origin main
    
    # Update environment variables
    echo "MONGODB_URI=${{ secrets.MONGODB_URI }}" > backend/.env
    echo "JWT_SECRET=${{ secrets.JWT_SECRET }}" >> backend/.env
    
    # Restart containers
    docker compose down
    docker compose up -d
    
    # Run deployment automation
    docker compose exec backend npm run deploy
```

### GitLab CI

```yaml
deploy:
  stage: deploy
  script:
    - cd backend
    - npm run deploy
  only:
    - main
```

### Jenkins

```groovy
stage('Deploy') {
  steps {
    sh 'cd backend && npm run deploy'
  }
}
```

## Best Practices

1. **Always run deployment script after infrastructure changes**
   - Database migrations
   - Environment variable updates
   - Server restarts

2. **Monitor deployment logs**
   - Check for warnings
   - Verify all steps complete successfully
   - Review initialization output

3. **Test in staging first**
   - Run deployment in staging environment
   - Verify all functionality works
   - Then deploy to production

4. **Keep backups**
   - Backup database before deployment
   - Keep previous environment configuration
   - Document any manual changes

5. **Use secrets management**
   - Never commit .env files
   - Use CI/CD secrets for sensitive data
   - Rotate secrets regularly

## Related Scripts

- `initUniverse.js` - Database initialization script
- `verifyDatabase.js` - Database verification script
- `envValidator.js` - Environment variable validator
- `healthRoutes.js` - Health check endpoints

## Support

For issues or questions:

1. Check this guide first
2. Review error messages and troubleshooting tips
3. Check MongoDB logs
4. Verify environment configuration
5. Contact DevOps team if issue persists

## Changelog

### Version 1.0.0 (2024)
- Initial deployment automation script
- Environment validation
- Database connectivity checks
- Automatic initialization
- Error handling and rollback
- CI/CD integration
