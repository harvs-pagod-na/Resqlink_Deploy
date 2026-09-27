const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const resqController = require('../controllers/resqController');
const authenticate = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, '../../uploads/incidents');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `incident-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  }
});
const upload = multer({ storage });

// Incident Media Ingestion Endpoints
router.post('/upload-photo', authenticate, upload.single('photo'), resqController.uploadIncidentPhoto);
router.get('/upload-url', authenticate, resqController.getUploadUrl);
router.put('/direct-upload/*', resqController.handleDirectUpload);
router.post('/direct-upload/*', resqController.handleDirectUpload);

// User Emergency Endpoints
router.post('/request', authenticate, resqController.createResqRequest);
router.get('/my-requests', authenticate, resqController.getMyResqRequests);
router.get('/active', authenticate, resqController.getActiveResqRequest);
router.post('/cancel/:id', authenticate, resqController.cancelResqRequest);

// Real-Time Database Analytics Endpoint (Zero Mock Data)
router.get(
  '/analytics',
  authenticate,
  requireRole('admin', 'sub_admin', 'super_admin', 'mdrrmo_admin', 'pnp_responder', 'bfp_responder'),
  resqController.getResqAnalytics
);

// Admin & Dispatch Endpoints
router.get(
  '/admin/all',
  authenticate,
  requireRole('admin', 'sub_admin', 'super_admin', 'mdrrmo_admin', 'pnp_responder', 'bfp_responder', 'responder'),
  resqController.getAllResqRequests
);
router.get(
  '/responder/active',
  authenticate,
  requireRole('admin', 'sub_admin', 'super_admin', 'mdrrmo_admin', 'pnp_responder', 'bfp_responder', 'responder'),
  resqController.getResponderActiveIncident
);
router.put(
  '/dispatch/:id',
  authenticate,
  requireRole('admin', 'sub_admin', 'super_admin', 'mdrrmo_admin', 'pnp_responder', 'bfp_responder', 'responder'),
  resqController.dispatchResqRequest
);
router.post(
  '/assign/:id',
  authenticate,
  requireRole('admin', 'sub_admin', 'super_admin', 'mdrrmo_admin'),
  resqController.assignResponder
);
router.post(
  '/accept/:id',
  authenticate,
  requireRole('admin', 'sub_admin', 'super_admin', 'responder', 'pnp_responder', 'bfp_responder', 'mdrrmo_admin'),
  resqController.acceptResqRequest
);
router.get(
  '/subadmins',
  authenticate,
  requireRole('admin', 'sub_admin', 'super_admin', 'mdrrmo_admin'),
  resqController.getSubAdmins
);
router.put(
  '/confirm-subadmin/:id',
  authenticate,
  requireRole('admin', 'sub_admin', 'super_admin'),
  resqController.subadminConfirmAssignment
);
router.get(
  '/responders',
  authenticate,
  requireRole('admin', 'sub_admin', 'super_admin', 'mdrrmo_admin', 'pnp_responder', 'bfp_responder', 'responder'),
  resqController.getAvailableResponders
);
router.post(
  '/update-location/:id',
  authenticate,
  requireRole('admin', 'sub_admin', 'super_admin', 'mdrrmo_admin', 'pnp_responder', 'bfp_responder', 'responder'),
  resqController.updateResponderLocation
);

module.exports = router;
