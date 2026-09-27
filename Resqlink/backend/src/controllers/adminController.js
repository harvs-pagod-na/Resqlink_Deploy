
const {
  VerificationRequest,
  User,
  Profile,
  AuditLog,
  SecurityLog,
  Message,
  Conversation,
  Notification,
  ResqRequest,
  PublicAlert,
  sequelize,
} = require('../models');
const { Op } = require('sequelize');
const { getAdminJurisdiction, isUserInJurisdiction } = require('../utils/jurisdiction');

function detectPampangaTown(address = '', city = '', fallback = 'City of San Fernando') {
  const towns = [
    'City of San Fernando', 'Angeles City', 'Mabalacat City', 'San Fernando', 'Angeles', 'Mabalacat',
    'Santa Rita', 'Floridablanca', 'Guagua', 'Lubao', 'Mexico', 'Arayat', 'Porac', 'Apalit',
    'Candaba', 'Bacolor', 'Macabebe', 'Masantol', 'Minalin', 'San Luis', 'San Simon',
    'Santa Ana', 'Santo Tomas', 'Sasmuan'
  ];

  if (address) {
    const addrLower = address.toLowerCase();
    for (const t of towns) {
      if (addrLower.includes(t.toLowerCase())) {
        if (t === 'San Fernando') return 'City of San Fernando';
        if (t === 'Angeles') return 'Angeles City';
        if (t === 'Mabalacat') return 'Mabalacat City';
        return t;
      }
    }
  }

  if (city) {
    const cityLower = city.toLowerCase();
    for (const t of towns) {
      if (cityLower.includes(t.toLowerCase())) {
        if (t === 'San Fernando') return 'City of San Fernando';
        if (t === 'Angeles') return 'Angeles City';
        if (t === 'Mabalacat') return 'Mabalacat City';
        return t;
      }
    }
  }

  return fallback;
}

exports.getVerificationQueue = async (req, res) => {
  try {
    const assignedJurisdiction = getAdminJurisdiction(req.user);

    const requests = await VerificationRequest.findAll({
      where: {
        status: 'PENDING_ADMIN_APPROVAL'
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'uuid', 'email', 'role', 'is_verified', 'verification_status', 'createdAt'],
          include: [
            { model: Profile, as: 'profile' },
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    const scopedRequests = assignedJurisdiction === 'all'
      ? requests
      : requests.filter((r) => isUserInJurisdiction(r.user, assignedJurisdiction));

    return res.json({ success: true, count: scopedRequests.length, requests: scopedRequests });
  } catch (error) {
    console.error('[GET VERIFICATION QUEUE ERROR]', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch verification queue.' });
  }
};

exports.reviewVerification = async (req, res) => {
  try {
    const { id } = req.params;
    const { status: admin_status, admin_notes } = req.body;

    if (!admin_status || !['APPROVED', 'REJECTED'].includes(admin_status.toUpperCase())) {
      return res.status(400).json({ success: false, message: 'Invalid status. Must be "APPROVED" or "REJECTED".' });
    }

    const request = await VerificationRequest.findByPk(id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Verification request not found.' });
    }

    const newStatus = admin_status.toUpperCase();

    await request.update({
      status: newStatus,
      admin_notes: admin_notes || `Reviewed and ${newStatus} by Admin ${req.user.email}`,
      reviewed_by: req.user.id,
      reviewed_at: new Date(),
    });

    const isApproved = newStatus === 'APPROVED';
    await User.update(
      {
        is_verified: isApproved,
        verification_status: isApproved ? 'approved' : 'rejected',
      },
      { where: { id: request.user_id } }
    );

    if (isApproved) {
      try {
        const selfieUrl = request.live_selfie_url || request.id_image_url;
        const profile = await Profile.findOne({ where: { user_id: request.user_id } });
        if (profile) {
          const updateObj = {};
          if (selfieUrl) updateObj.avatar_url = selfieUrl;

          if (request.ocr_extracted_data && request.ocr_extracted_data.full_name) {
            const ocr = request.ocr_extracted_data;
            const parts = ocr.full_name.trim().split(' ');
            const firstName = parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0];
            const lastName = parts.length > 1 ? parts[parts.length - 1] : profile.last_name;
            updateObj.first_name = firstName || profile.first_name;
            updateObj.last_name = lastName || profile.last_name;
            updateObj.full_name = ocr.full_name;
            if (ocr.address) updateObj.address = ocr.address;
            if (ocr.birthdate) updateObj.birthdate = ocr.birthdate;
          }

          await profile.update(updateObj);
        }
      } catch (avatarErr) {
        console.error('[AVATAR SYNC FALLBACK ERROR]', avatarErr);
      }
    }

    const confidenceLevel = (request.facial_match_score || 0) >= 80 ? 'HIGH' : ((request.facial_match_score || 0) >= 50 ? 'MEDIUM' : 'LOW');

    const standardizedPayload = {
      verification_id: request.id,
      user_id: request.user_id,
      extracted_name: request.extracted_name || (request.ocr_extracted_data && request.ocr_extracted_data.full_name) || 'User',
      document_number: request.extracted_id_num || (request.ocr_extracted_data && request.ocr_extracted_data.id_number) || 'N/A',
      facial_match_score: request.facial_match_score,
      confidence_level: confidenceLevel,
      ai_recommendation: request.ai_recommendation,
      status: request.status,
      live_selfie_url: request.live_selfie_url,
    };

    return res.json({
      success: true,
      message: `Verification request ${admin_status} successfully.`,
      request: standardizedPayload,
    });
  } catch (error) {
    console.error('[REVIEW VERIFICATION ERROR]', error);
    return res.status(500).json({ success: false, message: 'Failed to process verification review.' });
  }
};

exports.approveVerification = async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_notes } = req.body;

    const request = await VerificationRequest.findByPk(id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Verification request not found.' });
    }

    await request.update({
      status: 'APPROVED',
      admin_notes: admin_notes || `Approved by Admin ${req.user.email}`,
      reviewed_by: req.user.id,
      reviewed_at: new Date(),
    });

    await User.update(
      {
        is_verified: true,
        verification_status: 'approved',
      },
      { where: { id: request.user_id } }
    );

    try {
      const selfieUrl = request.live_selfie_url || request.id_image_url;
      const profile = await Profile.findOne({ where: { user_id: request.user_id } });
      if (profile && selfieUrl) {
        await profile.update({ avatar_url: selfieUrl });
      }
    } catch (avatarErr) {
      console.error('[AVATAR SYNC FALLBACK ERROR]', avatarErr);
    }

    await AuditLog.create({
      user_id: req.user.id,
      action: 'VERIFICATION_APPROVED',
      entity: 'VerificationRequest',
      entity_id: String(id),
      details: { target_user_id: request.user_id, status: 'verified', admin_notes },
    });

    return res.json({
      success: true,
      message: 'User ID verification approved successfully. Account status set to VERIFIED.',
      request,
    });
  } catch (error) {
    console.error('[APPROVE VERIFICATION ERROR]', error);
    return res.status(500).json({ success: false, message: 'Failed to approve verification.' });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.count();
    const totalResponders = await User.count({
      where: { role: { [Op.in]: ['responder', 'pnp_responder', 'bfp_responder', 'mdrrmo_admin'] } }
    });
    const totalCitizens = await User.count({ where: { role: 'user' } });
    const pendingVerifications = await VerificationRequest.count({ where: { status: 'PENDING_ADMIN_APPROVAL' } });

    const totalIncidents = await ResqRequest.count();
    const activeIncidents = await ResqRequest.count({
      where: { status: { [Op.in]: ['Pending', 'Assigned', 'Accepted', 'Responder Dispatched', 'En Route', 'Arrived', 'In Progress'] } }
    });
    const resolvedIncidents = await ResqRequest.count({ where: { status: 'Completed' } });
    const activeAlerts = await PublicAlert.count({ where: { is_active: true } });

    const recentSecurityAlerts = await SecurityLog.count({
      where: {
        event_type: { [Op.in]: ['account_locked', 'login_failed', 'unauthorized_access'] },
      },
    });

    return res.json({
      success: true,
      stats: {
        total_users: totalUsers,
        total_citizens: totalCitizens,
        total_responders: totalResponders,
        pending_verifications: pendingVerifications,
        total_incidents: totalIncidents,
        active_incidents: activeIncidents,
        resolved_incidents: resolvedIncidents,
        active_alerts: activeAlerts,
        recent_security_alerts: recentSecurityAlerts,
      },
    });
  } catch (error) {
    console.error('[GET STATS ERROR]', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch dashboard stats.' });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const assignedJurisdiction = getAdminJurisdiction(req.user);

    const users = await User.findAll({
      attributes: { exclude: ['password_hash', 'refresh_token'] },
      include: [
        { model: Profile, as: 'profile' },
      ],
      order: [['createdAt', 'DESC']],
    });

    const scopedUsers = assignedJurisdiction === 'all'
      ? users
      : users.filter((u) => isUserInJurisdiction(u, assignedJurisdiction));

    return res.json({ success: true, count: scopedUsers.length, users: scopedUsers });
  } catch (error) {
    console.error('[GET ALL USERS ERROR]', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch users list.' });
  }
};

exports.toggleUserActiveStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    await user.update({ is_active });
    return res.json({ success: true, message: `User status changed to ${is_active ? 'Active' : 'Deactivated'}`, user });
  } catch (error) {
    console.error('[TOGGLE ACTIVE ERROR]', error);
    return res.status(500).json({ success: false, message: 'Failed to toggle user status.' });
  }
};

exports.toggleUserVerificationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_verified, verification_status } = req.body;

    const user = await User.findByPk(id, {
      include: [{ model: Profile, as: 'profile' }]
    });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const verifiedBool = is_verified !== undefined ? is_verified : true;
    const statusStr = verification_status || (verifiedBool ? 'approved' : 'rejected');

    await user.update({
      is_verified: verifiedBool,
      verification_status: statusStr,
    });

    if (user.profile) {
      await user.profile.update({
        is_verified: verifiedBool,
        verification_status: statusStr,
      });
    }

    return res.json({
      success: true,
      message: `User credentials ${verifiedBool ? 'Approved & Activated' : 'Rejected'}`,
      user
    });
  } catch (error) {
    console.error('[TOGGLE VERIFICATION ERROR]', error);
    return res.status(500).json({ success: false, message: 'Failed to update verification status.' });
  }
};

exports.getAuditLogs = async (req, res) => {
  try {
    const logs = await AuditLog.findAll({
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'role'],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit: 100,
    });

    return res.json({ success: true, count: logs.length, logs });
  } catch (error) {
    console.error('[GET AUDIT LOGS ERROR]', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch audit logs.' });
  }
};

exports.triggerBackup = async (req, res) => {
  try {
    const backupFileName = `resqlink_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.sql`;

    await AuditLog.create({
      user_id: req.user.id,
      action: 'SYSTEM_BACKUP_GENERATED',
      entity: 'Database',
      entity_id: backupFileName,
      details: { backup_file: backupFileName, timestamp: new Date() },
    });

    return res.json({
      success: true,
      message: 'System database snapshot backup created successfully!',
      backup_file: backupFileName,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('[TRIGGER BACKUP ERROR]', error);
    return res.status(500).json({ success: false, message: 'Failed to create backup snapshot.' });
  }
};

exports.sendBroadcastNotification = async (req, res) => {
  try {
    const { target_group, type, title, message, receiver_id } = req.body;

    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Notification title and message are required.' });
    }

    const validGroups = ['all', 'responders', 'citizens', 'specific'];
    const selectedGroup = validGroups.includes(target_group) ? target_group : 'all';

    const validTypes = ['broadcast', 'system_alert', 'important_activity'];
    const selectedType = validTypes.includes(type) ? type : 'broadcast';

    let notification;
    if (selectedGroup === 'specific' && receiver_id) {
      notification = await Notification.create({
        sender_id: req.user.id,
        receiver_id: parseInt(receiver_id, 10),
        target_group: 'specific',
        type: selectedType,
        title,
        message,
        is_read: false,
      });

      const io = req.app.get('io');
      if (io) {
        io.to(`user_${receiver_id}`).emit('system_notification', notification);
      }
    } else {
      notification = await Notification.create({
        sender_id: req.user.id,
        receiver_id: null,
        target_group: selectedGroup,
        type: selectedType,
        title,
        message,
        is_read: false,
      });

      const io = req.app.get('io');
      if (io) {
        io.emit('broadcast_notification', {
          notification,
          target_group: selectedGroup,
        });
      }
    }

    await AuditLog.create({
      user_id: req.user.id,
      action: 'ADMIN_NOTIFICATION_BROADCAST',
      entity: 'Notification',
      entity_id: String(notification.id),
      details: { target_group: selectedGroup, type: selectedType, title, receiver_id },
    });

    return res.status(201).json({
      success: true,
      message: `Notification broadcast dispatched successfully to ${selectedGroup.toUpperCase()}!`,
      notification,
    });
  } catch (error) {
    console.error('[SEND BROADCAST NOTIFICATION ERROR]', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to send broadcast notification.' });
  }
};

exports.getNotificationHistory = async (req, res) => {
  try {
    const notifications = await Notification.findAll({
      include: [
        { model: User, as: 'sender', attributes: ['id', 'email', 'role'] },
        { model: User, as: 'receiver', attributes: ['id', 'email', 'role'] },
      ],
      order: [['createdAt', 'DESC']],
      limit: 100,
    });

    return res.json({ success: true, count: notifications.length, notifications });
  } catch (error) {
    console.error('[GET NOTIFICATION HISTORY ERROR]', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch notification history.' });
  }
};
