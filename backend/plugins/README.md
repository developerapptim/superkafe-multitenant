# Tenant Scoping Plugin

## Overview

The Tenant Scoping Plugin automatically enforces tenant data isolation in Mongoose models by:

1. **Auto-injecting tenantId filters** into all queries (find, update, delete)
2. **Auto-setting tenantId** on document creation
3. **Preventing cross-tenant modifications** by validating tenantId on save

This eliminates the need for manual tenantId filtering in controllers, reducing human error and ensuring perfect tenant isolation.

## Usage

### Applying the Plugin to a Model

```javascript
const mongoose = require('mongoose');
const tenantScopingPlugin = require('../plugins/tenantScopingPlugin');

const MenuItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  // ... other fields
  // Note: tenantId field is automatically added by the plugin
});

// Apply the tenant scoping plugin
MenuItemSchema.plugin(tenantScopingPlugin);

module.exports = mongoose.model('MenuItem', MenuItemSchema);
```

### How It Works

#### 1. Automatic tenantId Field

The plugin automatically adds a `tenantId` field to your schema:

```javascript
{
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  }
}
```

#### 2. Auto-Injection on Queries

All queries automatically filter by the current tenant context:

```javascript
// In your controller
const MenuItem = require('../models/MenuItem');

// This query automatically becomes: MenuItem.find({ tenantId: req.tenant.id })
const items = await MenuItem.find({});

// This also works for updates and deletes
await MenuItem.updateOne({ name: 'Coffee' }, { price: 5000 });
await MenuItem.deleteOne({ name: 'Tea' });
```

#### 3. Auto-Set on Creation

New documents automatically get the tenantId from context:

```javascript
// In your controller
const newItem = new MenuItem({
  name: 'Espresso',
  price: 15000
  // tenantId is automatically set from req.tenant.id
});
await newItem.save();
```

#### 4. Cross-Tenant Protection

The plugin prevents modifying documents from other tenants:

```javascript
// If you try to save a document with a different tenantId than the current context,
// it will throw an error: "Cannot modify document from different tenant"
```

## Tenant Context

The plugin uses AsyncLocalStorage to access the current tenant context, which is set by the `tenantResolver` middleware:

```javascript
// In tenantResolver middleware
const { setTenantContext } = require('../utils/tenantContext');

setTenantContext({
  id: tenant._id,
  slug: tenant.slug,
  name: tenant.name,
  dbName: tenant.dbName
});
```

## Admin Override

If you need to query across tenants (e.g., for admin operations), explicitly provide the tenantId:

```javascript
// This will NOT be filtered by the current tenant context
const allItems = await MenuItem.find({ tenantId: specificTenantId });
```

## Models That Should Use This Plugin

Apply this plugin to all tenant-scoped models:

- MenuItem
- Order
- Employee
- Inventory (Ingredient)
- Cash
- CashTransaction
- Table
- Customer
- Recipe
- Category
- Expense
- Debt
- Attendance
- Shift
- Reservation
- ServiceRequest
- Feedback
- And any other model that stores tenant-specific data

## Models That Should NOT Use This Plugin

Do NOT apply this plugin to:

- Tenant (main tenant registry)
- User (global user accounts)
- Any model in the main database (not tenant-specific)

## Testing

The plugin includes comprehensive unit tests in `backend/tests/plugins/tenantScopingPlugin.test.js`.

Run tests:
```bash
npm test -- tests/plugins/tenantScopingPlugin.test.js
```

## Security Considerations

1. **JWT as Source of Truth**: The plugin uses tenant context from JWT (via middleware), not from URL parameters
2. **Automatic Enforcement**: No manual filtering needed, reducing risk of developer error
3. **Audit Logging**: Cross-tenant access attempts are logged with security warnings
4. **Fail-Safe**: If no tenant context is available, queries will fail rather than leak data

## Requirements

- **Requirements 2.2**: Automatic tenantId filter injection
- **Requirements 2.4**: Auto-set tenantId on document creation
- **Requirements 2.3**: Cross-tenant data isolation
- **Requirements 2.5**: Cross-tenant modification prevention
