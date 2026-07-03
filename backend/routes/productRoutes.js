const express = require('express');
const ProductController = require('../controllers/productController');

const router = express.Router();

router.get('/', ProductController.getProducts);
router.get('/:id', ProductController.getProductById);

module.exports = router;
