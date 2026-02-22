/**
 * Slug Validation Utility
 * 
 * Provides centralized validation logic for tenant slugs to prevent
 * conflicts with static routes and ensure consistent URL-friendly format.
 */

/**
 * Reserved keywords yang tidak boleh digunakan sebagai tenant slug
 * karena konflik dengan static routes di aplikasi
 */
const RESERVED_KEYWORDS = [
  'setup-cafe',
  'admin',
  'dashboard',
  'auth',
  'api',
  'login',
  'register',
  'logout'
];

/**
 * Validasi slug terhadap reserved keywords dan format
 * 
 * @param {string} slug - Slug yang akan divalidasi
 * @returns {Object} { valid: boolean, error: string | null }
 * 
 * @example
 * validateSlug('warkop-jaya') // { valid: true, error: null }
 * validateSlug('admin') // { valid: false, error: 'Slug ... direservasi sistem' }
 * validateSlug('ABC') // { valid: false, error: 'Slug hanya boleh mengandung huruf kecil...' }
 */
function validateSlug(slug) {
  // 1. Check if empty
  if (!slug || slug.trim() === '') {
    return { valid: false, error: 'Slug tidak boleh kosong' };
  }

  // 2. Convert to lowercase and trim
  const normalizedSlug = slug.toLowerCase().trim();

  // 3. Check reserved keywords
  if (RESERVED_KEYWORDS.includes(normalizedSlug)) {
    return { 
      valid: false, 
      error: `Slug '${slug}' tidak dapat digunakan karena merupakan kata yang direservasi sistem` 
    };
  }

  // 4. Check format (only lowercase, numbers, and hyphens)
  const slugRegex = /^[a-z0-9-]+$/;
  if (!slugRegex.test(normalizedSlug)) {
    return { 
      valid: false, 
      error: 'Slug hanya boleh mengandung huruf kecil, angka, dan tanda hubung (-)' 
    };
  }

  // 5. Check length (min 3, max 50)
  if (normalizedSlug.length < 3) {
    return { valid: false, error: 'Slug minimal 3 karakter' };
  }

  if (normalizedSlug.length > 50) {
    return { valid: false, error: 'Slug maksimal 50 karakter' };
  }

  // 6. Check if starts or ends with hyphen
  if (normalizedSlug.startsWith('-') || normalizedSlug.endsWith('-')) {
    return { valid: false, error: 'Slug tidak boleh diawali atau diakhiri dengan tanda hubung' };
  }

  return { valid: true, error: null };
}

/**
 * Check if slug is a reserved keyword
 * 
 * @param {string} slug - Slug to check
 * @returns {boolean} True if slug is reserved, false otherwise
 * 
 * @example
 * isReservedKeyword('admin') // true
 * isReservedKeyword('warkop-jaya') // false
 */
function isReservedKeyword(slug) {
  if (!slug) return false;
  return RESERVED_KEYWORDS.includes(slug.toLowerCase().trim());
}

module.exports = {
  validateSlug,
  isReservedKeyword,
  RESERVED_KEYWORDS
};
