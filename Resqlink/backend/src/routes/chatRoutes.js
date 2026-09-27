const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authenticate = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/conversations', authenticate, chatController.getConversations);
router.post('/conversations', authenticate, chatController.getOrCreateConversation);
router.get('/messages/:conversationId', authenticate, chatController.getMessages);
router.post('/messages', authenticate, upload.single('attachment'), chatController.sendMessage);

router.post('/send', authenticate, upload.single('attachment'), chatController.sendMessage);

module.exports = router;
