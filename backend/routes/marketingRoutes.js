const express = require('express');
const router = express.Router();
const MarketingController = require('../controllers/MarketingController');
const { uploadBanner } = require('../middleware/uploadMiddleware');

// ========== VOUCHER ROUTES ==========
router.get('/vouchers', MarketingController.getVouchers);
router.post('/vouchers', MarketingController.createVoucher);
router.put('/vouchers/:id', MarketingController.updateVoucher);
router.patch('/vouchers/:id/toggle', MarketingController.toggleVoucher);
router.delete('/vouchers/:id', MarketingController.deleteVoucher);

// ========== APPLY VOUCHER (Customer Cart) ==========
router.post('/cart/apply-voucher', MarketingController.applyVoucher);

// ========== BANNER ROUTES ==========
router.get('/banners', MarketingController.getBanners);
router.post('/banners', uploadBanner.single('image'), MarketingController.createBanner);
router.delete('/banners/:id', MarketingController.deleteBanner);

module.exports = router;
