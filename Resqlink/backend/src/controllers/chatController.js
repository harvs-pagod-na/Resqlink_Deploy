
const { Conversation, Message, User, Profile } = require('../models');
const { Op } = require('sequelize');

exports.getConversations = async (req, res) => {
  const userId = req.user.id;

  const conversations = await Conversation.findAll({
    where: {
      [Op.or]: [
        { participant1_id: userId },
        { participant2_id: userId },
      ],
    },
    include: [
      {
        model: User,
        as: 'participant1',
        attributes: ['id', 'email', 'role'],
        include: [{ model: Profile, as: 'profile' }],
      },
      {
        model: User,
        as: 'participant2',
        attributes: ['id', 'email', 'role'],
        include: [{ model: Profile, as: 'profile' }],
      },
    ],
    order: [['last_message_at', 'DESC']],
  });

  return res.json({ success: true, conversations });
};

exports.getOrCreateConversation = async (req, res) => {
  const { recipient_id } = req.body;
  const senderId = req.user.id;

  if (!recipient_id) {
    return res.status(400).json({ success: false, message: 'Recipient ID is required.' });
  }

  let conversation = await Conversation.findOne({
    where: {
      [Op.or]: [
        { participant1_id: senderId, participant2_id: recipient_id },
        { participant1_id: recipient_id, participant2_id: senderId },
      ],
    },
    include: [
      {
        model: User,
        as: 'participant1',
        attributes: ['id', 'email', 'role'],
        include: [{ model: Profile, as: 'profile' }],
      },
      {
        model: User,
        as: 'participant2',
        attributes: ['id', 'email', 'role'],
        include: [{ model: Profile, as: 'profile' }],
      },
    ],
  });

  if (!conversation) {
    conversation = await Conversation.create({
      participant1_id: senderId,
      participant2_id: recipient_id,
      last_message: 'Chat initialized.',
      last_message_at: new Date(),
    });

    conversation = await Conversation.findByPk(conversation.id, {
      include: [
        {
          model: User,
          as: 'participant1',
          attributes: ['id', 'email', 'role'],
          include: [{ model: Profile, as: 'profile' }],
        },
        {
          model: User,
          as: 'participant2',
          attributes: ['id', 'email', 'role'],
          include: [{ model: Profile, as: 'profile' }],
        },
      ],
    });
  }

  return res.json({ success: true, conversation });
};

exports.getMessages = async (req, res) => {
  const { conversationId } = req.params;

  const conversation = await Conversation.findByPk(conversationId);
  if (!conversation) {
    return res.status(404).json({ success: false, message: 'Conversation not found.' });
  }

  if (conversation.participant1_id !== req.user.id && conversation.participant2_id !== req.user.id && req.user.role !== 'super_admin' && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }

  const messages = await Message.findAll({
    where: { conversation_id: conversationId },
    include: [
      {
        model: User,
        as: 'sender',
        attributes: ['id', 'email'],
        include: [{ model: Profile, as: 'profile' }],
      },
    ],
    order: [['createdAt', 'ASC']],
  });

  return res.json({ success: true, messages });
};

exports.sendMessage = async (req, res) => {
  let { conversation_id, receiver_id, message_text } = req.body;
  const file = req.file;

  if (!conversation_id) {
    return res.status(400).json({ success: false, message: 'Conversation ID is required.' });
  }

  const conversation = await Conversation.findByPk(conversation_id);
  if (!conversation) {
    return res.status(404).json({ success: false, message: 'Conversation not found.' });
  }

  if (!receiver_id) {
    receiver_id = conversation.participant1_id === req.user.id ? conversation.participant2_id : conversation.participant1_id;
  }

  if (!message_text && !file) {
    return res.status(400).json({ success: false, message: 'Message text or attachment required.' });
  }

  const attachmentUrl = file ? `/uploads/${file.filename}` : null;

  const message = await Message.create({
    conversation_id,
    sender_id: req.user.id,
    receiver_id,
    message_text: message_text || 'Sent an attachment.',
    attachment_url: attachmentUrl,
    is_read: false,
  });

  await conversation.update({
    last_message: message_text || 'Sent an attachment.',
    last_message_at: new Date(),
  });

  return res.status(201).json({ success: true, message });
};
