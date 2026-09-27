const { ResqRequest, User, Profile, Notification, IncidentTrackingLog, sequelize } = require('../models');
const { generatePresignedUploadUrl } = require('../services/s3Service');
const { getAdminJurisdiction } = require('../utils/jurisdiction');
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');

// Safe Redis helper to prevent crashes if Redis is offline
let redisClient = null;
let redisPublisher = null;
try {
  const redisConfig = require('../config/redis');
  redisClient = redisConfig.redisClient;
  redisPublisher = redisConfig.redisPublisher;
} catch (e) {
  // Redis optional fallback
}

// 0. Direct Multipart Incident Photo Upload
exports.uploadIncidentPhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No photo file provided' });
    }
    const publicUrl = `/uploads/incidents/${req.file.filename}`;
    return res.status(200).json({
      success: true,
      message: 'Photo uploaded successfully',
      data: {
        publicUrl,
        filename: req.file.filename,
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// 1. Get Pre-Signed Direct Upload URL
exports.getUploadUrl = async (req, res) => {
  try {
    const { mime_type, extension } = req.query;
    if (!mime_type) {
      return res.status(400).json({ success: false, message: 'mime_type is required' });
    }

    const presignedData = await generatePresignedUploadUrl(
      req.user.id,
      mime_type,
      extension || 'jpg'
    );

    return res.json({
      success: true,
      data: presignedData,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// Direct Edge Media Ingestion Handler
exports.handleDirectUpload = async (req, res) => {
  try {
    const { key } = req.params;
    const uploadDir = path.join(__dirname, '../../uploads', path.dirname(key));
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(__dirname, '../../uploads', key);
    const writeStream = fs.createWriteStream(filePath);
    req.pipe(writeStream);

    writeStream.on('finish', () => {
      res.status(200).json({ success: true, message: 'File uploaded successfully', key });
    });

    writeStream.on('error', (err) => {
      res.status(500).json({ success: false, message: err.message });
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 2. Submit Emergency Rescue Request (RESQ)
exports.createResqRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId, {
      include: [{ model: Profile, as: 'profile' }],
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const {
      emergency_type,
      severity_level,
      description,
      latitude,
      longitude,
      address_location,
      municipality,
      barangay,
      landmark,
      photo_url,
      contact_number,
      target_agency,
    } = req.body;

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(422).json({
        success: false,
        message: 'Valid GPS coordinates are required.',
      });
    }

    // Tri-Municipality Auto-Detection for Porac, Santa Rita, and Guagua
    let validTown = municipality;
    if (!validTown || !['Porac', 'Santa Rita', 'Guagua'].includes(validTown)) {
      if (user.profile?.city && ['Porac', 'Santa Rita', 'Guagua'].includes(user.profile.city)) {
        validTown = user.profile.city;
      } else {
        // Approximate geofencing based on latitude
        if (lat >= 15.035) validTown = 'Porac';
        else if (lat >= 14.985) validTown = 'Santa Rita';
        else validTown = 'Guagua';
      }
    }
    const reporterFullName = user.profile ? `${user.profile.first_name || ''} ${user.profile.last_name || ''}`.trim() : user.email;

    // Automatic target agency rule based on emergency type
    let determinedAgency = target_agency || 'MDRRMO';
    if (!target_agency) {
      if (emergency_type === 'Fire') determinedAgency = 'BFP';
      else if (emergency_type === 'Crime/Police') determinedAgency = 'PNP';
      else if (emergency_type === 'Flood/Disaster' || emergency_type === 'Medical' || emergency_type === 'Accident') determinedAgency = 'MDRRMO';
    }

    // Ensure valid enums and string lengths to prevent MySQL schema errors
    const VALID_TYPES = ['Fire', 'Crime/Police', 'Medical', 'Flood/Disaster', 'Accident', 'Evacuation', 'Other'];
    const safeType = VALID_TYPES.includes(emergency_type) ? emergency_type : 'Medical';

    const VALID_SEVERITIES = ['Critical', 'High', 'Moderate', 'Low'];
    const safeSeverity = VALID_SEVERITIES.includes(severity_level) ? severity_level : 'High';

    const VALID_AGENCIES = ['MDRRMO', 'PNP', 'BFP', 'Multi-Agency', 'Unassigned'];
    const safeAgency = VALID_AGENCIES.includes(determinedAgency) ? determinedAgency : 'MDRRMO';

    const resq = await ResqRequest.create({
      user_id: userId,
      reporter_name: (reporterFullName || 'Citizen').slice(0, 150),
      contact_number: (contact_number || user.phone_number || '').slice(0, 25),
      emergency_type: safeType,
      severity_level: safeSeverity,
      description: description || '',
      latitude: lat,
      longitude: lng,
      municipality: validTown,
      barangay: (barangay || user.profile?.barangay || 'Poblacion').slice(0, 100),
      address_location: (address_location || `[${validTown}] ${barangay || 'Incident Location'}`).slice(0, 255),
      landmark: landmark ? landmark.slice(0, 200) : null,
      photo_url: photo_url ? photo_url.slice(0, 255) : null,
      target_agency: safeAgency,
      status: 'Pending',
      reported_at: new Date(),
    });

    // Record initial tracking log (protected in try/catch to ensure primary dispatch never fails)
    try {
      await IncidentTrackingLog.create({
        incident_id: resq.id,
        actor_id: userId,
        actor_name: (reporterFullName || 'Citizen').slice(0, 100),
        actor_role: (req.user?.role || 'citizen').slice(0, 50),
        previous_status: null,
        new_status: 'Pending',
        notes: `Incident reported: ${safeType} in ${barangay || validTown}`,
        latitude: lat,
        longitude: lng,
      });
    } catch (logErr) {
      console.warn('[IncidentTrackingLog Non-Fatal Warning]:', logErr.message);
    }

    const fullRequest = await ResqRequest.findByPk(resq.id, {
      include: [
        {
          model: User,
          as: 'requester',
          attributes: ['id', 'email', 'phone_number', 'is_verified', 'verification_status'],
          include: [{ model: Profile, as: 'profile' }],
        },
        {
          model: IncidentTrackingLog,
          as: 'tracking_logs',
        },
      ],
    });

    // Broadcast live over Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.emit('new_rescue_request', fullRequest);
      io.emit('emergency:new', fullRequest);
      io.to('role_admin').emit('new_rescue_request', fullRequest);
      io.to('role_sub_admin').emit('new_rescue_request', fullRequest);
      io.to('role_mdrrmo_admin').emit('emergency:new', fullRequest);
      io.to('role_pnp_responder').emit('emergency:new', fullRequest);
      io.to('role_bfp_responder').emit('emergency:new', fullRequest);
    }

    return res.status(201).json({
      success: true,
      message: 'Emergency incident submitted successfully! Dispatch center alerted.',
      request: fullRequest,
    });
  } catch (error) {
    console.error('[CREATE RESQ ERROR]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 3. Get Logged-in User's RESQ Requests
exports.getMyResqRequests = async (req, res) => {
  try {
    const userId = req.user.id;

    const requests = await ResqRequest.findAll({
      where: { user_id: userId },
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: User,
          as: 'assigned_responder',
          attributes: ['id', 'email', 'phone_number', 'role', 'agency'],
        },
        {
          model: User,
          as: 'assigned_subadmin',
          attributes: ['id', 'email', 'phone_number', 'role'],
          include: [{ model: Profile, as: 'profile' }],
        },
        {
          model: IncidentTrackingLog,
          as: 'tracking_logs',
        },
      ],
    });

    const activeRequest = requests.find((r) =>
      ['Pending', 'Assigned', 'Accepted', 'Validated', 'Responder Dispatched', 'Dispatched', 'En Route', 'On Scene', 'Arrived', 'In Progress'].includes(r.status)
    ) || null;

    return res.json({
      success: true,
      requests,
      active_request: activeRequest,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 4. Get Active Rescue Request for User
exports.getActiveResqRequest = async (req, res) => {
  try {
    const userId = req.user.id;

    const activeRequest = await ResqRequest.findOne({
      where: {
        user_id: userId,
        status: {
          [Op.in]: ['Pending', 'Assigned', 'Accepted', 'Validated', 'Responder Dispatched', 'Dispatched', 'En Route', 'On Scene', 'Arrived', 'In Progress'],
        },
      },
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: User,
          as: 'assigned_responder',
          attributes: ['id', 'email', 'phone_number', 'role', 'agency'],
        },
        {
          model: User,
          as: 'assigned_subadmin',
          attributes: ['id', 'email', 'phone_number', 'role'],
          include: [{ model: Profile, as: 'profile' }],
        },
        {
          model: IncidentTrackingLog,
          as: 'tracking_logs',
        },
      ],
    });

    return res.json({
      success: true,
      active_request: activeRequest,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 4.1 Get Active Incident for Field Responder (Strict Privacy: Only Assigned Incident)
exports.getResponderActiveIncident = async (req, res) => {
  try {
    const userId = req.user.id;
    const activeIncident = await ResqRequest.findOne({
      where: {
        assigned_responder_id: userId,
        status: {
          [Op.in]: ['Assigned', 'Accepted', 'Responder Dispatched', 'Dispatched', 'En Route', 'Arrived', 'On Scene']
        }
      },
      order: [['updatedAt', 'DESC']],
      include: [
        {
          model: User,
          as: 'requester',
          attributes: ['id', 'email', 'phone_number', 'is_verified', 'verification_status'],
          include: [{ model: Profile, as: 'profile' }],
        },
        {
          model: IncidentTrackingLog,
          as: 'tracking_logs',
        },
      ],
    });

    return res.json({
      success: true,
      active_incident: activeIncident,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 5. Admin / Sub-Admin / Responders Get All Emergency Requests
exports.getAllResqRequests = async (req, res) => {
  try {
    const { status, emergency_type, target_agency, municipality } = req.query;
    const whereClause = {};

    if (status && status !== 'all') {
      whereClause.status = status;
    }
    if (emergency_type && emergency_type !== 'all') {
      whereClause.emergency_type = emergency_type;
    }
    if (target_agency && target_agency !== 'all') {
      whereClause.target_agency = target_agency;
    }

    // Enforce municipal jurisdiction: local admins only access their assigned municipality
    const assignedJurisdiction = getAdminJurisdiction(req.user);
    if (assignedJurisdiction !== 'all') {
      whereClause.municipality = assignedJurisdiction;
    } else if (municipality && municipality !== 'all') {
      whereClause.municipality = municipality;
    }

    const requests = await ResqRequest.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: User,
          as: 'requester',
          attributes: ['id', 'email', 'phone_number', 'is_verified', 'verification_status'],
          include: [{ model: Profile, as: 'profile' }],
        },
        {
          model: User,
          as: 'assigned_responder',
          attributes: ['id', 'email', 'phone_number', 'role', 'agency'],
        },
        {
          model: User,
          as: 'assigned_subadmin',
          attributes: ['id', 'email', 'phone_number', 'role'],
          include: [{ model: Profile, as: 'profile' }],
        },
        {
          model: IncidentTrackingLog,
          as: 'tracking_logs',
        },
      ],
    });

    const counts = {
      pending: requests.filter((r) => r.status === 'Pending').length,
      validated: requests.filter((r) => r.status === 'Validated' || r.status === 'Accepted').length,
      active: requests.filter((r) =>
        ['Accepted', 'Responder Dispatched', 'Dispatched', 'En Route', 'On Scene', 'Arrived', 'In Progress'].includes(r.status)
      ).length,
      resolved: requests.filter((r) => ['Resolved', 'Completed', 'Closed'].includes(r.status)).length,
      cancelled: requests.filter((r) => r.status === 'Cancelled').length,
      total: requests.length,
    };

    return res.json({
      success: true,
      requests,
      counts,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 6. Assign Emergency to Department & Responder
exports.assignResponder = async (req, res) => {
  const { id } = req.params;
  const actorId = req.user.id;
  const actorRole = req.user.role;

  try {
    const {
      assigned_department,
      assigned_responder_id,
      responder_name,
      responder_phone,
      responder_unit,
      dispatcher_notes,
    } = req.body;

    const resq = await ResqRequest.findByPk(id);
    if (!resq) {
      return res.status(404).json({ success: false, message: 'Emergency request not found' });
    }

    const assignedJurisdiction = getAdminJurisdiction(req.user);
    if (assignedJurisdiction !== 'all') {
      const incidentTown = resq.municipality || resq.hub;
      if (incidentTown && incidentTown !== assignedJurisdiction) {
        return res.status(403).json({ success: false, message: `Unauthorized: This incident belongs to ${incidentTown} jurisdiction.` });
      }
    }

    const previousStatus = resq.status;
    resq.status = 'Assigned';
    if (assigned_department) resq.assigned_department = assigned_department;
    if (assigned_department) {
      resq.target_agency = assigned_department === 'Medical' ? 'MDRRMO' : assigned_department === 'Police' ? 'PNP' : assigned_department === 'Fire' ? 'BFP' : 'MDRRMO';
    }
    if (assigned_responder_id) resq.assigned_responder_id = assigned_responder_id;
    if (responder_name) resq.responder_name = responder_name;
    if (responder_phone) resq.responder_phone = responder_phone;
    if (responder_unit) resq.responder_unit = responder_unit;
    if (dispatcher_notes) resq.dispatcher_notes = dispatcher_notes;

    await resq.save();

    await IncidentTrackingLog.create({
      incident_id: resq.id,
      actor_id: actorId,
      actor_name: `${actorRole || 'Admin'} (#${actorId})`,
      actor_role: actorRole,
      previous_status: previousStatus,
      new_status: 'Assigned',
      notes: `Assigned to ${resq.responder_name || 'Responder Unit'} (${resq.assigned_department || 'Rescue Services'}). Awaiting responder acceptance.`,
      latitude: resq.latitude,
      longitude: resq.longitude,
    });

    const updatedFull = await ResqRequest.findByPk(id, {
      include: [
        {
          model: User,
          as: 'requester',
          attributes: ['id', 'email', 'phone_number', 'is_verified', 'verification_status'],
          include: [{ model: Profile, as: 'profile' }],
        },
        {
          model: User,
          as: 'assigned_responder',
          attributes: ['id', 'email', 'phone_number', 'role', 'agency'],
          include: [{ model: Profile, as: 'profile' }],
        },
        {
          model: IncidentTrackingLog,
          as: 'tracking_logs',
        },
      ],
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('update_rescue_status', updatedFull);
      io.emit('emergency:status_change', updatedFull);
      if (resq.assigned_responder_id) {
        io.to(`user_${resq.assigned_responder_id}`).emit('new_assignment_alert', updatedFull);
        io.to(`user_${resq.assigned_responder_id}`).emit('new_rescue_request', updatedFull);
      }
      io.to(`user_${resq.user_id}`).emit('update_rescue_status', updatedFull);
    }

    return res.json({
      success: true,
      message: `Emergency #${resq.id} assigned to ${resq.responder_name || 'Responder'}. Awaiting acceptance.`,
      request: updatedFull,
    });
  } catch (error) {
    console.error('[ASSIGN RESPONDER ERROR]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 6.1 Responder Accepts Assigned Emergency
exports.acceptResqRequest = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    const resq = await ResqRequest.findByPk(id);
    if (!resq) {
      return res.status(404).json({ success: false, message: 'Emergency request not found' });
    }

    const previousStatus = resq.status;
    resq.status = 'Accepted';
    resq.validated_at = new Date();
    resq.is_verified_incident = true;
    await resq.save();

    await IncidentTrackingLog.create({
      incident_id: resq.id,
      actor_id: userId,
      actor_name: resq.responder_name || `${userRole} (#${userId})`,
      actor_role: userRole,
      previous_status: previousStatus,
      new_status: 'Accepted',
      notes: `Responder accepted emergency assignment. Ready for dispatch order.`,
      latitude: resq.responder_lat || resq.latitude,
      longitude: resq.responder_lng || resq.longitude,
    });

    const updatedFull = await ResqRequest.findByPk(id, {
      include: [
        {
          model: User,
          as: 'requester',
          attributes: ['id', 'email', 'phone_number', 'is_verified', 'verification_status'],
          include: [{ model: Profile, as: 'profile' }],
        },
        {
          model: User,
          as: 'assigned_responder',
          attributes: ['id', 'email', 'phone_number', 'role', 'agency'],
          include: [{ model: Profile, as: 'profile' }],
        },
        {
          model: IncidentTrackingLog,
          as: 'tracking_logs',
        },
      ],
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('update_rescue_status', updatedFull);
      io.emit('emergency:status_change', updatedFull);
      io.emit('responder_accepted_assignment', {
        incidentId: resq.id,
        responderId: userId,
        responderName: resq.responder_name,
        request: updatedFull,
      });
      io.to(`user_${resq.user_id}`).emit('update_rescue_status', updatedFull);
      io.to('role_admin').emit('responder_accepted_assignment', {
        incidentId: resq.id,
        responderName: resq.responder_name,
        request: updatedFull,
      });
      io.to('role_sub_admin').emit('responder_accepted_assignment', {
        incidentId: resq.id,
        responderName: resq.responder_name,
        request: updatedFull,
      });
    }

    return res.json({
      success: true,
      message: `Emergency #${resq.id} accepted! Dispatch Command notified.`,
      request: updatedFull,
    });
  } catch (error) {
    console.error('[ACCEPT RESQ ERROR]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 6.2 Validate & Dispatch Emergency Incident with Granular Milestones
exports.dispatchResqRequest = async (req, res) => {
  const { id } = req.params;
  const actorId = req.user.id;
  const actorRole = req.user.role;

  try {
    const {
      status,
      target_agency,
      assigned_agency,
      assigned_department,
      assigned_responder_id,
      assigned_subadmin_id,
      assigned_sector,
      subadmin_notes,
      responder_name,
      responder_phone,
      responder_unit,
      responder_lat,
      responder_lng,
      dispatcher_notes,
      resolution_notes,
      is_verified_incident,
    } = req.body;

    const resq = await ResqRequest.findByPk(id);
    if (!resq) {
      return res.status(404).json({ success: false, message: 'Emergency request not found' });
    }

    const assignedJurisdiction = getAdminJurisdiction(req.user);
    if (assignedJurisdiction !== 'all') {
      const incidentTown = resq.municipality || resq.hub;
      if (incidentTown && incidentTown !== assignedJurisdiction) {
        return res.status(403).json({ success: false, message: `Unauthorized: This incident belongs to ${incidentTown} jurisdiction.` });
      }
    }

    const previousStatus = resq.status;
    const now = new Date();

    if (status) resq.status = status;
    if (target_agency) resq.target_agency = target_agency;
    if (assigned_agency) resq.assigned_agency = assigned_agency;
    if (assigned_department) resq.assigned_department = assigned_department;
    if (assigned_responder_id !== undefined) resq.assigned_responder_id = assigned_responder_id ? parseInt(assigned_responder_id) : null;
    if (assigned_subadmin_id !== undefined) resq.assigned_subadmin_id = assigned_subadmin_id ? parseInt(assigned_subadmin_id) : null;
    if (assigned_sector !== undefined) resq.assigned_sector = assigned_sector;
    if (subadmin_notes !== undefined) resq.subadmin_notes = subadmin_notes;
    if (responder_name !== undefined) resq.responder_name = responder_name;
    if (responder_phone !== undefined) resq.responder_phone = responder_phone;
    if (responder_unit !== undefined) resq.responder_unit = responder_unit;
    if (dispatcher_notes !== undefined) resq.dispatcher_notes = dispatcher_notes;
    if (resolution_notes !== undefined) resq.resolution_notes = resolution_notes;
    if (is_verified_incident !== undefined) resq.is_verified_incident = is_verified_incident;

    // Only set responder coordinates if valid numeric values are provided (no null, NaN, or dummy offsets)
    if (responder_lat !== undefined && responder_lng !== undefined && responder_lat !== null && responder_lng !== null && responder_lat !== '' && responder_lng !== '') {
      const pLat = parseFloat(responder_lat);
      const pLng = parseFloat(responder_lng);
      if (!isNaN(pLat) && !isNaN(pLng)) {
        resq.responder_lat = pLat;
        resq.responder_lng = pLng;
      }
    }

    // Exact milestone timestamping for response-duration metrics
    if ((status === 'Validated' || status === 'Accepted') && !resq.validated_at) {
      resq.validated_at = now;
      resq.is_verified_incident = true;
    }
    if ((status === 'Dispatched' || status === 'Responder Dispatched') && !resq.dispatched_at) {
      resq.dispatched_at = now;
      resq.is_verified_incident = true;
    }
    if (status === 'En Route' && !resq.en_route_at) {
      resq.en_route_at = now;
      if (!resq.dispatched_at) resq.dispatched_at = now;
    }
    if ((status === 'On Scene' || status === 'Arrived') && !resq.arrived_at) {
      resq.arrived_at = now;
      resq.on_scene_at = now;
    }
    if ((status === 'Resolved' || status === 'Completed') && !resq.completed_at) {
      resq.completed_at = now;
      resq.resolved_at = now;
      if (resq.dispatched_at) {
        resq.response_duration_seconds = Math.round((now - new Date(resq.dispatched_at)) / 1000);
      }
    }
    if (status === 'Closed' && !resq.closed_at) {
      resq.closed_at = now;
    }

    await resq.save();

    // Create tracking audit log entry
    await IncidentTrackingLog.create({
      incident_id: resq.id,
      actor_id: actorId,
      actor_name: `${req.user.role || 'Admin'} (#${actorId})`,
      actor_role: actorRole,
      previous_status: previousStatus,
      new_status: resq.status,
      notes: dispatcher_notes || resolution_notes || `Status updated to ${resq.status}`,
      latitude: resq.responder_lat || resq.latitude,
      longitude: resq.responder_lng || resq.longitude,
    });

    const updatedFull = await ResqRequest.findByPk(id, {
      include: [
        {
          model: User,
          as: 'requester',
          attributes: ['id', 'email', 'phone_number', 'is_verified', 'verification_status'],
          include: [{ model: Profile, as: 'profile' }],
        },
        {
          model: User,
          as: 'assigned_responder',
          attributes: ['id', 'email', 'phone_number', 'role', 'agency'],
          include: [{ model: Profile, as: 'profile' }],
        },
        {
          model: User,
          as: 'assigned_subadmin',
          attributes: ['id', 'email', 'phone_number', 'role'],
          include: [{ model: Profile, as: 'profile' }],
        },
        {
          model: IncidentTrackingLog,
          as: 'tracking_logs',
        },
      ],
    });

    // Real-time broadcast with dual notifications
    const io = req.app.get('io');
    if (io) {
      io.emit('update_rescue_status', updatedFull);
      io.emit('emergency:status_change', updatedFull);
      io.to(`resq_${resq.id}`).emit('update_rescue_status', updatedFull);
      io.to(`user_${resq.user_id}`).emit('update_rescue_status', updatedFull);

      // Specific event hooks
      if (status === 'Assigned' || assigned_subadmin_id) {
        // Alert sub-admin specifically
        if (resq.assigned_subadmin_id) {
          io.to(`user_${resq.assigned_subadmin_id}`).emit('new_assignment_alert', updatedFull);
        }
        io.to('role_sub_admin').emit('new_assignment_alert', updatedFull);
      }

      if (status === 'Responder Dispatched' || status === 'Dispatched') {
        io.to(`user_${resq.user_id}`).emit('responder_dispatched', updatedFull);
        if (resq.assigned_responder_id) {
          io.to(`user_${resq.assigned_responder_id}`).emit('responder_dispatched', updatedFull);
        }
      } else if (status === 'En Route') {
        io.to(`user_${resq.user_id}`).emit('responder_en_route', updatedFull);
        io.to('role_admin').emit('responder_en_route', updatedFull);
        io.to('role_sub_admin').emit('responder_en_route', updatedFull);
      } else if (status === 'Arrived' || status === 'On Scene') {
        io.to(`user_${resq.user_id}`).emit('responder_arrived', updatedFull);
        io.to('role_admin').emit('responder_arrived', updatedFull);
        io.to('role_sub_admin').emit('responder_arrived', updatedFull);
      } else if (status === 'Completed' || status === 'Resolved') {
        io.to(`user_${resq.user_id}`).emit('rescue_completed', updatedFull);
        io.to('role_admin').emit('rescue_completed', updatedFull);
        io.to('role_sub_admin').emit('rescue_completed', updatedFull);
      }
    }

    return res.json({
      success: true,
      message: `Emergency incident updated to ${resq.status}`,
      request: updatedFull,
    });
  } catch (error) {
    console.error('[DISPATCH ERROR]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 6.25 Sub-Admin Confirms Assignment (Notifies Admin & Citizen)
exports.subadminConfirmAssignment = async (req, res) => {
  const { id } = req.params;
  const actorId = req.user.id;
  const actorRole = req.user.role;

  try {
    const resq = await ResqRequest.findByPk(id);
    if (!resq) {
      return res.status(404).json({ success: false, message: 'Emergency incident not found' });
    }

    const previousStatus = resq.status;
    const now = new Date();

    resq.subadmin_confirmed_at = now;
    if (resq.status === 'Pending' || resq.status === 'Assigned') {
      resq.status = 'Accepted';
    }
    if (!resq.assigned_subadmin_id) {
      resq.assigned_subadmin_id = actorId;
    }
    if (req.body.subadmin_notes) {
      resq.subadmin_notes = req.body.subadmin_notes;
    }

    await resq.save();

    const subAdminName = req.user.profile?.full_name ||
      `${req.user.profile?.first_name || ''} ${req.user.profile?.last_name || ''}`.trim() ||
      req.user.email;
    const sectorName = resq.assigned_sector || resq.municipality || 'Operations';

    // Tracking log
    await IncidentTrackingLog.create({
      incident_id: resq.id,
      actor_id: actorId,
      actor_name: subAdminName,
      actor_role: actorRole,
      previous_status: previousStatus,
      new_status: resq.status,
      notes: `Sub-Admin / Dispatcher ${subAdminName} confirmed incident assignment for ${sectorName} Sector.`,
      latitude: resq.responder_lat || resq.latitude,
      longitude: resq.responder_lng || resq.longitude,
    });

    // Notify citizen in DB
    await Notification.create({
      receiver_id: resq.user_id,
      sender_id: actorId,
      target_group: 'specific',
      type: 'system_alert',
      title: '🚨 Emergency Assignment Confirmed',
      message: `Your emergency in ${resq.municipality || 'the sector'} has been confirmed by ${sectorName} Dispatch Command. Rescue units are being mobilized.`,
    });

    // Notify admins in DB
    await Notification.create({
      receiver_id: null,
      sender_id: actorId,
      target_group: 'specific',
      type: 'important_activity',
      title: '✓ Sub-Admin Confirmed Assignment',
      message: `${subAdminName} (${sectorName} Sector) confirmed emergency assignment for Incident #${resq.id}.`,
    });

    const updatedFull = await ResqRequest.findByPk(id, {
      include: [
        {
          model: User,
          as: 'requester',
          attributes: ['id', 'email', 'phone_number', 'is_verified', 'verification_status'],
          include: [{ model: Profile, as: 'profile' }],
        },
        {
          model: User,
          as: 'assigned_responder',
          attributes: ['id', 'email', 'phone_number', 'role', 'agency'],
          include: [{ model: Profile, as: 'profile' }],
        },
        {
          model: User,
          as: 'assigned_subadmin',
          attributes: ['id', 'email', 'phone_number', 'role'],
          include: [{ model: Profile, as: 'profile' }],
        },
        {
          model: IncidentTrackingLog,
          as: 'tracking_logs',
        },
      ],
    });

    // Broadcast over sockets to both Admin and Citizen
    const io = req.app.get('io');
    if (io) {
      const confirmPayload = {
        incidentId: resq.id,
        subadminId: actorId,
        subadminName,
        sector: sectorName,
        request: updatedFull,
        message: `✓ Sub-Admin ${subAdminName} (${sectorName} Sector) confirmed Emergency #${resq.id}!`,
      };

      io.emit('update_rescue_status', updatedFull);
      io.emit('emergency:status_change', updatedFull);
      io.to('role_admin').emit('subadmin_confirmed_assignment', confirmPayload);
      io.to('role_sub_admin').emit('subadmin_confirmed_assignment', confirmPayload);
      io.to(`user_${resq.user_id}`).emit('subadmin_confirmed_assignment', {
        ...confirmPayload,
        citizenMessage: `Your emergency has been confirmed by ${sectorName} Dispatch Command. Responders are preparing deployment!`,
      });
      io.to(`user_${resq.user_id}`).emit('update_rescue_status', updatedFull);
      io.to(`resq_${resq.id}`).emit('update_rescue_status', updatedFull);
    }

    return res.json({
      success: true,
      message: `Emergency #${resq.id} assignment confirmed successfully! Admin and Citizen notified.`,
      request: updatedFull,
    });
  } catch (error) {
    console.error('[SUBADMIN CONFIRM ERROR]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 6.28 Get Available Sub-Admins / Dispatchers
exports.getSubAdmins = async (req, res) => {
  try {
    const { municipality } = req.query;

    const subAdmins = await User.findAll({
      where: {
        role: 'sub_admin',
        is_active: true,
      },
      include: [
        {
          model: Profile,
          as: 'profile',
          attributes: ['first_name', 'last_name', 'full_name', 'city', 'address', 'headline', 'latitude', 'longitude'],
        }
      ],
      order: [['id', 'ASC']],
    });

    let mapped = subAdmins.map(u => {
      const email = (u.email || '').toLowerCase();
      let town = u.profile?.city;
      if (!town || !['Porac', 'Santa Rita', 'Guagua'].includes(town)) {
        if (email.includes('porac')) town = 'Porac';
        else if (email.includes('santarita') || email.includes('santa rita')) town = 'Santa Rita';
        else if (email.includes('guagua')) town = 'Guagua';
        else town = 'Porac';
      }

      return {
        id: u.id,
        email: u.email,
        name: u.profile?.full_name || `${u.profile?.first_name || ''} ${u.profile?.last_name || ''}`.trim() || u.email,
        phone: u.phone_number,
        municipality: town,
        sector: town,
        headline: u.profile?.headline || `MDRRMO Sub-Admin & Dispatcher - ${town}`,
      };
    });

    if (municipality && municipality !== 'all') {
      mapped = mapped.filter(s => s.municipality.toLowerCase() === municipality.toLowerCase());
    }

    return res.json({
      success: true,
      subadmins: mapped,
    });
  } catch (error) {
    console.error('[GET SUBADMINS ERROR]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 6.3 Query Available Responders for Hub Assignment
exports.getAvailableResponders = async (req, res) => {
  try {
    const { municipality, department } = req.query;

    const responders = await User.findAll({
      where: {
        role: { [Op.in]: ['responder', 'pnp_responder', 'bfp_responder', 'mdrrmo_admin'] },
        is_active: true,
      },
      include: [
        {
          model: Profile,
          as: 'profile',
          attributes: ['first_name', 'last_name', 'full_name', 'city', 'address', 'responder_badge_number', 'responder_unit', 'headline', 'latitude', 'longitude'],
        }
      ],
      order: [['id', 'ASC']],
    });

    let filtered = responders.map(u => {
      let dept = u.agency || 'Medical';
      const headline = (u.profile?.headline || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      if (email.includes('police') || headline.includes('police') || u.role === 'pnp_responder') dept = 'Police';
      else if (email.includes('fire') || headline.includes('fire') || u.role === 'bfp_responder') dept = 'Fire';
      else if (email.includes('medic') || headline.includes('medic') || headline.includes('mdrrmo')) dept = 'Medical';
      else if (headline.includes('rescue')) dept = 'Rescue';

      const town = u.profile?.city || (email.includes('porac') ? 'Porac' : email.includes('santarita') ? 'Santa Rita' : email.includes('guagua') ? 'Guagua' : 'Porac');

      return {
        id: u.id,
        email: u.email,
        name: u.profile?.full_name || `${u.profile?.first_name || ''} ${u.profile?.last_name || ''}`.trim() || u.email,
        phone: u.phone_number,
        municipality: town,
        department: dept,
        badge: u.profile?.responder_badge_number || u.badge_or_unit_id || 'N/A',
        unit: u.profile?.responder_unit || `${dept} Unit`,
        headline: u.profile?.headline || `${dept} Responder`,
        lat: u.profile?.latitude,
        lng: u.profile?.longitude,
      };
    });

    const assignedJurisdiction = getAdminJurisdiction(req.user);
    const targetTown = assignedJurisdiction !== 'all' ? assignedJurisdiction : municipality;

    if (targetTown && targetTown !== 'all') {
      filtered = filtered.filter(r => r.municipality.toLowerCase() === targetTown.toLowerCase());
    }
    if (department && department !== 'all') {
      filtered = filtered.filter(r => r.department.toLowerCase() === department.toLowerCase());
    }

    return res.json({
      success: true,
      responders: filtered,
    });
  } catch (error) {
    console.error('[GET RESPONDERS ERROR]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 7. Update Responder Live GPS Location
exports.updateResponderLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const { responder_lat, responder_lng } = req.body;

    if (!responder_lat || !responder_lng) {
      return res.status(400).json({ success: false, message: 'Latitude and longitude are required.' });
    }

    const resq = await ResqRequest.findByPk(id);
    if (!resq) {
      return res.status(404).json({ success: false, message: 'Emergency request not found' });
    }

    resq.responder_lat = parseFloat(responder_lat);
    resq.responder_lng = parseFloat(responder_lng);
    await resq.save();

    const locationPayload = {
      request_id: resq.id,
      user_id: resq.user_id,
      status: resq.status,
      responder_lat: parseFloat(responder_lat),
      responder_lng: parseFloat(responder_lng),
      responder_unit: resq.responder_unit,
      updatedAt: new Date().toISOString(),
    };

    const io = req.app.get('io');
    if (io) {
      io.to(`resq_${resq.id}`).emit(`resq_live_location_${resq.id}`, locationPayload);
      io.emit('resq_live_location', locationPayload);
      io.emit('responder:location_update', locationPayload);
      io.to(`user_${resq.user_id}`).emit('resq_live_location', locationPayload);
    }

    return res.json({
      success: true,
      message: 'Responder location updated in real time.',
      location: locationPayload,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 8. Cancel Rescue Request
exports.cancelResqRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const resq = await ResqRequest.findByPk(id);

    if (!resq) {
      return res.status(404).json({ success: false, message: 'Emergency request not found' });
    }

    if (!['admin', 'sub_admin', 'super_admin', 'mdrrmo_admin'].includes(req.user.role) && resq.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized to cancel this request.' });
    }

    resq.status = 'Cancelled';
    resq.resolved_at = new Date();
    await resq.save();

    await IncidentTrackingLog.create({
      incident_id: resq.id,
      actor_id: req.user.id,
      actor_name: `${req.user.role} (#${req.user.id})`,
      actor_role: req.user.role,
      previous_status: resq.status,
      new_status: 'Cancelled',
      notes: 'Request cancelled by user/dispatcher',
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('update_rescue_status', resq);
      io.emit('emergency:status_change', resq);
      io.to(`resq_${resq.id}`).emit('update_rescue_status', resq);
      io.to(`user_${resq.user_id}`).emit('update_rescue_status', resq);
    }

    return res.json({
      success: true,
      message: 'Emergency request cancelled.',
      request: resq,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 9. Real Database Aggregation Analytics (Zero Mock Data)
exports.getResqAnalytics = async (req, res) => {
  try {
    const assignedJurisdiction = getAdminJurisdiction(req.user);
    const whereScope = {};
    if (assignedJurisdiction !== 'all') {
      whereScope.municipality = assignedJurisdiction;
    }

    // 1. Total counts by status
    const totalIncidents = await ResqRequest.count({ where: whereScope });
    const pendingIncidents = await ResqRequest.count({ where: { ...whereScope, status: 'Pending' } });
    const validatedIncidents = await ResqRequest.count({ where: { ...whereScope, status: 'Validated' } });
    const activeDispatched = await ResqRequest.count({
      where: { ...whereScope, status: { [Op.in]: ['Dispatched', 'En Route', 'On Scene', 'In Progress'] } },
    });
    const resolvedIncidents = await ResqRequest.count({
      where: { ...whereScope, status: { [Op.in]: ['Resolved', 'Completed', 'Closed'] } },
    });
    const cancelledIncidents = await ResqRequest.count({ where: { ...whereScope, status: 'Cancelled' } });

    // 2. Average Response Duration
    let durationWhere = "dispatched_at IS NOT NULL AND (on_scene_at IS NOT NULL OR resolved_at IS NOT NULL)";
    if (assignedJurisdiction !== 'all') {
      const cleanTown = assignedJurisdiction.replace(/'/g, "\\'");
      durationWhere += ` AND municipality = '${cleanTown}'`;
    }

    const avgResponseQuery = await sequelize.query(`
      SELECT 
        AVG(TIMESTAMPDIFF(SECOND, dispatched_at, COALESCE(on_scene_at, resolved_at))) AS avg_response_seconds,
        MIN(TIMESTAMPDIFF(SECOND, dispatched_at, COALESCE(on_scene_at, resolved_at))) AS min_response_seconds,
        MAX(TIMESTAMPDIFF(SECOND, dispatched_at, COALESCE(on_scene_at, resolved_at))) AS max_response_seconds
      FROM resq_requests
      WHERE ${durationWhere}
    `);

    const avgSeconds = avgResponseQuery[0][0]?.avg_response_seconds ? Math.round(avgResponseQuery[0][0].avg_response_seconds) : 0;
    const avgMinutes = (avgSeconds / 60).toFixed(1);

    // 3. Incident Breakdown by Emergency Type (Real SQL GROUP BY)
    const typeBreakdown = await ResqRequest.findAll({
      attributes: ['emergency_type', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      where: whereScope,
      group: ['emergency_type'],
      raw: true,
    });

    // 4. Incident Breakdown by Target Agency (Real SQL GROUP BY)
    const agencyBreakdown = await ResqRequest.findAll({
      attributes: ['target_agency', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      where: whereScope,
      group: ['target_agency'],
      raw: true,
    });

    // 5. Incident Breakdown by Barangay (Real SQL GROUP BY)
    const barangayWhere = { ...whereScope, barangay: { [Op.ne]: null } };
    const barangayBreakdown = await ResqRequest.findAll({
      attributes: ['barangay', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      where: barangayWhere,
      group: ['barangay'],
      order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
      limit: 10,
      raw: true,
    });

    // 6. Severity Level Breakdown
    const severityBreakdown = await ResqRequest.findAll({
      attributes: ['severity_level', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      where: whereScope,
      group: ['severity_level'],
      raw: true,
    });

    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      jurisdiction: assignedJurisdiction,
      summary: {
        total: totalIncidents,
        pending: pendingIncidents,
        validated: validatedIncidents,
        active: activeDispatched,
        resolved: resolvedIncidents,
        cancelled: cancelledIncidents,
        avg_response_time_seconds: avgSeconds,
        avg_response_time_minutes: parseFloat(avgMinutes),
      },
      charts: {
        by_emergency_type: typeBreakdown,
        by_agency: agencyBreakdown,
        by_barangay: barangayBreakdown,
        by_severity: severityBreakdown,
      },
    });
  } catch (error) {
    console.error('[ANALYTICS ERROR]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
