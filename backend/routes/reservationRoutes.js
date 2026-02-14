const express = require('express');
const router = express.Router();
const ReservationController = require('../controllers/ReservationController');
const { checkApiKey } = require('../middleware/auth');

router.use(checkApiKey);

router.post('/', ReservationController.createReservation);
router.get('/', ReservationController.getReservations);
router.put('/:id/approve', ReservationController.approveReservation);
router.put('/:id/reject', ReservationController.rejectReservation);

module.exports = router;
