const express = require('express');
const ProductController = require('../controllers/productController');

const router = express.Router();

router.get('/', ProductController.getCategories);

module.exports = router;
