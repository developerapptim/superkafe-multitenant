const Tenant = require('../models/Tenant');

/**
 * Controller untuk manajemen tema tenant
 * Mengikuti AI_RULES.md: Error handling, logging, dan defensive programming
 */

const ALLOWED_THEMES = ['default', 'light-coffee'];

/**
 * GET /api/tenants/:tenantId/theme
 * Mendapatkan tema saat ini untuk tenant
 */
const getTheme = async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Validasi tenantId format
    if (!tenantId || !tenantId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid tenant ID format'
      });
    }

    // Verifikasi user memiliki akses ke tenant ini
    if (!req.user || !req.user.tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (req.user.tenantId !== tenantId) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to access this tenant\'s theme'
      });
    }

    // Ambil tenant dari database
    const tenant = await Tenant.findById(tenantId).lean();

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found'
      });
    }

    // Return theme data
    res.json({
      theme: tenant.selectedTheme || 'default',
      hasSeenThemePopup: tenant.hasSeenThemePopup || false
    });

  } catch (error) {
    console.error('[THEME ERROR] Gagal mengambil tema tenant', {
      error: error.message,
      stack: error.stack,
      tenantId: req.params.tenantId
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve theme'
    });
  }
};

/**
 * PUT /api/tenants/:tenantId/theme
 * Memperbarui tema untuk tenant
 */
const updateTheme = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { theme, markPopupSeen } = req.body;

    // Validasi tenantId format
    if (!tenantId || !tenantId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid tenant ID format'
      });
    }

    // Validasi theme name
    if (!theme) {
      return res.status(400).json({
        success: false,
        error: 'Theme name is required'
      });
    }

    if (!ALLOWED_THEMES.includes(theme)) {
      return res.status(400).json({
        success: false,
        error: `Invalid theme name. Allowed values: ${ALLOWED_THEMES.join(', ')}`
      });
    }

    // Verifikasi user memiliki akses ke tenant ini
    // req.user diisi oleh middleware auth (checkJwt)
    if (!req.user || !req.user.tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (req.user.tenantId !== tenantId) {
      console.warn('[THEME] Unauthorized theme update attempt', {
        userId: req.user.id || req.user.userId,
        userTenantId: req.user.tenantId,
        requestedTenantId: tenantId
      });

      return res.status(403).json({
        success: false,
        error: 'You do not have permission to update this tenant\'s theme'
      });
    }

    // Prepare update object
    const updateData = { 
      selectedTheme: theme,
      updatedAt: new Date()
    };

    // If markPopupSeen is true, also update hasSeenThemePopup flag
    if (markPopupSeen === true) {
      updateData.hasSeenThemePopup = true;
    }

    // Update tema di database
    const updatedTenant = await Tenant.findByIdAndUpdate(
      tenantId,
      updateData,
      { new: true }
    );

    if (!updatedTenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found'
      });
    }

    console.log('[THEME] Theme updated successfully', {
      tenantId: updatedTenant._id,
      tenantSlug: updatedTenant.slug,
      oldTheme: updatedTenant.selectedTheme,
      newTheme: theme,
      popupMarkedSeen: markPopupSeen === true,
      userId: req.user?.id
    });

    res.json({
      success: true,
      theme: updatedTenant.selectedTheme,
      message: 'Theme updated successfully'
    });

  } catch (error) {
    console.error('[THEME ERROR] Gagal memperbarui tema tenant', {
      error: error.message,
      stack: error.stack,
      tenantId: req.params.tenantId,
      theme: req.body.theme
    });

    res.status(500).json({
      success: false,
      error: 'Failed to update theme. Please try again.'
    });
  }
};

module.exports = {
  getTheme,
  updateTheme
};
