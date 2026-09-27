const jwt = require('jsonwebtoken');
const { User, Profile } = require('../models');

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'resqlink_access_secret_dev_2026';

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET);

    const user = await User.findByPk(decoded.id, {
      include: [{ model: Profile, as: 'profile' }]
    });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Account disabled or user no longer exists.' });
    }

    if (user.account_status === 'BLOCKED' || !user.is_active) {
      return res.status(403).json({ success: false, message: 'Account permanently blocked by administration due to policy violations.' });
    }

    if (user.account_status === 'SUSPENDED') {
      if (user.suspension_ends_at && new Date(user.suspension_ends_at) > new Date()) {
        return res.status(403).json({
          success: false,
          message: `Account suspended until ${new Date(user.suspension_ends_at).toLocaleString()}`,
          suspension_ends_at: user.suspension_ends_at,
        });
      } else {
        // Auto-lift expired suspension
        await user.update({ account_status: 'ACTIVE', suspension_ends_at: null });
      }
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Access token expired', tokenExpired: true });
    }
    return res.status(401).json({ success: false, message: 'Invalid authentication token.' });
  }
};

module.exports = authenticate;
