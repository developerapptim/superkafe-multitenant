/**
 * ThemeController Unit Tests
 * 
 * Tests to verify theme validation and authorization functionality:
 * - Theme name validation against allowed presets
 * - User authorization (JWT tenantId vs route param)
 * - Proper error responses (400, 403, 404)
 * - Successful theme updates
 * 
 * Validates Requirements: 10.3, 10.4, 10.6
 * Task: 2.2 Implement theme validation and authorization
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const Tenant = require('../../models/Tenant');
const ThemeController = require('../../controllers/ThemeController');

let mongoServer;
let app;
let testTenantId;
let otherTenantId;
let validToken;
let otherTenantToken;

const JWT_SECRET = 'test-secret-key';

// Mock JWT middleware for testing
const mockCheckJwt = (req, res, next) => {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ error: 'Missing Authorization header' });
  if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'Invalid Authorization header' });

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

beforeAll(async () => {
  // Create in-memory MongoDB instance
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  await mongoose.connect(mongoUri);
  
  // Create test tenants
  const testTenant = await Tenant.create({
    name: 'Test Cafe',
    slug: 'test-cafe',
    dbName: 'superkafe_v2',
    selectedTheme: 'default',
    hasSeenThemePopup: false
  });
  testTenantId = testTenant._id.toString();

  const otherTenant = await Tenant.create({
    name: 'Other Cafe',
    slug: 'other-cafe',
    dbName: 'superkafe_v2',
    selectedTheme: 'default',
    hasSeenThemePopup: false
  });
  otherTenantId = otherTenant._id.toString();

  // Create JWT tokens
  validToken = jwt.sign(
    {
      userId: new mongoose.Types.ObjectId().toString(),
      tenantId: testTenantId,
      tenantSlug: 'test-cafe',
      email: 'test@example.com'
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  otherTenantToken = jwt.sign(
    {
      userId: new mongoose.Types.ObjectId().toString(),
      tenantId: otherTenantId,
      tenantSlug: 'other-cafe',
      email: 'other@example.com'
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Setup Express app for testing
  app = express();
  app.use(express.json());
  
  // Apply mock JWT middleware
  app.use(mockCheckJwt);
  
  // Theme routes
  app.get('/api/tenants/:tenantId/theme', ThemeController.getTheme);
  app.put('/api/tenants/:tenantId/theme', ThemeController.updateTheme);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Reset test tenant theme before each test
  await Tenant.findByIdAndUpdate(testTenantId, {
    selectedTheme: 'default',
    hasSeenThemePopup: false
  });
});

describe('ThemeController - Theme Validation and Authorization', () => {
  
  // ============================================================================
  // Requirement 10.4: Theme Name Validation
  // ============================================================================

  describe('PUT /api/tenants/:tenantId/theme - Theme Name Validation', () => {
    it('should return 400 for invalid theme name', async () => {
      const response = await request(app)
        .put(`/api/tenants/${testTenantId}/theme`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ theme: 'invalid-theme' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid theme name');
      expect(response.body.error).toContain('default');
      expect(response.body.error).toContain('light-coffee');
    });

    it('should return 400 when theme name is missing', async () => {
      const response = await request(app)
        .put(`/api/tenants/${testTenantId}/theme`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Theme name is required');
    });

    it('should accept "default" as valid theme', async () => {
      const response = await request(app)
        .put(`/api/tenants/${testTenantId}/theme`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ theme: 'default' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.theme).toBe('default');
    });

    it('should accept "light-coffee" as valid theme', async () => {
      const response = await request(app)
        .put(`/api/tenants/${testTenantId}/theme`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ theme: 'light-coffee' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.theme).toBe('light-coffee');
    });
  });

  // ============================================================================
  // Requirement 10.3: User Authorization
  // ============================================================================

  describe('PUT /api/tenants/:tenantId/theme - Authorization', () => {
    it('should return 403 when user tries to update another tenant\'s theme', async () => {
      const response = await request(app)
        .put(`/api/tenants/${otherTenantId}/theme`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ theme: 'light-coffee' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('permission');
    });

    it('should return 401 when no authorization token provided', async () => {
      const response = await request(app)
        .put(`/api/tenants/${testTenantId}/theme`)
        .send({ theme: 'light-coffee' });

      expect(response.status).toBe(401);
    });

    it('should allow user to update their own tenant\'s theme', async () => {
      const response = await request(app)
        .put(`/api/tenants/${testTenantId}/theme`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ theme: 'light-coffee' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/tenants/:tenantId/theme - Authorization', () => {
    it('should return 403 when user tries to access another tenant\'s theme', async () => {
      const response = await request(app)
        .get(`/api/tenants/${otherTenantId}/theme`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('permission');
    });

    it('should return 401 when no authorization token provided', async () => {
      const response = await request(app)
        .get(`/api/tenants/${testTenantId}/theme`);

      expect(response.status).toBe(401);
    });

    it('should allow user to access their own tenant\'s theme', async () => {
      const response = await request(app)
        .get(`/api/tenants/${testTenantId}/theme`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('theme');
      expect(response.body).toHaveProperty('hasSeenThemePopup');
    });
  });

  // ============================================================================
  // Requirement 10.6: Tenant Not Found (404)
  // ============================================================================

  describe('PUT /api/tenants/:tenantId/theme - Tenant Not Found', () => {
    it('should return 404 when tenant does not exist', async () => {
      const nonExistentTenantId = new mongoose.Types.ObjectId().toString();
      const tokenForNonExistent = jwt.sign(
        {
          userId: new mongoose.Types.ObjectId().toString(),
          tenantId: nonExistentTenantId,
          tenantSlug: 'non-existent',
          email: 'test@example.com'
        },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .put(`/api/tenants/${nonExistentTenantId}/theme`)
        .set('Authorization', `Bearer ${tokenForNonExistent}`)
        .send({ theme: 'light-coffee' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Tenant not found');
    });

    it('should return 400 for invalid tenant ID format', async () => {
      const response = await request(app)
        .put('/api/tenants/invalid-id/theme')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ theme: 'light-coffee' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid tenant ID format');
    });
  });

  describe('GET /api/tenants/:tenantId/theme - Tenant Not Found', () => {
    it('should return 404 when tenant does not exist', async () => {
      const nonExistentTenantId = new mongoose.Types.ObjectId().toString();
      const tokenForNonExistent = jwt.sign(
        {
          userId: new mongoose.Types.ObjectId().toString(),
          tenantId: nonExistentTenantId,
          tenantSlug: 'non-existent',
          email: 'test@example.com'
        },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get(`/api/tenants/${nonExistentTenantId}/theme`)
        .set('Authorization', `Bearer ${tokenForNonExistent}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Tenant not found');
    });
  });

  // ============================================================================
  // Successful Theme Operations
  // ============================================================================

  describe('Theme Update Success', () => {
    it('should successfully update theme and persist to database', async () => {
      const response = await request(app)
        .put(`/api/tenants/${testTenantId}/theme`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ theme: 'light-coffee' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.theme).toBe('light-coffee');
      expect(response.body.message).toContain('successfully');

      // Verify database was updated
      const tenant = await Tenant.findById(testTenantId);
      expect(tenant.selectedTheme).toBe('light-coffee');
    });

    it('should return updated theme when fetching after update', async () => {
      // Update theme
      await request(app)
        .put(`/api/tenants/${testTenantId}/theme`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ theme: 'light-coffee' });

      // Fetch theme
      const response = await request(app)
        .get(`/api/tenants/${testTenantId}/theme`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.theme).toBe('light-coffee');
    });
  });
});
