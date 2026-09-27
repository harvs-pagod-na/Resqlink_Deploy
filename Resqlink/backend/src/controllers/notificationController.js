const { Notification, User } = require('../models');
const { Op } = require('sequelize');

// Get current user's notifications (direct + broadcast)
exports.getUserNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role; // 'user', 'responder', 'admin', 'sub_admin'

    const targetGroupCondition = ['all'];
    if (['responder', 'pnp_responder', 'bfp_responder'].includes(userRole)) targetGroupCondition.push('responders');
    if (userRole === 'user') targetGroupCondition.push('citizens');

    const notifications = await Notification.findAll({
      where: {
        [Op.or]: [
          { receiver_id: userId },
          { target_group: { [Op.in]: targetGroupCondition } }
        ]
      },
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'email', 'role']
        },
      ],
      order: [['createdAt', 'DESC']],
      limit: 50
    });

    return res.json({ success: true, count: notifications.length, notifications });
  } catch (error) {
    console.error('[GET NOTIFICATIONS ERROR]', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch notifications.' });
  }
};

// Get unread notification count
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    const targetGroupCondition = ['all'];
    if (['responder', 'pnp_responder', 'bfp_responder'].includes(userRole)) targetGroupCondition.push('responders');
    if (userRole === 'user') targetGroupCondition.push('citizens');

    const unreadCount = await Notification.count({
      where: {
        is_read: false,
        [Op.or]: [
          { receiver_id: userId },
          { target_group: { [Op.in]: targetGroupCondition } }
        ]
      }
    });

    return res.json({ success: true, unread_count: unreadCount });
  } catch (error) {
    console.error('[GET UNREAD COUNT ERROR]', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch unread notification count.' });
  }
};

// Mark single notification as read
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findByPk(id);

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }

    await notification.update({ is_read: true });
    return res.json({ success: true, message: 'Notification marked as read.', notification });
  } catch (error) {
    console.error('[MARK READ ERROR]', error);
    return res.status(500).json({ success: false, message: 'Failed to mark notification as read.' });
  }
};

// Mark all user notifications as read
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    const targetGroupCondition = ['all'];
    if (['responder', 'pnp_responder', 'bfp_responder'].includes(userRole)) targetGroupCondition.push('responders');
    if (userRole === 'user') targetGroupCondition.push('citizens');

    await Notification.update(
      { is_read: true },
      {
        where: {
          is_read: false,
          [Op.or]: [
            { receiver_id: userId },
            { target_group: { [Op.in]: targetGroupCondition } }
          ]
        }
      }
    );

    return res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (error) {
    console.error('[MARK ALL READ ERROR]', error);
    return res.status(500).json({ success: false, message: 'Failed to mark all notifications as read.' });
  }
};
