const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authenticate = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimiter');
const upload = require('../middleware/upload');

router.post('/register', upload.single('resume'), authController.register);
router.post(
  '/register/cross-match-identity',
  upload.fields([
    { name: 'id_front', maxCount: 1 },
    { name: 'id_back', maxCount: 1 },
    { name: 'id_file', maxCount: 1 },
  ]),
  authController.crossMatchIdentity
);
router.post('/login', loginLimiter, authController.login);

router.post('/forgot-password/verify-email', authController.forgotPasswordVerifyEmail);
router.post('/forgot-password/verify-face', upload.single('selfie'), authController.forgotPasswordVerifyFace);
router.post('/forgot-password/reset-password', authController.forgotPasswordResetPassword);

router.post('/refresh-token', authController.refreshToken);
router.get('/me', authenticate, authController.me);
router.post('/sub-admin', authenticate, authController.createSubAdmin);
router.post('/responder', authenticate, authController.createResponder);

module.exports = router;
