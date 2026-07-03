const express = require('express');
const PaymentController = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Crear Payment Intent (puede ser usado antes de crear el pedido completo)
router.post('/create-intent', protect, PaymentController.createPaymentIntent);

// Verificar estado de un pago
router.get('/status/:paymentIntentId', protect, PaymentController.getPaymentStatus);

// Confirmar pedido una vez Stripe confirma el pago (flujo alternativo/seguro)
router.post('/confirm-order', protect, PaymentController.confirmOrderAfterPayment);

module.exports = router;
