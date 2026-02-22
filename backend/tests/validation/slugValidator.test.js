/**
 * Slug Validator Unit Tests
 * 
 * Tests for slug validation utility to ensure:
 * - Reserved keywords are rejected
 * - Format validation works correctly
 * - Valid slugs are accepted
 * - Edge cases are handled properly
 * 
 * Validates Requirements: 2.1, 2.2, 3.1, 3.2
 */

const { validateSlug, isReservedKeyword, RESERVED_KEYWORDS } = require('../../utils/slugValidator');

describe('Slug Validator', () => {
  
  // ============================================================================
  // Reserved Keywords Tests (Requirements 2.1, 2.2)
  // ============================================================================
  
  describe('Reserved Keywords Rejection', () => {
    test('should reject "setup-cafe" as reserved keyword', () => {
      const result = validateSlug('setup-cafe');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('direservasi sistem');
    });

    test('should reject "admin" as reserved keyword', () => {
      const result = validateSlug('admin');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('direservasi sistem');
    });

    test('should reject "dashboard" as reserved keyword', () => {
      const result = validateSlug('dashboard');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('direservasi sistem');
    });

    test('should reject "auth" as reserved keyword', () => {
      const result = validateSlug('auth');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('direservasi sistem');
    });

    test('should reject "api" as reserved keyword', () => {
      const result = validateSlug('api');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('direservasi sistem');
    });

    test('should reject "login" as reserved keyword', () => {
      const result = validateSlug('login');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('direservasi sistem');
    });

    test('should reject "register" as reserved keyword', () => {
      const result = validateSlug('register');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('direservasi sistem');
    });

    test('should reject "logout" as reserved keyword', () => {
      const result = validateSlug('logout');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('direservasi sistem');
    });

    test('should reject reserved keywords regardless of case', () => {
      const result1 = validateSlug('ADMIN');
      const result2 = validateSlug('Admin');
      const result3 = validateSlug('aDmIn');
      
      expect(result1.valid).toBe(false);
      expect(result2.valid).toBe(false);
      expect(result3.valid).toBe(false);
    });

    test('should reject reserved keywords with extra whitespace', () => {
      const result1 = validateSlug('  admin  ');
      const result2 = validateSlug('\tauth\t');
      
      expect(result1.valid).toBe(false);
      expect(result2.valid).toBe(false);
    });
  });

  // ============================================================================
  // Format Validation Tests (Requirements 3.1, 3.2)
  // ============================================================================
  
  describe('Format Validation - Invalid Characters', () => {
    test('should accept slug with uppercase letters (normalized to lowercase)', () => {
      const result = validateSlug('WarkopJaya');
      // Validator normalizes to lowercase, so this becomes 'warkopjaya' which is valid
      expect(result.valid).toBe(true);
      expect(result.error).toBe(null);
    });

    test('should reject slug with spaces', () => {
      const result = validateSlug('warkop jaya');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('huruf kecil');
    });

    test('should reject slug with underscores', () => {
      const result = validateSlug('warkop_jaya');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('huruf kecil');
    });

    test('should reject slug with special characters', () => {
      const result1 = validateSlug('warkop@jaya');
      const result2 = validateSlug('warkop#jaya');
      const result3 = validateSlug('warkop$jaya');
      const result4 = validateSlug('warkop%jaya');
      
      expect(result1.valid).toBe(false);
      expect(result2.valid).toBe(false);
      expect(result3.valid).toBe(false);
      expect(result4.valid).toBe(false);
    });

    test('should reject slug with dots', () => {
      const result = validateSlug('warkop.jaya');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('huruf kecil');
    });

    test('should reject slug with slashes', () => {
      const result1 = validateSlug('warkop/jaya');
      const result2 = validateSlug('warkop\\jaya');
      
      expect(result1.valid).toBe(false);
      expect(result2.valid).toBe(false);
    });
  });

  describe('Format Validation - Length', () => {
    test('should reject slug shorter than 3 characters', () => {
      const result1 = validateSlug('ab');
      const result2 = validateSlug('a');
      
      expect(result1.valid).toBe(false);
      expect(result1.error).toContain('minimal 3 karakter');
      expect(result2.valid).toBe(false);
      expect(result2.error).toContain('minimal 3 karakter');
    });

    test('should accept slug with exactly 3 characters', () => {
      const result = validateSlug('abc');
      expect(result.valid).toBe(true);
      expect(result.error).toBe(null);
    });

    test('should accept slug with exactly 50 characters', () => {
      const slug = 'a'.repeat(50);
      const result = validateSlug(slug);
      expect(result.valid).toBe(true);
      expect(result.error).toBe(null);
    });

    test('should reject slug longer than 50 characters', () => {
      const slug = 'a'.repeat(51);
      const result = validateSlug(slug);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('maksimal 50 karakter');
    });
  });

  describe('Format Validation - Hyphen Position', () => {
    test('should reject slug starting with hyphen', () => {
      const result = validateSlug('-warkop-jaya');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('tidak boleh diawali atau diakhiri');
    });

    test('should reject slug ending with hyphen', () => {
      const result = validateSlug('warkop-jaya-');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('tidak boleh diawali atau diakhiri');
    });

    test('should reject slug both starting and ending with hyphen', () => {
      const result = validateSlug('-warkop-jaya-');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('tidak boleh diawali atau diakhiri');
    });

    test('should accept slug with hyphens in the middle', () => {
      const result = validateSlug('warkop-jaya-sentosa');
      expect(result.valid).toBe(true);
      expect(result.error).toBe(null);
    });

    test('should accept slug with multiple consecutive hyphens in middle', () => {
      const result = validateSlug('warkop--jaya');
      expect(result.valid).toBe(true);
      expect(result.error).toBe(null);
    });
  });

  // ============================================================================
  // Valid Slug Acceptance Tests (Requirements 2.4, 3.3)
  // ============================================================================
  
  describe('Valid Slug Acceptance', () => {
    test('should accept simple lowercase slug', () => {
      const result = validateSlug('warkop');
      expect(result.valid).toBe(true);
      expect(result.error).toBe(null);
    });

    test('should accept slug with numbers', () => {
      const result = validateSlug('warkop123');
      expect(result.valid).toBe(true);
      expect(result.error).toBe(null);
    });

    test('should accept slug with hyphens', () => {
      const result = validateSlug('warkop-jaya');
      expect(result.valid).toBe(true);
      expect(result.error).toBe(null);
    });

    test('should accept slug with mixed lowercase, numbers, and hyphens', () => {
      const result = validateSlug('warkop-jaya-123');
      expect(result.valid).toBe(true);
      expect(result.error).toBe(null);
    });

    test('should accept slug that starts with number', () => {
      const result = validateSlug('123-warkop');
      expect(result.valid).toBe(true);
      expect(result.error).toBe(null);
    });

    test('should accept slug that is all numbers', () => {
      const result = validateSlug('12345');
      expect(result.valid).toBe(true);
      expect(result.error).toBe(null);
    });

    test('should accept slug with uppercase letters (normalized to lowercase)', () => {
      const result = validateSlug('WarkopJaya');
      // Validator normalizes to lowercase, so this becomes 'warkopjaya' which is valid
      expect(result.valid).toBe(true);
      expect(result.error).toBe(null);
    });
  });

  // ============================================================================
  // Edge Cases Tests
  // ============================================================================
  
  describe('Edge Cases', () => {
    test('should reject empty string', () => {
      const result = validateSlug('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('tidak boleh kosong');
    });

    test('should reject null', () => {
      const result = validateSlug(null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('tidak boleh kosong');
    });

    test('should reject undefined', () => {
      const result = validateSlug(undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('tidak boleh kosong');
    });

    test('should reject whitespace-only string', () => {
      const result1 = validateSlug('   ');
      const result2 = validateSlug('\t\t');
      const result3 = validateSlug('\n\n');
      
      expect(result1.valid).toBe(false);
      expect(result2.valid).toBe(false);
      expect(result3.valid).toBe(false);
    });

    test('should handle slug with leading/trailing whitespace', () => {
      const result = validateSlug('  warkop-jaya  ');
      expect(result.valid).toBe(true);
      expect(result.error).toBe(null);
    });

    test('should reject slug with only hyphens', () => {
      const result = validateSlug('---');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('tidak boleh diawali atau diakhiri');
    });

    test('should reject slug with emoji', () => {
      const result = validateSlug('warkop😊');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('huruf kecil');
    });

    test('should reject slug with unicode characters', () => {
      const result = validateSlug('warkop-café');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('huruf kecil');
    });
  });

  // ============================================================================
  // isReservedKeyword Helper Function Tests
  // ============================================================================
  
  describe('isReservedKeyword Helper', () => {
    test('should return true for reserved keywords', () => {
      expect(isReservedKeyword('admin')).toBe(true);
      expect(isReservedKeyword('auth')).toBe(true);
      expect(isReservedKeyword('setup-cafe')).toBe(true);
    });

    test('should return false for non-reserved keywords', () => {
      expect(isReservedKeyword('warkop-jaya')).toBe(false);
      expect(isReservedKeyword('my-cafe')).toBe(false);
    });

    test('should be case-insensitive', () => {
      expect(isReservedKeyword('ADMIN')).toBe(true);
      expect(isReservedKeyword('Admin')).toBe(true);
    });

    test('should handle whitespace', () => {
      expect(isReservedKeyword('  admin  ')).toBe(true);
    });

    test('should return false for null/undefined', () => {
      expect(isReservedKeyword(null)).toBe(false);
      expect(isReservedKeyword(undefined)).toBe(false);
    });
  });

  // ============================================================================
  // RESERVED_KEYWORDS Constant Tests
  // ============================================================================
  
  describe('RESERVED_KEYWORDS Constant', () => {
    test('should contain all expected reserved keywords', () => {
      const expectedKeywords = [
        'setup-cafe',
        'admin',
        'dashboard',
        'auth',
        'api',
        'login',
        'register',
        'logout'
      ];

      expectedKeywords.forEach(keyword => {
        expect(RESERVED_KEYWORDS).toContain(keyword);
      });
    });

    test('should have at least 8 reserved keywords', () => {
      expect(RESERVED_KEYWORDS.length).toBeGreaterThanOrEqual(8);
    });

    test('should be an array', () => {
      expect(Array.isArray(RESERVED_KEYWORDS)).toBe(true);
    });
  });
});
