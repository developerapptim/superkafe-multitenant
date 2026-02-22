# Design Document: Routing Priority Fix

## Overview

Dokumen ini menjelaskan desain solusi untuk memperbaiki masalah routing priority di aplikasi SuperKafe. Masalah utama adalah dynamic route `/:tenantSlug` menangkap semua URL termasuk static routes seperti `/setup-cafe`, yang menghalangi user baru mengakses setup wizard setelah login via Google OAuth.

Solusi terdiri dari dua komponen utama:
1. **Frontend Routing Hierarchy**: Restrukturisasi urutan routes di React Router agar static routes diprioritaskan
2. **Backend Slug Validation**: Implementasi reserved keywords validation untuk mencegah konflik di masa depan

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              React Router (App.jsx)                     │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │  1. Static Routes (Priority: Highest)            │  │ │
│  │  │     - /auth/*                                     │  │ │
│  │  │     - /setup-cafe                                 │  │ │
│  │  │     - /admin/*                                    │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │  2. Dynamic Routes (Priority: Lowest)            │  │ │
│  │  │     - /:tenantSlug/*                              │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP Requests
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Backend (Node.js)                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │           Slug Validation Layer                        │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │  Reserved Keywords Check                         │  │ │
│  │  │  - setup-cafe, admin, dashboard, auth, api       │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │  Format Validation                               │  │ │
│  │  │  - Regex: ^[a-z0-9-]+$                           │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │           Controllers                                  │ │
│  │  - TenantController.registerTenant()                   │ │
│  │  - SetupController.setupTenant()                       │ │
│  │  - SetupController.checkSlug()                         │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Design Principles

1. **Explicit over Implicit**: Static routes harus dideklarasikan secara eksplisit sebelum dynamic routes
2. **Defense in Depth**: Validasi di frontend dan backend untuk mencegah konflik
3. **Backward Compatibility**: Tidak mengubah behavior existing tenant slugs
4. **Clear Error Messages**: User mendapat feedback yang jelas saat slug tidak valid

## Components and Interfaces

### Frontend Components

#### 1. App.jsx - Router Configuration

**Responsibility**: Mengelola routing hierarchy dan menentukan prioritas routes

**Interface**:
```typescript
// Route Order (CRITICAL - Order matters!)
<Routes>
  {/* Priority 1: Auth routes */}
  <Route path="/auth/*" element={<AuthRoutes />} />
  
  {/* Priority 2: Setup wizard */}
  <Route path="/setup-cafe" element={<SetupWizard />} />
  
  {/* Priority 3: Admin routes */}
  <Route path="/admin/*" element={<AdminLayout />} />
  
  {/* Priority 4: Dynamic tenant storefront (LOWEST) */}
  <Route path="/:tenantSlug/*" element={<DynamicStorefront />} />
  
  {/* Fallback */}
  <Route path="*" element={<Navigate to="/" />} />
</Routes>
```

**Key Changes**:
- Move `/setup-cafe` route BEFORE `/:tenantSlug` route
- Ensure all static routes are declared before dynamic routes
- Keep existing nested routes structure intact

#### 2. SetupWizard Component (New)

**Responsibility**: Halaman untuk user baru membuat tenant pertama kali

**Interface**:
```typescript
interface SetupWizardProps {
  // No props needed - uses auth context
}

interface SetupFormData {
  cafeName: string;
  slug: string;
  adminName: string;
}
```

**Behavior**:
- Check if user is authenticated (redirect to login if not)
- Check if user already has tenant (redirect to dashboard if yes)
- Provide real-time slug availability check
- Submit form to `/api/setup/tenant` endpoint
- Redirect to dashboard on success

### Backend Components

#### 1. Slug Validation Utility

**File**: `backend/utils/slugValidator.js` (New)

**Responsibility**: Centralized slug validation logic

**Interface**:
```javascript
/**
 * Reserved keywords yang tidak boleh digunakan sebagai tenant slug
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
 * @param {string} slug - Slug yang akan divalidasi
 * @returns {Object} { valid: boolean, error: string | null }
 */
function validateSlug(slug) {
  // 1. Check if empty
  if (!slug || slug.trim() === '') {
    return { valid: false, error: 'Slug tidak boleh kosong' };
  }

  // 2. Convert to lowercase
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
 * Check if slug is reserved keyword
 * @param {string} slug
 * @returns {boolean}
 */
function isReservedKeyword(slug) {
  return RESERVED_KEYWORDS.includes(slug.toLowerCase().trim());
}

module.exports = {
  validateSlug,
  isReservedKeyword,
  RESERVED_KEYWORDS
};
```

#### 2. TenantController Updates

**File**: `backend/controllers/TenantController.js`

**Changes**:
- Import `validateSlug` utility
- Add slug validation before checking database
- Return clear error messages for reserved keywords

**Modified Function**: `registerTenant()`

```javascript
const { validateSlug } = require('../utils/slugValidator');

const registerTenant = async (req, res) => {
  // ... existing code ...

  // NEW: Validate slug against reserved keywords
  const slugValidation = validateSlug(slug);
  if (!slugValidation.valid) {
    return res.status(400).json({
      success: false,
      message: slugValidation.error
    });
  }

  // ... rest of existing code ...
};
```

#### 3. SetupController Updates

**File**: `backend/controllers/SetupController.js`

**Changes**:
- Import `validateSlug` utility
- Add slug validation in `setupTenant()` and `checkSlug()`

**Modified Functions**:

```javascript
const { validateSlug } = require('../utils/slugValidator');

const setupTenant = async (req, res) => {
  // ... existing code ...

  // NEW: Validate slug
  const slugValidation = validateSlug(slug);
  if (!slugValidation.valid) {
    return res.status(400).json({
      success: false,
      message: slugValidation.error
    });
  }

  // ... rest of existing code ...
};

const checkSlug = async (req, res) => {
  const { slug } = req.params;

  // NEW: Validate slug first
  const slugValidation = validateSlug(slug);
  if (!slugValidation.valid) {
    return res.json({
      success: true,
      available: false,
      message: slugValidation.error
    });
  }

  // ... rest of existing code ...
};
```

## Data Models

### No Schema Changes Required

Solusi ini tidak memerlukan perubahan pada schema database. Semua perubahan adalah pada level aplikasi logic:

1. **Tenant Model**: Tetap sama, tidak ada perubahan
2. **User Model**: Tetap sama, tidak ada perubahan
3. **Employee Model**: Tetap sama, tidak ada perubahan

### Configuration Data

**Reserved Keywords List**:
```javascript
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
```

List ini dapat di-extend di masa depan jika ada static routes baru yang ditambahkan.


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Valid Tenant Slugs Route to Storefront

*For any* valid tenant slug that exists in the database and is not a reserved keyword, when the Router receives a request to `/:slug`, the Router should render the Storefront component with the correct tenant data.

**Validates: Requirements 1.4, 5.1**

### Property 2: Reserved Keywords Rejection

*For any* slug from the reserved keywords list (`setup-cafe`, `admin`, `dashboard`, `auth`, `api`, `login`, `register`, `logout`), when a user attempts to create a tenant or check slug availability, the Validation_Layer should reject the request with a clear error message indicating the slug is reserved.

**Validates: Requirements 2.1, 2.2, 2.3**

### Property 3: Valid Non-Reserved Slugs Acceptance

*For any* slug that matches the format `^[a-z0-9-]+$`, has length between 3-50 characters, does not start or end with hyphen, and is not a reserved keyword, when a user attempts to create a tenant or check slug availability, the Validation_Layer should accept the slug as valid.

**Validates: Requirements 2.4, 3.3**

### Property 4: Slug Format Validation

*For any* string that contains characters outside of lowercase letters, numbers, and hyphens, OR has length less than 3 or greater than 50, OR starts or ends with a hyphen, when submitted as a slug, the Validation_Layer should reject it with an error message explaining the correct format.

**Validates: Requirements 3.1, 3.2**

### Property 5: Nested Routes Preservation

*For any* valid tenant slug and any nested path (such as `/keranjang`, `/pesanan`, `/bantuan`), when the Router receives a request to `/:slug/nestedPath`, the Router should render the appropriate nested component within the Storefront layout.

**Validates: Requirements 5.3**

## Error Handling

### Frontend Error Handling

#### 1. Route Not Found
- **Scenario**: User navigates to invalid path
- **Handling**: Redirect to landing page with 404 message
- **User Experience**: Clear message explaining the page doesn't exist

#### 2. Slug Validation Errors
- **Scenario**: User enters invalid slug in Setup Wizard
- **Handling**: Display inline error message below slug input field
- **User Experience**: Real-time validation feedback with specific error message

#### 3. Network Errors
- **Scenario**: API call to check slug availability fails
- **Handling**: Show error toast, allow retry
- **User Experience**: "Tidak dapat memeriksa ketersediaan slug. Silakan coba lagi."

#### 4. Unauthorized Access
- **Scenario**: Unauthenticated user tries to access `/setup-cafe`
- **Handling**: Redirect to login page with return URL
- **User Experience**: After login, redirect back to setup wizard

### Backend Error Handling

#### 1. Reserved Keyword Violation
```javascript
{
  success: false,
  message: "Slug 'admin' tidak dapat digunakan karena merupakan kata yang direservasi sistem",
  code: "RESERVED_KEYWORD"
}
```

#### 2. Invalid Format
```javascript
{
  success: false,
  message: "Slug hanya boleh mengandung huruf kecil, angka, dan tanda hubung (-)",
  code: "INVALID_FORMAT"
}
```

#### 3. Slug Already Exists
```javascript
{
  success: false,
  message: "Slug sudah digunakan, silakan pilih slug lain",
  code: "SLUG_EXISTS"
}
```

#### 4. Slug Too Short/Long
```javascript
{
  success: false,
  message: "Slug minimal 3 karakter",
  code: "SLUG_TOO_SHORT"
}
```

### Error Recovery Strategies

1. **Graceful Degradation**: Jika slug validation service down, allow manual input dengan warning
2. **Retry Logic**: Implement exponential backoff untuk network errors
3. **Fallback Routes**: Jika dynamic route fails, fallback ke landing page
4. **Logging**: Log semua validation errors untuk monitoring dan debugging

## Testing Strategy

### Dual Testing Approach

Implementasi fitur ini memerlukan kombinasi unit tests dan property-based tests untuk memastikan correctness yang komprehensif:

- **Unit tests**: Memverifikasi contoh spesifik, edge cases, dan error conditions
- **Property tests**: Memverifikasi universal properties across all inputs

Kedua jenis testing ini saling melengkapi dan diperlukan untuk coverage yang menyeluruh.

### Unit Testing

Unit tests fokus pada:

1. **Specific Route Examples**
   - Test `/setup-cafe` routes to SetupWizard
   - Test `/admin/dashboard` routes to AdminLayout
   - Test `/auth/login` routes to SimpleLogin
   - Test invalid path redirects to landing page

2. **Edge Cases**
   - Empty slug input
   - Slug with only hyphens
   - Slug with uppercase letters (should be normalized)
   - Very long slug (>50 chars)
   - Slug starting/ending with hyphen

3. **Error Conditions**
   - Network timeout during slug check
   - Database error during tenant creation
   - Unauthorized access to setup wizard
   - Duplicate slug submission

4. **Integration Points**
   - Setup wizard form submission flow
   - Redirect after successful tenant creation
   - Auth state check before showing setup wizard

### Property-Based Testing

Property tests akan menggunakan **fast-check** library untuk JavaScript/TypeScript.

**Configuration**:
- Minimum 100 iterations per property test
- Each test tagged with feature name and property number
- Tag format: `Feature: routing-priority-fix, Property {N}: {description}`

**Property Test Implementation**:

#### Property 1: Valid Tenant Slugs Route to Storefront
```javascript
// Feature: routing-priority-fix, Property 1: Valid tenant slugs route to Storefront
fc.assert(
  fc.property(
    fc.string({ minLength: 3, maxLength: 50 })
      .filter(s => /^[a-z0-9-]+$/.test(s))
      .filter(s => !RESERVED_KEYWORDS.includes(s))
      .filter(s => !s.startsWith('-') && !s.endsWith('-')),
    async (slug) => {
      // Create tenant with slug
      const tenant = await createTestTenant(slug);
      
      // Navigate to /:slug
      const result = await navigateToRoute(`/${slug}`);
      
      // Verify Storefront component rendered with correct tenant
      expect(result.component).toBe('Storefront');
      expect(result.tenantData.slug).toBe(slug);
    }
  ),
  { numRuns: 100 }
);
```

#### Property 2: Reserved Keywords Rejection
```javascript
// Feature: routing-priority-fix, Property 2: Reserved keywords rejection
fc.assert(
  fc.property(
    fc.constantFrom(...RESERVED_KEYWORDS),
    async (keyword) => {
      // Try to create tenant with reserved keyword
      const createResult = await attemptCreateTenant(keyword);
      expect(createResult.success).toBe(false);
      expect(createResult.message).toContain('direservasi sistem');
      
      // Try to check slug availability
      const checkResult = await checkSlugAvailability(keyword);
      expect(checkResult.available).toBe(false);
    }
  ),
  { numRuns: 100 }
);
```

#### Property 3: Valid Non-Reserved Slugs Acceptance
```javascript
// Feature: routing-priority-fix, Property 3: Valid non-reserved slugs acceptance
fc.assert(
  fc.property(
    fc.string({ minLength: 3, maxLength: 50 })
      .filter(s => /^[a-z0-9-]+$/.test(s))
      .filter(s => !RESERVED_KEYWORDS.includes(s))
      .filter(s => !s.startsWith('-') && !s.endsWith('-')),
    async (slug) => {
      // Check slug availability
      const checkResult = await checkSlugAvailability(slug);
      
      // If slug doesn't exist in DB, should be available
      const existsInDb = await slugExistsInDatabase(slug);
      if (!existsInDb) {
        expect(checkResult.available).toBe(true);
      }
      
      // Try to create tenant
      const createResult = await attemptCreateTenant(slug);
      if (!existsInDb) {
        expect(createResult.success).toBe(true);
      }
    }
  ),
  { numRuns: 100 }
);
```

#### Property 4: Slug Format Validation
```javascript
// Feature: routing-priority-fix, Property 4: Slug format validation
fc.assert(
  fc.property(
    fc.oneof(
      // Invalid characters
      fc.string().filter(s => !/^[a-z0-9-]+$/.test(s)),
      // Too short
      fc.string({ maxLength: 2 }),
      // Too long
      fc.string({ minLength: 51 }),
      // Starts with hyphen
      fc.string().map(s => '-' + s),
      // Ends with hyphen
      fc.string().map(s => s + '-')
    ),
    async (invalidSlug) => {
      const result = await validateSlug(invalidSlug);
      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
    }
  ),
  { numRuns: 100 }
);
```

#### Property 5: Nested Routes Preservation
```javascript
// Feature: routing-priority-fix, Property 5: Nested routes preservation
fc.assert(
  fc.property(
    fc.string({ minLength: 3, maxLength: 50 })
      .filter(s => /^[a-z0-9-]+$/.test(s))
      .filter(s => !RESERVED_KEYWORDS.includes(s))
      .filter(s => !s.startsWith('-') && !s.endsWith('-')),
    fc.constantFrom('keranjang', 'pesanan', 'bantuan'),
    async (slug, nestedPath) => {
      // Create tenant
      await createTestTenant(slug);
      
      // Navigate to nested route
      const result = await navigateToRoute(`/${slug}/${nestedPath}`);
      
      // Verify correct nested component rendered
      expect(result.layout).toBe('CustomerLayout');
      expect(result.nestedComponent).toBeTruthy();
    }
  ),
  { numRuns: 100 }
);
```

### Test Organization

```
tests/
├── unit/
│   ├── routing/
│   │   ├── staticRoutes.test.js
│   │   ├── dynamicRoutes.test.js
│   │   └── edgeCases.test.js
│   └── validation/
│       ├── slugValidator.test.js
│       └── reservedKeywords.test.js
└── property/
    ├── routingProperties.test.js
    └── validationProperties.test.js
```

### Testing Tools

- **Unit Testing**: Jest + React Testing Library
- **Property Testing**: fast-check
- **Integration Testing**: Supertest (for API endpoints)
- **E2E Testing**: Playwright (optional, for critical user flows)

### Coverage Goals

- Unit test coverage: >80% for modified files
- Property tests: All 5 properties implemented
- Integration tests: All API endpoints tested
- Critical paths: Setup wizard flow, tenant creation, routing priority
