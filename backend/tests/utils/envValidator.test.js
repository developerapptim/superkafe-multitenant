/**
 * Unit Tests for Environment Variable Validator
 * 
 * Tests environment variable validation logic including:
 * - Required variable presence
 * - Format validation (MONGODB_URI)
 * - Security validation (JWT_SECRET length)
 * - Port number validation
 * - Clear error messages
 * 
 * Requirements: 12.1, 12.4
 */

const { validateEnvironmentVariables, REQUIRED_ENV_VARS } = require('../../utils/envValidator');

describe('Environment Variable Validator', () => {
  let originalEnv;
  
  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });
  
  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });
  
  describe('MONGODB_URI validation', () => {
    it('should pass with valid mongodb:// URI', () => {
      process.env.MONGODB_URI = 'mongodb://localhost:27017/superkafe_v2';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.PORT = '5001';
      
      const result = validateEnvironmentVariables();
      
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should pass with valid mongodb+srv:// URI', () => {
      process.env.MONGODB_URI = 'mongodb+srv://user:pass@cluster.mongodb.net/superkafe_v2';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.PORT = '5001';
      
      const result = validateEnvironmentVariables();
      
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should fail when MONGODB_URI is missing', () => {
      delete process.env.MONGODB_URI;
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.PORT = '5001';
      
      const result = validateEnvironmentVariables();
      
      expect(result.success).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          variable: 'MONGODB_URI',
          error: 'Variable is missing or empty'
        })
      );
    });
    
    it('should fail when MONGODB_URI is empty', () => {
      process.env.MONGODB_URI = '';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.PORT = '5001';
      
      const result = validateEnvironmentVariables();
      
      expect(result.success).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          variable: 'MONGODB_URI',
          error: 'Variable is missing or empty'
        })
      );
    });
    
    it('should fail when MONGODB_URI has invalid format', () => {
      process.env.MONGODB_URI = 'http://localhost:27017/db';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.PORT = '5001';
      
      const result = validateEnvironmentVariables();
      
      expect(result.success).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          variable: 'MONGODB_URI',
          error: 'MONGODB_URI must start with mongodb:// or mongodb+srv://'
        })
      );
    });
  });
  
  describe('JWT_SECRET validation', () => {
    it('should pass with JWT_SECRET of 32+ characters', () => {
      process.env.MONGODB_URI = 'mongodb://localhost:27017/superkafe_v2';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.PORT = '5001';
      
      const result = validateEnvironmentVariables();
      
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should fail when JWT_SECRET is missing', () => {
      process.env.MONGODB_URI = 'mongodb://localhost:27017/superkafe_v2';
      delete process.env.JWT_SECRET;
      process.env.PORT = '5001';
      
      const result = validateEnvironmentVariables();
      
      expect(result.success).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          variable: 'JWT_SECRET',
          error: 'Variable is missing or empty'
        })
      );
    });
    
    it('should fail when JWT_SECRET is too short', () => {
      process.env.MONGODB_URI = 'mongodb://localhost:27017/superkafe_v2';
      process.env.JWT_SECRET = 'short';
      process.env.PORT = '5001';
      
      const result = validateEnvironmentVariables();
      
      expect(result.success).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          variable: 'JWT_SECRET',
          error: 'JWT_SECRET must be at least 32 characters long for security'
        })
      );
    });
  });
  
  describe('PORT validation', () => {
    it('should use default PORT when not provided', () => {
      process.env.MONGODB_URI = 'mongodb://localhost:27017/superkafe_v2';
      process.env.JWT_SECRET = 'a'.repeat(32);
      delete process.env.PORT;
      
      const result = validateEnvironmentVariables();
      
      expect(result.success).toBe(true);
      expect(process.env.PORT).toBe('5001');
    });
    
    it('should pass with valid PORT number', () => {
      process.env.MONGODB_URI = 'mongodb://localhost:27017/superkafe_v2';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.PORT = '3000';
      
      const result = validateEnvironmentVariables();
      
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should fail when PORT is not a number', () => {
      process.env.MONGODB_URI = 'mongodb://localhost:27017/superkafe_v2';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.PORT = 'not-a-number';
      
      const result = validateEnvironmentVariables();
      
      expect(result.success).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          variable: 'PORT',
          error: 'PORT must be a valid port number (1-65535)'
        })
      );
    });
    
    it('should fail when PORT is out of range (too low)', () => {
      process.env.MONGODB_URI = 'mongodb://localhost:27017/superkafe_v2';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.PORT = '0';
      
      const result = validateEnvironmentVariables();
      
      expect(result.success).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          variable: 'PORT',
          error: 'PORT must be a valid port number (1-65535)'
        })
      );
    });
    
    it('should fail when PORT is out of range (too high)', () => {
      process.env.MONGODB_URI = 'mongodb://localhost:27017/superkafe_v2';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.PORT = '99999';
      
      const result = validateEnvironmentVariables();
      
      expect(result.success).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          variable: 'PORT',
          error: 'PORT must be a valid port number (1-65535)'
        })
      );
    });
  });
  
  describe('Multiple validation errors', () => {
    it('should report all validation errors at once', () => {
      delete process.env.MONGODB_URI;
      delete process.env.JWT_SECRET;
      process.env.PORT = 'invalid';
      
      const result = validateEnvironmentVariables();
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
      
      // Check that MONGODB_URI error is present
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          variable: 'MONGODB_URI'
        })
      );
      
      // Check that JWT_SECRET error is present
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          variable: 'JWT_SECRET'
        })
      );
    });
  });
  
  describe('Error message clarity', () => {
    it('should provide clear error messages with variable name and description', () => {
      delete process.env.MONGODB_URI;
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.PORT = '5001';
      
      const result = validateEnvironmentVariables();
      
      expect(result.success).toBe(false);
      
      const mongoError = result.errors.find(e => e.variable === 'MONGODB_URI');
      expect(mongoError).toBeDefined();
      expect(mongoError.description).toBe('MongoDB connection string');
      expect(mongoError.error).toBe('Variable is missing or empty');
    });
    
    it('should provide specific validation error messages', () => {
      process.env.MONGODB_URI = 'invalid-uri';
      process.env.JWT_SECRET = 'short';
      process.env.PORT = '5001';
      
      const result = validateEnvironmentVariables();
      
      expect(result.success).toBe(false);
      
      const mongoError = result.errors.find(e => e.variable === 'MONGODB_URI');
      expect(mongoError.error).toContain('must start with mongodb://');
      
      const jwtError = result.errors.find(e => e.variable === 'JWT_SECRET');
      expect(jwtError.error).toContain('at least 32 characters');
    });
  });
  
  describe('Optional environment variables', () => {
    it('should report warnings for missing optional variables', () => {
      process.env.MONGODB_URI = 'mongodb://localhost:27017/superkafe_v2';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.PORT = '5001';
      
      // Remove all optional variables
      delete process.env.API_KEY;
      delete process.env.SMTP_HOST;
      delete process.env.GOOGLE_CLIENT_ID;
      
      const result = validateEnvironmentVariables();
      
      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
    
    it('should not fail validation when optional variables are missing', () => {
      process.env.MONGODB_URI = 'mongodb://localhost:27017/superkafe_v2';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.PORT = '5001';
      
      // Remove all optional variables
      delete process.env.API_KEY;
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_PORT;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;
      
      const result = validateEnvironmentVariables();
      
      expect(result.success).toBe(true);
    });
  });
  
  describe('Configuration completeness', () => {
    it('should validate all required variables defined in REQUIRED_ENV_VARS', () => {
      // Set all required variables to valid values
      process.env.MONGODB_URI = 'mongodb://localhost:27017/superkafe_v2';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.PORT = '5001';
      
      const result = validateEnvironmentVariables();
      
      expect(result.success).toBe(true);
      
      // Verify all required variables are checked
      const requiredVarNames = REQUIRED_ENV_VARS.map(v => v.name);
      expect(requiredVarNames).toContain('MONGODB_URI');
      expect(requiredVarNames).toContain('JWT_SECRET');
      expect(requiredVarNames).toContain('PORT');
    });
  });
});
