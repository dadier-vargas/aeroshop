const express = require('express');
const NotificationController = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', protect, NotificationController.getNotifications);
router.put('/:id/read', protect, NotificationController.markAsRead);

module.exports = router;
