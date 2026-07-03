const express = require('express');
const RefundController = require('../controllers/refundController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', protect, RefundController.requestRefund);

module.exports = router;
