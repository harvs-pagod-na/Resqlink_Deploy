const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const authenticate = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/me', authenticate, profileController.getProfile);
router.get('/user/:userId', profileController.getProfile);
router.get('/:userId', profileController.getProfile);
router.put('/me', authenticate, profileController.updateProfile);
router.post('/upload', authenticate, upload.single('file'), profileController.uploadDocument);

module.exports = router;
