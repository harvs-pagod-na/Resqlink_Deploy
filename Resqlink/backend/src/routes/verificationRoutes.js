const express = require('express');
const router = express.Router();
const verificationController = require('../controllers/verificationController');
const authenticate = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post(
  '/submit',
  authenticate,
  upload.fields([
    { name: 'id_front', maxCount: 1 },
    { name: 'id_back', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
  ]),
  verificationController.submitVerification
);


router.post(
  '/submit-complete-onboarding',
  authenticate,
  upload.fields([
    { name: 'id_front', maxCount: 1 },
    { name: 'id_back', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
  ]),
  verificationController.submitCompleteOnboarding
);
router.get('/status', authenticate, verificationController.getVerificationStatus);


module.exports = router;
