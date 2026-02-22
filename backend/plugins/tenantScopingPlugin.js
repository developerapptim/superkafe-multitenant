const { getTenantContext } = require('../utils/tenantContext');

/**
 * Mongoose Tenant Scoping Plugin
 * 
 * This plugin automatically injects tenantId filters into all queries
 * and auto-sets tenantId on document creation to ensure perfect tenant
 * data isolation.
 * 
 * Features:
 * - Auto-inject tenantId filter on all read queries (find, findOne, etc.)
 * - Auto-inject tenantId filter on all write queries (updateOne, deleteOne, etc.)
 * - Auto-set tenantId on document creation (save)
 * - Uses AsyncLocalStorage to access tenant context without explicit passing
 * 
 * Usage:
 *   const tenantScopingPlugin = require('./plugins/tenantScopingPlugin');
 *   MenuItemSchema.plugin(tenantScopingPlugin);
 * 
 * Requirements: 2.2, 2.4
 */
function tenantScopingPlugin(schema, options = {}) {
  // Add tenantId field to schema if it doesn't exist
  if (!schema.path('tenantId')) {
    schema.add({
      tenantId: {
        type: schema.constructor.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
      }
    });
  }

  /**
   * Helper function to inject tenantId filter into query
   * @param {Object} query - Mongoose query object
   */
  function injectTenantFilter(query) {
    const tenant = getTenantContext();
    
    if (tenant && tenant.id) {
      const filter = query.getFilter();
      
      // Only inject if tenantId is not already in the filter
      // This allows explicit override if needed (e.g., for admin operations)
      if (!filter.tenantId) {
        query.where({ tenantId: tenant.id });
      }
    } else {
      // Log warning if no tenant context is available for a query
      console.warn('[TENANT PLUGIN] No tenant context available for query', {
        model: query.model?.modelName || 'unknown',
        operation: query.op,
        filter: query.getFilter(),
        timestamp: new Date().toISOString()
      });
    }
  }

  // Hook into find queries
  schema.pre('find', function() {
    injectTenantFilter(this);
  });

  schema.pre('findOne', function() {
    injectTenantFilter(this);
  });

  schema.pre('findOneAndUpdate', function() {
    injectTenantFilter(this);
  });

  schema.pre('findOneAndDelete', function() {
    injectTenantFilter(this);
  });

  schema.pre('findOneAndReplace', function() {
    injectTenantFilter(this);
  });

  // Hook into update queries
  schema.pre('updateOne', function() {
    injectTenantFilter(this);
  });

  schema.pre('updateMany', function() {
    injectTenantFilter(this);
  });

  // Hook into delete queries
  schema.pre('deleteOne', function() {
    injectTenantFilter(this);
  });

  schema.pre('deleteMany', function() {
    injectTenantFilter(this);
  });

  // Hook into count/aggregate queries
  schema.pre('count', function() {
    injectTenantFilter(this);
  });

  schema.pre('countDocuments', function() {
    injectTenantFilter(this);
  });

  schema.pre('estimatedDocumentCount', function() {
    injectTenantFilter(this);
  });

  // Auto-set tenantId on document creation
  schema.pre('validate', function(next) {
    // Only set tenantId if it's a new document and tenantId is not already set
    if (this.isNew && !this.tenantId) {
      const tenant = getTenantContext();
      
      if (tenant && tenant.id) {
        this.tenantId = tenant.id;
      } else {
        // If no tenant context is available, this is likely an error
        // Log a warning but don't fail the save (let required validation handle it)
        console.warn('[TENANT PLUGIN] No tenant context available for new document', {
          severity: 'WARNING',
          model: this.constructor.modelName,
          documentId: this._id,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    next();
  });

  // Validate that tenantId matches current context on updates
  schema.pre('save', function(next) {
    // For existing documents being updated, verify tenantId matches context
    if (!this.isNew && this.tenantId) {
      const tenant = getTenantContext();
      
      if (tenant && tenant.id && this.tenantId.toString() !== tenant.id.toString()) {
        console.error('[TENANT PLUGIN SECURITY] Attempt to modify document from different tenant', {
          severity: 'HIGH',
          documentTenantId: this.tenantId.toString(),
          contextTenantId: tenant.id.toString(),
          contextTenantSlug: tenant.slug,
          model: this.constructor.modelName,
          documentId: this._id,
          timestamp: new Date().toISOString()
        });
        
        const error = new Error('Cannot modify document from different tenant');
        error.code = 'TENANT_MISMATCH';
        error.statusCode = 403;
        return next(error);
      }
    }
    
    next();
  });
}

module.exports = tenantScopingPlugin;
