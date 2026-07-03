const express = require('express');
const OrderController = require('../controllers/orderController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Rutas protegidas para clientes
router.post('/', protect, OrderController.createOrder);
router.get('/my-orders', protect, OrderController.getMyOrders);
router.get('/:id', protect, OrderController.getOrderById);

// Validación de cupones (también protegida para evitar scraping de códigos)
router.post('/coupons/validate', protect, OrderController.validateCoupon);

module.exports = router;
