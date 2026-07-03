const express = require('express');
const AdminController = require('../controllers/adminController');
const RefundController = require('../controllers/refundController');
const { protect, isAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// Aplicar middleware de autenticación y rol de administrador a todas las rutas de este router
router.use(protect);
router.use(isAdmin);

// Gestión de Usuarios
router.get('/users', AdminController.getUsers);

// Gestión de Catálogo de Productos (CRUD)
router.post('/products', AdminController.createProduct);
router.put('/products/:id', AdminController.updateProduct);
router.delete('/products/:id', AdminController.deleteProduct);

// Gestión de Pedidos
router.get('/orders', AdminController.getOrders);
router.put('/orders/:id/status', AdminController.updateOrderStatus);

// Gestión de Reembolsos
router.get('/refunds', RefundController.getAllRefunds);
router.post('/refunds/:id/process', RefundController.processRefund);

module.exports = router;
