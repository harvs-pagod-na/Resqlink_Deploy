const { PublicAlert, User } = require('../models');
const { Op } = require('sequelize');
const { getAdminJurisdiction } = require('../utils/jurisdiction');

// 1. Create and Broadcast Real Public Alert (MDRRMO)
exports.createPublicAlert = async (req, res) => {
  try {
    const {
      title,
      message,
      severity,
      alert_type,
      target_barangay,
      target_municipality,
      expires_at,
    } = req.body;

    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Title and message are required.' });
    }

    const assignedJurisdiction = getAdminJurisdiction(req.user);
    const isSuper = assignedJurisdiction === 'all';

    const authorName = isSuper ? 'Provincial Command' : `MDRRMO ${assignedJurisdiction} Command Center`;
    const municipality = isSuper ? (target_municipality || 'All Municipalities') : assignedJurisdiction;

    const alert = await PublicAlert.create({
      title,
      message,
      severity: severity || 'High',
      alert_type: alert_type || 'General Announcement',
      target_barangay: target_barangay || `All ${municipality}`,
      target_municipality: municipality,
      author_id: req.user.id,
      author_name: authorName,
      is_active: true,
      published_at: new Date(),
      expires_at: expires_at || null,
    });

    // Real-time broadcast to all connected citizens and responders via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.emit('alert:broadcast', alert);
      io.emit('new_public_alert', alert);
    }

    return res.status(201).json({
      success: true,
      message: 'Public Emergency Alert broadcasted successfully to all residents!',
      alert,
    });
  } catch (error) {
    console.error('[CREATE ALERT ERROR]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Get All Active Public Alerts (Public / Citizen Feed)
exports.getActiveAlerts = async (req, res) => {
  try {
    const { barangay, municipality } = req.query;
    const whereClause = { is_active: true };

    const alerts = await PublicAlert.findAll({
      where: whereClause,
      order: [['published_at', 'DESC']],
      limit: 25,
    });

    return res.json({
      success: true,
      alerts,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 3. Admin Get All Alerts (Active & Inactive)
exports.getAllAlerts = async (req, res) => {
  try {
    const assignedJurisdiction = getAdminJurisdiction(req.user);
    const whereClause = {};

    if (assignedJurisdiction !== 'all') {
      whereClause[Op.or] = [
        { target_municipality: assignedJurisdiction },
        { target_municipality: 'All Municipalities' },
        { target_municipality: 'All Towns' },
        { target_municipality: 'Provincial' }
      ];
    }

    const alerts = await PublicAlert.findAll({
      where: whereClause,
      order: [['published_at', 'DESC']],
      limit: 100,
    });

    return res.json({
      success: true,
      alerts,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 4. Toggle or Deactivate Alert
exports.toggleAlertStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const alert = await PublicAlert.findByPk(id);

    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }

    const assignedJurisdiction = getAdminJurisdiction(req.user);
    if (assignedJurisdiction !== 'all' && alert.target_municipality !== assignedJurisdiction && alert.author_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized: Cannot modify alerts outside your assigned municipality.' });
    }

    alert.is_active = !alert.is_active;
    await alert.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('alert:status_change', alert);
    }

    return res.json({
      success: true,
      message: `Alert is now ${alert.is_active ? 'ACTIVE' : 'DEACTIVATED'}`,
      alert,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 5. Delete Alert
exports.deleteAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const alert = await PublicAlert.findByPk(id);

    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }

    const assignedJurisdiction = getAdminJurisdiction(req.user);
    if (assignedJurisdiction !== 'all' && alert.target_municipality !== assignedJurisdiction && alert.author_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized: Cannot delete alerts outside your assigned municipality.' });
    }

    await alert.destroy();

    const io = req.app.get('io');
    if (io) {
      io.emit('alert:deleted', { id: parseInt(id, 10) });
    }

    return res.json({
      success: true,
      message: 'Alert deleted successfully.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
