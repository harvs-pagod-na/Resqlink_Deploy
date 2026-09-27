const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');
const authenticate = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// Public / Citizen routes
router.get('/active', alertController.getActiveAlerts);

// Admin / MDRRMO routes
router.get(
  '/all',
  authenticate,
  requireRole('admin', 'sub_admin', 'super_admin', 'mdrrmo_admin'),
  alertController.getAllAlerts
);

router.post(
  '/create',
  authenticate,
  requireRole('admin', 'sub_admin', 'super_admin', 'mdrrmo_admin'),
  alertController.createPublicAlert
);

router.patch(
  '/toggle/:id',
  authenticate,
  requireRole('admin', 'sub_admin', 'super_admin', 'mdrrmo_admin'),
  alertController.toggleAlertStatus
);

router.delete(
  '/:id',
  authenticate,
  requireRole('admin', 'sub_admin', 'super_admin', 'mdrrmo_admin'),
  alertController.deleteAlert
);

module.exports = router;
