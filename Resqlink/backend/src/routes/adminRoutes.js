const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authenticate = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

router.use(authenticate, requireRole('super_admin', 'admin', 'sub_admin'));

router.get('/dashboard-stats', adminController.getDashboardStats);
router.get('/verification-queue', adminController.getVerificationQueue);
router.patch('/verification-queue/:id', adminController.reviewVerification);
router.post('/verifications/:id/approve', adminController.approveVerification);

router.get('/users', adminController.getAllUsers);
router.get('/users/:id/verification', adminController.getUserVerification);
router.patch('/users/:id/active', adminController.toggleUserActiveStatus);
router.patch('/users/:id/verification', adminController.toggleUserVerificationStatus);

router.get('/audit-logs', adminController.getAuditLogs);

router.post('/trigger-backup', requireRole('super_admin', 'admin'), adminController.triggerBackup);

// Admin Broadcast Notification Management
router.post('/notifications/broadcast', adminController.sendBroadcastNotification);
router.get('/notifications/history', adminController.getNotificationHistory);

module.exports = router;
