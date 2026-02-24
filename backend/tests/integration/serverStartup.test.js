/**
 * Integration Test for Server Startup with Environment Variable Validation
 * 
 * Tests that the server properly validates environment variables on startup
 * and exits with clear error messages when validation fails.
 * 
 * Requirements: 12.1, 12.4
 */

const { spawn } = require('child_process');
const path = require('path');

describe('Server Startup Environment Validation', () => {
  const serverPath = path.join(__dirname, '../../server.js');
  const timeout = 10000; // 10 seconds timeout
  
  /**
   * Helper function to start server with custom environment
   */
  function startServerWithEnv(env) {
    return new Promise((resolve, reject) => {
      const serverProcess = spawn('node', [serverPath], {
        env: { ...process.env, ...env },
        cwd: path.join(__dirname, '../..')
      });
      
      let stdout = '';
      let stderr = '';
      
      serverProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      serverProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      serverProcess.on('close', (code) => {
        resolve({ code, stdout, stderr });
      });
      
      serverProcess.on('error', (error) => {
        reject(error);
      });
      
      // Kill process after timeout
      setTimeout(() => {
        serverProcess.kill();
        resolve({ code: null, stdout, stderr, timeout: true });
      }, timeout);
    });
  }
  
  it('should exit with code 1 when MONGODB_URI is missing', async () => {
    const result = await startServerWithEnv({
      MONGODB_URI: '',
      JWT_SECRET: 'a'.repeat(32),
      PORT: '5001'
    });
    
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('MONGODB_URI');
    expect(result.stderr).toContain('validation failed');
  }, timeout);
  
  it('should exit with code 1 when JWT_SECRET is missing', async () => {
    const result = await startServerWithEnv({
      MONGODB_URI: 'mongodb://localhost:27017/superkafe_v2',
      JWT_SECRET: '',
      PORT: '5001'
    });
    
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('JWT_SECRET');
    expect(result.stderr).toContain('validation failed');
  }, timeout);
  
  it('should exit with code 1 when JWT_SECRET is too short', async () => {
    const result = await startServerWithEnv({
      MONGODB_URI: 'mongodb://localhost:27017/superkafe_v2',
      JWT_SECRET: 'short',
      PORT: '5001'
    });
    
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('JWT_SECRET');
    expect(result.stderr).toContain('at least 32 characters');
  }, timeout);
  
  it('should exit with code 1 when MONGODB_URI has invalid format', async () => {
    const result = await startServerWithEnv({
      MONGODB_URI: 'http://localhost:27017/db',
      JWT_SECRET: 'a'.repeat(32),
      PORT: '5001'
    });
    
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('MONGODB_URI');
    expect(result.stderr).toContain('must start with mongodb://');
  }, timeout);
  
  it('should provide clear error messages listing all missing variables', async () => {
    const result = await startServerWithEnv({
      MONGODB_URI: '',
      JWT_SECRET: '',
      PORT: '5001'
    });
    
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('validation failed');
    expect(result.stderr).toContain('MONGODB_URI');
    expect(result.stderr).toContain('JWT_SECRET');
    expect(result.stderr).toContain('Fix these issues');
  }, timeout);
  
  it('should provide helpful instructions in error message', async () => {
    const result = await startServerWithEnv({
      MONGODB_URI: '',
      JWT_SECRET: 'a'.repeat(32),
      PORT: '5001'
    });
    
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('.env');
    expect(result.stderr).toContain('.env.example');
  }, timeout);
});
