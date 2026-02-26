# Implementation Plan: Seamless Branding Integration

## Overview

This implementation plan breaks down the Seamless Branding Integration feature into discrete, sequential coding tasks. The feature enables tenant owners to customize their Admin Panel appearance by selecting from predefined theme presets (default dark purple or light-coffee), with preferences persisted in the database and synchronized across all sessions and devices.

The implementation follows a bottom-up approach: starting with foundational configuration and data models, then building backend APIs, followed by frontend components, and finally integration and testing.

## Tasks

- [x] 1. Create theme configuration and update data models
  - [x] 1.1 Create theme presets configuration file
    - Create `frontend/src/config/themeStyles.js` with theme preset definitions
    - Define 'default' theme preset with current dark purple colors
    - Define 'light-coffee' theme preset with white-brown colors
    - Export `themePresets` object and `getThemeConfig` helper function
    - Ensure each preset has all four required properties: bgMain, bgSidebar, accentColor, textPrimary
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  
  - [x] 1.2 Update Tenant model with theme fields
    - Add `selectedTheme` field to `backend/models/Tenant.js` schema
    - Set enum values: ['default', 'light-coffee']
    - Set default value to 'default'
    - Add `hasSeenThemePopup` boolean field with default false
    - _Requirements: 3.1, 7.6_
  
  - [x] 1.3 Write property test for theme preset structure
    - **Property 1: Theme Preset Structure Completeness**
    - **Validates: Requirements 1.4**
    - Test that all theme presets contain required properties (bgMain, bgSidebar, accentColor, textPrimary)
    - Use fast-check to iterate over all theme preset keys
    - _Requirements: 1.4_

- [x] 2. Implement backend theme management API
  - [x] 2.1 Create theme routes and controller
    - Create `backend/routes/themeRoutes.js` with GET and PUT endpoints
    - Create `backend/controllers/ThemeController.js` with getTheme and updateTheme methods
    - Implement GET `/api/tenants/:tenantId/theme` endpoint
    - Implement PUT `/api/tenants/:tenantId/theme` endpoint
    - Register theme routes in `backend/server.js`
    - _Requirements: 10.1, 10.2_
  
  - [x] 2.2 Implement theme validation and authorization
    - Validate theme name against allowed presets ['default', 'light-coffee']
    - Verify user has access to requested tenant (compare JWT tenantId with route param)
    - Return 400 error for invalid theme names
    - Return 403 error for unauthorized access
    - Return 404 error if tenant not found
    - _Requirements: 10.3, 10.4, 10.6_
  
  - [x] 2.3 Write unit tests for theme controller
    - Test successful theme update for authorized user
    - Test 400 error for invalid theme name
    - Test 403 error for unauthorized tenant access
    - Test 404 error for non-existent tenant
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.6_
  
  - [x] 2.4 Write property test for theme value validation
    - **Property 4: Theme Value Validation**
    - **Validates: Requirements 3.4, 10.4**
    - Generate random invalid theme names and verify backend rejects them with 400 status
    - Use fast-check to generate strings that are not in allowed presets
    - _Requirements: 3.4, 10.4_

- [x] 3. Update authentication to include theme data
  - [x] 3.1 Modify authentication controllers to return theme data
    - Update `backend/controllers/UnifiedAuthController.js` login response
    - Update `backend/controllers/GlobalAuthController.js` login response
    - Include `selectedTheme` and `hasSeenThemePopup` in tenant object of auth response
    - Ensure theme data is populated from Tenant model
    - _Requirements: 3.3, 10.5_
  
  - [-] 3.2 Write unit tests for auth response updates
    - Test that login response includes selectedTheme field
    - Test that login response includes hasSeenThemePopup field
    - Test that theme values are correctly populated from database
    - Extend existing auth controller test files
    - _Requirements: 3.3, 10.5_
  
  - [x] 3.3 Write property test for authentication includes theme data
    - **Property 3: Authentication Includes Theme Data**
    - **Validates: Requirements 3.3, 10.5**
    - Test that all successful auth responses include theme fields
    - Verify both selectedTheme and hasSeenThemePopup are present
    - _Requirements: 3.3, 10.5_

- [x] 4. Checkpoint - Backend API complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement frontend theme context and provider
  - [x] 5.1 Create ThemeContext with theme state management
    - Create `frontend/src/context/ThemeContext.jsx`
    - Define ThemeContext with currentTheme, themeConfig, setTheme, and isLoading
    - Implement ThemeProvider component that wraps children
    - Load initial theme from auth response or API call
    - Implement setTheme function that updates database via API and applies CSS variables
    - Handle API errors with fallback to default theme
    - _Requirements: 5.1, 5.2, 9.3, 9.4_
  
  - [x] 5.2 Implement CSS variable application logic
    - Update document.documentElement.style.setProperty for each CSS variable
    - Apply --bg-main, --bg-sidebar, --accent-color, --text-primary
    - Ensure CSS variables update immediately when theme changes
    - Handle errors during CSS variable application
    - _Requirements: 5.1, 5.2_
  
  - [x] 5.3 Write unit tests for ThemeContext
    - Test theme loading from initial data
    - Test setTheme function updates state and calls API
    - Test CSS variables are applied correctly
    - Test error handling falls back to default theme
    - Test isLoading state during theme updates
    - _Requirements: 5.1, 5.2, 9.3, 9.4_
  
  - [x] 5.4 Write property test for CSS variable updates
    - **Property 6: Theme Change Updates CSS Variables**
    - **Validates: Requirements 5.2**
    - Test that any theme change updates all four CSS variables correctly
    - Verify computed styles match theme preset values
    - _Requirements: 5.2_

- [ ] 6. Create theme selector UI components
  - [x] 6.1 Create ThemeSelector component for Settings page
    - Create `frontend/src/components/admin/ThemeSelector.jsx`
    - Display visual preview cards for each theme preset
    - Implement radio button selection for themes
    - Show theme name and description for each option
    - Handle theme selection and call onThemeChange callback
    - Display loading state during theme update
    - _Requirements: 2.1, 2.2_
  
  - [x] 6.2 Create FirstTimeThemePopup component
    - Create `frontend/src/components/admin/FirstTimeThemePopup.jsx`
    - Implement modal overlay with theme selection UI
    - Display visual previews of both themes with descriptions
    - Add "Select" button for each theme
    - Add "Skip" button that defaults to 'default' theme
    - Implement animated entrance/exit with Framer Motion
    - Call onThemeSelect callback when theme chosen
    - Update hasSeenThemePopup flag when popup is dismissed
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  
  - [ ] 6.3 Write unit tests for ThemeSelector
    - Test component renders all theme options
    - Test theme selection triggers onThemeChange callback
    - Test loading state disables interaction
    - Test visual preview displays correctly
    - _Requirements: 2.1, 2.2_
  
  - [x] 6.4 Write unit tests for FirstTimeThemePopup
    - Test popup displays when isOpen is true
    - Test theme selection calls onThemeSelect with correct theme
    - Test skip button calls onSkip callback
    - Test popup doesn't display when isOpen is false
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 7. Integrate theme system into Admin Panel
  - [x] 7.1 Wrap AdminLayout with ThemeProvider
    - Update `frontend/src/pages/admin/AdminLayout.jsx`
    - Import and wrap component tree with ThemeProvider
    - Ensure ThemeProvider is at root of admin component hierarchy
    - _Requirements: 5.3_
  
  - [x] 7.2 Add first-time theme popup logic to AdminLayout
    - Check hasSeenThemePopup flag from auth context
    - Conditionally render FirstTimeThemePopup when flag is false
    - Handle theme selection from popup
    - Update hasSeenThemePopup flag after popup is shown
    - _Requirements: 7.1, 7.5, 7.6_
  
  - [x] 7.3 Add theme selector to Settings page
    - Update `frontend/src/pages/admin/Pengaturan.jsx`
    - Add "Mode Tampilan" section with ThemeSelector component
    - Implement theme save handler with success/error feedback
    - Display current active theme
    - Show loading state during theme update
    - Display error toast if theme save fails
    - _Requirements: 2.1, 2.3, 2.4, 2.5_
  
  - [ ] 7.4 Write property test for theme selection triggers persistence
    - **Property 2: Theme Selection Triggers Persistence**
    - **Validates: Requirements 2.3, 7.3**
    - Test that any theme selection (Settings or popup) sends API request
    - Verify API is called with correct theme value
    - _Requirements: 2.3, 7.3_

- [x] 8. Implement theme scope isolation
  - [x] 8.1 Apply theme CSS variables only to admin components
    - Ensure CSS variables are set on document root but only used by admin components
    - Verify admin components in `frontend/src/pages/admin/` use CSS variables
    - Ensure customer view components use separate stylesheets
    - Add scoping classes or data attributes if needed for isolation
    - _Requirements: 8.1, 8.2_
  
  - [x] 8.2 Verify customer view remains unaffected
    - Check that MenuCustomer.jsx and other customer components don't use admin CSS variables
    - Ensure customer views maintain default purple/dark blue colors
    - Test that admin theme changes don't leak to customer views
    - _Requirements: 5.4, 8.2, 8.3_
  
  - [x] 8.3 Write property test for customer view theme isolation
    - **Property 8: Customer View Theme Isolation**
    - **Validates: Requirements 5.4, 8.3**
    - Test that admin theme changes don't affect customer view styling
    - Verify customer components don't use admin CSS variables
    - _Requirements: 5.4, 8.3_
  
  - [ ] 8.4 Write property test for admin scope isolation
    - **Property 15: Admin Scope Isolation**
    - **Validates: Requirements 8.1**
    - Test that components in admin directory use theme CSS variables
    - Test that components outside admin directory don't use theme CSS variables
    - _Requirements: 8.1_

- [x] 9. Implement visual enhancements for light-coffee theme
  - [x] 9.1 Add shadow styling for light backgrounds
    - Update admin component styles to include subtle shadows when bgMain is white
    - Apply box-shadow to cards, panels, and containers in light-coffee theme
    - Ensure shadows are visible but not overwhelming
    - Test shadow visibility on white backgrounds
    - _Requirements: 5.5, 6.1_
  
  - [x] 9.2 Verify color contrast and readability
    - Test text readability with light-coffee theme colors
    - Ensure textPrimary (#2D2D2D) has sufficient contrast on white background
    - Verify accentColor (#A0522D) is visible for interactive elements
    - Check that all text meets WCAG AA standards
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [ ] 9.3 Write property test for color contrast accessibility
    - **Property 16: Color Contrast Accessibility**
    - **Validates: Requirements 6.2**
    - Test that all theme presets meet WCAG AA contrast ratio (4.5:1)
    - Calculate contrast between textPrimary and bgMain for each theme
    - _Requirements: 6.2_

- [x] 10. Checkpoint - Frontend components complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Implement cross-session theme synchronization
  - [x] 11.1 Ensure theme loads from database on login
    - Verify theme is fetched from auth response on initial login
    - Implement fallback API call if theme not in auth response
    - Store theme in React state (not localStorage)
    - _Requirements: 9.1, 9.3_
  
  - [x] 11.2 Test theme consistency across devices
    - Verify theme persists after logout and login
    - Test that theme changes on one device reflect on other devices after login
    - Ensure database is single source of truth for theme preference
    - _Requirements: 9.1, 9.2_
  
  - [-] 11.3 Write property test for cross-device theme consistency
    - **Property 10: Cross-Device Theme Consistency**
    - **Validates: Requirements 9.1**
    - Test that theme loaded from database matches saved preference
    - Simulate multiple login sessions and verify theme consistency
    - _Requirements: 9.1_
  
  - [ ] 11.4 Write property test for database theme persistence
    - **Property 7: Database Theme Persistence**
    - **Validates: Requirements 3.2**
    - Test that theme save operations update database correctly
    - Verify selectedTheme field is updated in tenant document
    - _Requirements: 3.2_

- [x] 12. Implement error handling and fallback logic
  - [x] 12.1 Add error handling for theme API failures
    - Catch network errors during theme fetch/update
    - Display user-friendly error messages in Indonesian
    - Fall back to default theme if API fails
    - Maintain previous theme if update fails
    - Log errors to console for debugging
    - _Requirements: 2.5, 9.4_
  
  - [x] 12.2 Implement invalid theme fallback
    - Validate theme name from server against preset keys
    - Fall back to default theme if invalid theme received
    - Log warning for investigation
    - Continue with default theme without blocking UI
    - _Requirements: 3.5, 9.4_
  
  - [ ] 12.3 Write property test for invalid theme fallback
    - **Property 5: Invalid Theme Fallback**
    - **Validates: Requirements 3.5, 9.4**
    - Test that invalid/missing theme values fall back to default
    - Verify system remains functional with fallback theme
    - _Requirements: 3.5, 9.4_
  
  - [ ] 12.4 Write property test for error handling preserves previous theme
    - **Property 14: Error Handling Preserves Previous Theme**
    - **Validates: Requirements 2.5**
    - Test that failed theme updates maintain current theme
    - Verify error messages are displayed to user
    - _Requirements: 2.5_

- [x] 13. Implement internal navigation for customer preview
  - [x] 13.1 Update navigation to customer view
    - Modify "Lihat Tampilan Customer" menu item to use useNavigate
    - Navigate to customer view route within same application
    - Preserve authentication context during navigation
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [x] 13.2 Add back button to return to Admin Panel
    - Add navigation button in customer view to return to admin
    - Use useNavigate to go back to admin dashboard
    - Maintain authentication state during navigation
    - _Requirements: 4.4_
  
  - [ ] 13.3 Write property test for navigation preserves authentication
    - **Property 12: Navigation Preserves Authentication**
    - **Validates: Requirements 4.3**
    - Test that JWT tokens remain valid after navigation
    - Verify session data is accessible in both admin and customer views
    - _Requirements: 4.3_

- [x] 14. Implement first-time popup display logic
  - [x] 14.1 Add popup display logic based on hasSeenThemePopup flag
    - Check hasSeenThemePopup from tenant data in auth response
    - Display FirstTimeThemePopup when flag is false
    - Hide popup when flag is true
    - Update flag to true after popup is shown (regardless of selection)
    - _Requirements: 7.1, 7.5, 7.6_
  
  - [ ] 14.2 Write property test for first-time popup display logic
    - **Property 9: First-Time Popup Display Logic**
    - **Validates: Requirements 7.1, 7.5**
    - Test popup displays when hasSeenThemePopup is false
    - Test popup doesn't display when hasSeenThemePopup is true
    - _Requirements: 7.1, 7.5_

- [x] 15. Add theme preview functionality
  - [x] 15.1 Implement real-time theme preview in selector
    - Update ThemeSelector to show live preview when hovering/selecting
    - Apply temporary CSS variables for preview without saving
    - Revert to current theme if selection is cancelled
    - _Requirements: 2.2_
  
  - [ ] 15.2 Write property test for theme preview reflects selection
    - **Property 13: Theme Preview Reflects Selection**
    - **Validates: Requirements 2.2**
    - Test that preview updates immediately when theme option selected
    - Verify preview shows correct colors before confirmation
    - _Requirements: 2.2_

- [x] 16. Implement theme update authorization
  - [x] 16.1 Add authorization checks in theme controller
    - Verify JWT token contains valid tenantId
    - Compare JWT tenantId with route parameter tenantId
    - Return 403 Forbidden if tenantIds don't match
    - Log unauthorized access attempts
    - _Requirements: 10.3, 10.6_
  
  - [x] 16.2 Write property test for theme update authorization
    - **Property 11: Theme Update Authorization**
    - **Validates: Requirements 10.3**
    - Test that unauthorized users receive 403 error
    - Verify only tenant owners can update their theme
    - _Requirements: 10.3_

- [-] 17. Final integration and testing
  - [-] 17.1 Run all unit tests and property tests
    - Execute frontend test suite
    - Execute backend test suite
    - Verify all property tests pass with 100+ iterations
    - Fix any failing tests
  
  - [ ] 17.2 Perform manual integration testing
    - Test complete first-time user flow (register, login, see popup, select theme)
    - Test theme change in Settings page
    - Test theme persistence across logout/login
    - Test theme consistency across different browsers
    - Test customer view isolation from admin theme
    - Test error handling with network failures
    - Verify light-coffee theme readability and shadows
    - Test navigation between admin and customer views
  
  - [x] 17.3 Verify all requirements are met
    - Review requirements document and confirm all acceptance criteria satisfied
    - Check that all 10 requirements have corresponding implementation
    - Verify all 16 correctness properties are validated
    - Document any deviations or limitations

- [x] 18. Final checkpoint - Feature complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based and unit tests that can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties across all inputs
- Unit tests validate specific examples, edge cases, and UI interactions
- The implementation uses JavaScript/React for frontend and Node.js/Express for backend
- Database is MongoDB with superkafe_v2 database (not superkafe_main as mentioned in some requirements)
- Theme presets are limited to 'default' and 'light-coffee' for this release
- Customer theme customization is explicitly out of scope for this feature
- All error messages should be in Indonesian for consistency with existing UI
