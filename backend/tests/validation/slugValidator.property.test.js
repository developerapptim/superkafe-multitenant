/**
 * Slug Validator Property-Based Tests
 * 
 * Property-based tests using fast-check to verify universal properties
 * of the slug validation system across many generated inputs.
 * 
 * **Validates: Requirements 2.1, 2.2, 2.4, 3.1**
 * 
 * Testing Framework: fast-check
 * Minimum Iterations: 100 per property test
 */

const fc = require('fast-check');
const { validateSlug, isReservedKeyword, RESERVED_KEYWORDS } = require('../../utils/slugValidator');

describe('Slug Validator - Property-Based Tests', () => {
  
  // ============================================================================
  // Property 2: Reserved Keywords Rejection
  // **Validates: Requirements 2.1, 2.2**
  // ============================================================================
  
  describe('Property 2: Reserved Keywords Rejection', () => {
    test('should reject all reserved keywords regardless of case or whitespace', () => {
      fc.assert(
        fc.property(
          // Generate arbitrary from the reserved keywords list
          fc.constantFrom(...RESERVED_KEYWORDS),
          // Generate case variations
          fc.constantFrom('lower', 'upper', 'mixed'),
          // Generate whitespace variations
          fc.constantFrom('none', 'leading', 'trailing', 'both'),
          (keyword, caseVariation, whitespaceVariation) => {
            // Apply case transformation
            let testSlug = keyword;
            if (caseVariation === 'upper') {
              testSlug = testSlug.toUpperCase();
            } else if (caseVariation === 'mixed') {
              testSlug = testSlug.split('').map((c, i) => 
                i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()
              ).join('');
            }
            
            // Apply whitespace transformation
            if (whitespaceVariation === 'leading') {
              testSlug = '  ' + testSlug;
            } else if (whitespaceVariation === 'trailing') {
              testSlug = testSlug + '  ';
            } else if (whitespaceVariation === 'both') {
              testSlug = '  ' + testSlug + '  ';
            }
            
            // Validate
            const result = validateSlug(testSlug);
            
            // Property: All reserved keywords must be rejected
            expect(result.valid).toBe(false);
            expect(result.error).toContain('direservasi sistem');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should identify all reserved keywords with isReservedKeyword helper', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...RESERVED_KEYWORDS),
          (keyword) => {
            // Property: isReservedKeyword must return true for all reserved keywords
            expect(isReservedKeyword(keyword)).toBe(true);
            expect(isReservedKeyword(keyword.toUpperCase())).toBe(true);
            expect(isReservedKeyword('  ' + keyword + '  ')).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ============================================================================
  // Property 3: Valid Non-Reserved Slugs Acceptance
  // **Validates: Requirements 2.4, 3.1**
  // ============================================================================
  
  describe('Property 3: Valid Non-Reserved Slugs Acceptance', () => {
    test('should accept all slugs matching valid format and not reserved', () => {
      fc.assert(
        fc.property(
          // Generate valid slugs: 3-50 chars, lowercase letters, numbers, hyphens
          // Not starting or ending with hyphen, not reserved keywords
          fc.stringMatching(/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/)
            .filter(s => !RESERVED_KEYWORDS.includes(s)),
          (slug) => {
            const result = validateSlug(slug);
            
            // Property: All valid non-reserved slugs must be accepted
            expect(result.valid).toBe(true);
            expect(result.error).toBe(null);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should accept slugs with various valid patterns', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Pattern 1: lowercase letters only
            fc.stringMatching(/^[a-z]{3,50}$/)
              .filter(s => !RESERVED_KEYWORDS.includes(s)),
            // Pattern 2: numbers only
            fc.stringMatching(/^[0-9]{3,50}$/),
            // Pattern 3: mixed with hyphens in middle
            fc.tuple(
              fc.stringMatching(/^[a-z0-9]{1,20}$/),
              fc.stringMatching(/^[a-z0-9]{1,20}$/)
            ).map(([a, b]) => `${a}-${b}`)
              .filter(s => s.length >= 3 && s.length <= 50)
              .filter(s => !RESERVED_KEYWORDS.includes(s)),
            // Pattern 4: multiple segments with hyphens
            fc.array(
              fc.stringMatching(/^[a-z0-9]{1,10}$/),
              { minLength: 2, maxLength: 5 }
            ).map(arr => arr.join('-'))
              .filter(s => s.length >= 3 && s.length <= 50)
              .filter(s => !RESERVED_KEYWORDS.includes(s))
          ),
          (slug) => {
            const result = validateSlug(slug);
            
            // Property: All valid patterns must be accepted
            expect(result.valid).toBe(true);
            expect(result.error).toBe(null);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should normalize uppercase to lowercase and accept', () => {
      fc.assert(
        fc.property(
          // Generate valid slugs with uppercase letters
          fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9-]{1,48}[A-Za-z0-9]$/)
            .filter(s => !RESERVED_KEYWORDS.includes(s.toLowerCase())),
          (slug) => {
            const result = validateSlug(slug);
            
            // Property: Uppercase slugs should be normalized and accepted
            expect(result.valid).toBe(true);
            expect(result.error).toBe(null);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ============================================================================
  // Property 4: Slug Format Validation
  // **Validates: Requirements 2.4, 3.1**
  // ============================================================================
  
  describe('Property 4: Slug Format Validation', () => {
    test('should reject slugs with invalid characters', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Slugs with spaces
            fc.tuple(
              fc.stringMatching(/^[a-z0-9-]{1,20}$/),
              fc.stringMatching(/^[a-z0-9-]{1,20}$/)
            ).map(([a, b]) => `${a} ${b}`),
            // Slugs with underscores
            fc.stringMatching(/^[a-z0-9_-]{3,50}$/)
              .filter(s => s.includes('_')),
            // Slugs with special characters
            fc.tuple(
              fc.stringMatching(/^[a-z0-9-]{1,20}$/),
              fc.constantFrom('@', '#', '$', '%', '&', '*', '!', '.', '/', '\\')
            ).map(([s, char]) => s + char + s),
            // Slugs with unicode/emoji
            fc.tuple(
              fc.stringMatching(/^[a-z0-9-]{1,20}$/),
              fc.constantFrom('é', 'ñ', 'ü', '😊', '中', 'א')
            ).map(([s, char]) => s + char)
          ),
          (invalidSlug) => {
            const result = validateSlug(invalidSlug);
            
            // Property: All slugs with invalid characters must be rejected
            expect(result.valid).toBe(false);
            expect(result.error).toBeTruthy();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should reject slugs with invalid length', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Too short: 0-2 characters
            fc.stringMatching(/^[a-z0-9-]{0,2}$/),
            // Too long: 51+ characters
            fc.stringMatching(/^[a-z0-9-]{51,100}$/)
          ),
          (invalidSlug) => {
            // Skip empty strings as they have different error message
            if (invalidSlug === '') return;
            
            const result = validateSlug(invalidSlug);
            
            // Property: All slugs with invalid length must be rejected
            expect(result.valid).toBe(false);
            expect(result.error).toBeTruthy();
            
            if (invalidSlug.length < 3) {
              expect(result.error).toContain('minimal 3 karakter');
            } else if (invalidSlug.length > 50) {
              expect(result.error).toContain('maksimal 50 karakter');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should reject slugs starting or ending with hyphen', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Starting with hyphen
            fc.stringMatching(/^[a-z0-9]{2,49}$/)
              .map(s => '-' + s),
            // Ending with hyphen
            fc.stringMatching(/^[a-z0-9]{2,49}$/)
              .map(s => s + '-'),
            // Both
            fc.stringMatching(/^[a-z0-9]{2,48}$/)
              .map(s => '-' + s + '-')
          ),
          (invalidSlug) => {
            const result = validateSlug(invalidSlug);
            
            // Property: All slugs starting/ending with hyphen must be rejected
            expect(result.valid).toBe(false);
            expect(result.error).toContain('tidak boleh diawali atau diakhiri');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should reject empty, null, or whitespace-only slugs', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(''),
            fc.constant(null),
            fc.constant(undefined),
            fc.stringMatching(/^\s+$/)
          ),
          (invalidSlug) => {
            const result = validateSlug(invalidSlug);
            
            // Property: Empty/null/whitespace slugs must be rejected
            expect(result.valid).toBe(false);
            expect(result.error).toContain('tidak boleh kosong');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should handle boundary cases correctly', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Exactly 3 characters (minimum valid)
            fc.stringMatching(/^[a-z0-9]{3}$/)
              .filter(s => !RESERVED_KEYWORDS.includes(s)),
            // Exactly 50 characters (maximum valid)
            fc.stringMatching(/^[a-z0-9]{50}$/)
          ),
          (slug) => {
            const result = validateSlug(slug);
            
            // Property: Boundary cases at 3 and 50 chars should be valid
            expect(result.valid).toBe(true);
            expect(result.error).toBe(null);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ============================================================================
  // Combined Properties: Integration Tests
  // ============================================================================
  
  describe('Combined Properties: Validation Consistency', () => {
    test('should maintain consistency between validateSlug and isReservedKeyword', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          (slug) => {
            const isReserved = isReservedKeyword(slug);
            const validationResult = validateSlug(slug);
            
            // Property: If isReservedKeyword returns true, validateSlug must reject
            if (isReserved) {
              expect(validationResult.valid).toBe(false);
              expect(validationResult.error).toContain('direservasi sistem');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should provide error message for all invalid slugs', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 100 }),
          (slug) => {
            const result = validateSlug(slug);
            
            // Property: If validation fails, error message must be provided
            if (!result.valid) {
              expect(result.error).toBeTruthy();
              expect(typeof result.error).toBe('string');
              expect(result.error.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should never return valid=true with an error message', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 100 }),
          (slug) => {
            const result = validateSlug(slug);
            
            // Property: valid=true implies error=null
            if (result.valid) {
              expect(result.error).toBe(null);
            }
            
            // Property: error exists implies valid=false
            if (result.error) {
              expect(result.valid).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
