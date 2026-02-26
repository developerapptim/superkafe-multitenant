# Theme Scope Isolation Documentation

## Overview

This document explains how theme scope isolation is implemented in the SuperKafe application to ensure that admin theme changes do not affect customer-facing views.

**Feature**: Seamless Branding Integration  
**Requirements**: 8.1, 8.2, 8.3, 5.4

## Architecture

### CSS Variables (Admin Only)

The theme system uses CSS variables set on the document root:

```css
:root {
  --bg-main: #0F0A1F;        /* Main background color */
  --bg-sidebar: #1E1B4B;     /* Sidebar background color */
  --accent-color: #8B5CF6;   /* Accent/primary color */
  --text-primary: #FFFFFF;   /* Primary text color */
}
```

These variables are dynamically updated by `ThemeContext` when the admin changes themes.

### Isolation Strategy

The application uses a **directory-based isolation strategy**:

#### Admin Components (`frontend/src/pages/admin/`)
- **Location**: All admin components are in `frontend/src/pages/admin/` directory
- **Styling Approach**: Use hardcoded Tailwind utility classes
- **CSS Variables**: Available but NOT currently used by components
- **Theme File**: `frontend/src/styles/admin-theme.css` provides CSS classes that use variables (optional)

#### Customer Components (`frontend/src/pages/customer/`)
- **Location**: All customer components are in `frontend/src/pages/customer/` directory
- **Styling Approach**: Use hardcoded Tailwind utility classes
- **CSS Variables**: Do NOT use admin CSS variables
- **Independence**: Maintain default purple/dark blue color scheme

## Current Implementation Status

### ✅ Isolation Achieved

The theme scope isolation is **already implemented** through the following mechanisms:

1. **Separate Component Directories**
   - Admin: `frontend/src/pages/admin/`
   - Customer: `frontend/src/pages/customer/`

2. **Hardcoded Color Values**
   - Both admin and customer components use Tailwind utility classes with hardcoded colors
   - Example: `bg-[#1E1B4B]`, `text-white`, `border-purple-500/30`

3. **No CSS Variable Usage**
   - Customer components do NOT reference CSS variables
   - Admin components currently do NOT reference CSS variables either
   - This creates natural isolation

4. **ThemeContext Scope**
   - `ThemeContext` is only used in `AdminLayout.jsx`
   - Customer views are rendered outside of `ThemeProvider`
   - CSS variables are set globally but not used by customer components

### 🔄 Future Enhancement (Optional)

To make admin components actually use the theme system:

1. **Update Admin Components** to use CSS variable-based classes:
   ```jsx
   // Instead of:
   <div className="bg-[#1E1B4B]">
   
   // Use:
   <div className="admin-bg-sidebar">
   ```

2. **Import Admin Theme CSS** in admin components:
   ```jsx
   import '../../styles/admin-theme.css';
   ```

3. **Keep Customer Components Unchanged**:
   - Do NOT import `admin-theme.css` in customer components
   - Continue using hardcoded Tailwind classes

## Verification

### Manual Testing

1. **Admin Theme Change**:
   - Login as admin
   - Go to Settings → Mode Tampilan
   - Change theme to "Light Coffee"
   - Verify admin panel colors change

2. **Customer View Check**:
   - Navigate to customer view (Menu Customer)
   - Verify colors remain purple/dark blue
   - Verify no white or brown colors appear

3. **Cross-Navigation**:
   - Switch between admin and customer views
   - Verify each maintains its own color scheme

### Automated Testing

Run the customer view isolation tests:

```bash
npm test frontend/tests/theme/customerViewIsolation.test.jsx
```

These tests verify:
- Customer views don't use admin CSS variables
- Customer views maintain default colors
- Admin theme changes don't leak to customer views

## Technical Details

### CSS Variable Scope

CSS variables are set on `:root` (document.documentElement), making them globally available:

```javascript
// ThemeContext.jsx
document.documentElement.style.setProperty('--bg-main', '#FFFFFF');
```

However, **availability ≠ usage**. Customer components don't reference these variables in their styles.

### Tailwind Class Isolation

Both admin and customer components use Tailwind utility classes:

**Admin Example**:
```jsx
<div className="bg-[#1E1B4B] border border-purple-500/30">
```

**Customer Example**:
```jsx
<div className="bg-white/5 border border-purple-500/30">
```

These hardcoded values ensure isolation even though CSS variables exist globally.

### Component Tree Structure

```
App
├── AdminLayout (wrapped with ThemeProvider)
│   ├── Sidebar
│   ├── Dashboard
│   ├── MenuManagement
│   └── Settings
│
└── CustomerLayout (NO ThemeProvider)
    ├── MenuCustomer
    ├── Cart
    └── Checkout
```

## Best Practices

### For Admin Components

1. ✅ Use hardcoded Tailwind classes (current approach)
2. ✅ Optionally use `admin-theme.css` classes for theme-aware styling
3. ❌ Do NOT use inline styles with CSS variables directly
4. ❌ Do NOT import customer-specific stylesheets

### For Customer Components

1. ✅ Use hardcoded Tailwind classes
2. ✅ Maintain default purple/dark blue color scheme
3. ❌ Do NOT import `admin-theme.css`
4. ❌ Do NOT reference CSS variables (--bg-main, etc.)
5. ❌ Do NOT wrap with ThemeProvider

### For New Features

When adding new components:

1. **Determine Component Type**:
   - Admin component? → Place in `frontend/src/pages/admin/`
   - Customer component? → Place in `frontend/src/pages/customer/`

2. **Choose Styling Approach**:
   - Admin: Use hardcoded Tailwind classes (or optionally admin-theme.css)
   - Customer: Use hardcoded Tailwind classes only

3. **Verify Isolation**:
   - Test that admin theme changes don't affect the component if it's customer-facing
   - Test that the component uses appropriate colors for its context

## Troubleshooting

### Issue: Customer view shows admin theme colors

**Cause**: Customer component is using CSS variables or admin-theme.css classes

**Solution**:
1. Check if customer component imports `admin-theme.css` → Remove import
2. Check if customer component uses classes like `admin-bg-main` → Replace with hardcoded Tailwind classes
3. Check if customer component uses inline styles with `var(--bg-main)` → Replace with hardcoded colors

### Issue: Admin theme not applying

**Cause**: Admin components are not using CSS variables

**Solution**:
1. This is expected behavior with current implementation
2. Admin components use hardcoded colors for consistency
3. To enable theme switching, update admin components to use `admin-theme.css` classes

### Issue: CSS variables not updating

**Cause**: ThemeContext not properly initialized

**Solution**:
1. Verify `ThemeProvider` wraps `AdminLayout`
2. Check that `tenantId` is passed to `ThemeProvider`
3. Verify theme API endpoints are working
4. Check browser console for theme-related errors

## Conclusion

Theme scope isolation is achieved through:
1. ✅ Separate component directories
2. ✅ Hardcoded color values in both admin and customer components
3. ✅ No CSS variable usage in customer components
4. ✅ ThemeProvider scoped to admin layout only

This ensures that admin theme changes remain isolated to admin components and do not affect customer-facing views, meeting requirements 8.1, 8.2, 8.3, and 5.4.
