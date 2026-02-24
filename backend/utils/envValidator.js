/**
 * Environment Variable Validator
 * 
 * Validates all required environment variables on application startup.
 * Exits with clear error messages if any required variables are missing or invalid.
 * 
 * Requirements: 12.1, 12.4
 */

const logger = require('./logger');

/**
 * Required environment variables for the application
 */
const REQUIRED_ENV_VARS = [
  {
    name: 'MONGODB_URI',
    description: 'MongoDB connection string',
    validator: (value) => {
      // Basic MongoDB URI format validation
      if (!value.startsWith('mongodb://') && !value.startsWith('mongodb+srv://')) {
        return 'MONGODB_URI must start with mongodb:// or mongodb+srv://';
      }
      return null;
    }
  },
  {
    name: 'JWT_SECRET',
    description: 'Secret key for JWT token signing',
    validator: (value) => {
      if (value.length < 32) {
        return 'JWT_SECRET must be at least 32 characters long for security';
      }
      return null;
    }
  },
  {
    name: 'PORT',
    description: 'Server port number',
    validator: (value) => {
      const port = parseInt(value, 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        return 'PORT must be a valid port number (1-65535)';
      }
      return null;
    },
    optional: true, // Has default value
    defaultValue: '5001'
  }
];

/**
 * Optional environment variables (warnings only)
 */
const OPTIONAL_ENV_VARS = [
  {
    name: 'API_KEY',
    description: 'API key for external integrations'
  },
  {
    name: 'SMTP_HOST',
    description: 'SMTP server host for email sending'
  },
  {
    name: 'SMTP_PORT',
    description: 'SMTP server port'
  },
  {
    name: 'SMTP_USER',
    description: 'SMTP authentication username'
  },
  {
    name: 'SMTP_PASS',
    description: 'SMTP authentication password'
  },
  {
    name: 'GOOGLE_CLIENT_ID',
    description: 'Google OAuth client ID'
  },
  {
    name: 'GOOGLE_CLIENT_SECRET',
    description: 'Google OAuth client secret'
  },
  {
    name: 'FRONTEND_URL',
    description: 'Frontend application URL (production)'
  },
  {
    name: 'FRONTEND_URL_DEV',
    description: 'Frontend application URL (development)'
  },
  {
    name: 'PAYMENT_PROVIDER',
    description: 'Payment gateway provider'
  },
  {
    name: 'DUITKU_MODE',
    description: 'Duitku payment mode (sandbox/production)'
  },
  {
    name: 'DUITKU_MERCHANT_CODE',
    description: 'Duitku merchant code'
  },
  {
    name: 'DUITKU_API_KEY',
    description: 'Duitku API key'
  },
  {
    name: 'BACKEND_URL',
    description: 'Backend application URL'
  }
];

/**
 * Validate all required environment variables
 * 
 * @returns {Object} Validation result with success flag and errors
 */
function validateEnvironmentVariables() {
  const errors = [];
  const warnings = [];
  
  logger.info('🔍 Validating environment variables...');
  
  // Validate required variables
  for (const envVar of REQUIRED_ENV_VARS) {
    const value = process.env[envVar.name];
    
    // Check if variable exists
    if (!value || value.trim() === '') {
      if (envVar.optional && envVar.defaultValue) {
        logger.info(`ℹ️  ${envVar.name} not set, using default: ${envVar.defaultValue}`);
        process.env[envVar.name] = envVar.defaultValue;
        continue;
      }
      
      errors.push({
        variable: envVar.name,
        description: envVar.description,
        error: 'Variable is missing or empty'
      });
      continue;
    }
    
    // Run custom validator if provided
    if (envVar.validator) {
      const validationError = envVar.validator(value);
      if (validationError) {
        errors.push({
          variable: envVar.name,
          description: envVar.description,
          error: validationError
        });
      }
    }
  }
  
  // Check optional variables (warnings only)
  for (const envVar of OPTIONAL_ENV_VARS) {
    const value = process.env[envVar.name];
    
    if (!value || value.trim() === '') {
      warnings.push({
        variable: envVar.name,
        description: envVar.description
      });
    }
  }
  
  return {
    success: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate environment variables and exit if validation fails
 * 
 * This function should be called at application startup before any other initialization.
 * If validation fails, it will log detailed error messages and exit the process with code 1.
 */
function validateAndExit() {
  const result = validateEnvironmentVariables();
  
  // Log validation results
  if (result.success) {
    logger.info('✅ All required environment variables are valid');
    
    // Log warnings for missing optional variables
    if (result.warnings.length > 0) {
      logger.warn(`⚠️  ${result.warnings.length} optional environment variable(s) not set:`);
      result.warnings.forEach(warning => {
        logger.warn(`   - ${warning.variable}: ${warning.description}`);
      });
    }
    
    return;
  }
  
  // Validation failed - log errors and exit
  logger.error('❌ Environment variable validation failed!');
  logger.error(`   ${result.errors.length} required variable(s) are missing or invalid:\n`);
  
  result.errors.forEach(error => {
    logger.error(`   ❌ ${error.variable}`);
    logger.error(`      Description: ${error.description}`);
    logger.error(`      Error: ${error.error}\n`);
  });
  
  logger.error('💡 Fix these issues:');
  logger.error('   1. Create a .env file in the backend directory if it doesn\'t exist');
  logger.error('   2. Copy .env.example to .env: cp .env.example .env');
  logger.error('   3. Fill in all required environment variables');
  logger.error('   4. Restart the application\n');
  
  logger.error('📖 See backend/.env.example for reference\n');
  
  // Exit with error code
  process.exit(1);
}

module.exports = {
  validateEnvironmentVariables,
  validateAndExit,
  REQUIRED_ENV_VARS,
  OPTIONAL_ENV_VARS
};
