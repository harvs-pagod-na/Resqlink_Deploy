const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const profileController = require('../controllers/profileController');

router.get('/:id/reputation', userController.getUserReputation);
router.get('/:id', profileController.getProfile);

module.exports = router;
