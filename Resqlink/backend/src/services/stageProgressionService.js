const { ResqRequest, User, Profile, IncidentTrackingLog } = require('../models');
const { calculateDistanceMeters } = require('./telemetryService');

// Map to track consecutive proximity hits to prevent false single-ping arrivals
const proximityStreak = new Map();

/**
 * Handles automatic rescue stage progression and real-time responder location tracking.
 * - Validates GPS coordinates
 * - Updates responder location in DB and memory
 * - Automatically advances:
 *     RESPONDER DISPATCHED -> EN ROUTE (when telemetry stream begins)
 *     EN ROUTE -> ARRIVED (when proximity threshold <= 75m is met)
 * - Broadcasts real-time events across Socket.IO (Admin, Dispatcher, Citizen, Responder)
 */
async function handleLiveLocationAndProgression({
  requestId,
  responderLat,
  responderLng,
  speed = 0,
  heading = 0,
  actorInfo = null,
  io = null,
}) {
  const lat = parseFloat(responderLat);
  const lng = parseFloat(responderLng);

  if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
    return null;
  }

  const resq = await ResqRequest.findByPk(requestId);
  if (!resq) return null;

  // Don't update coordinates or progress closed incidents
  if (['Completed', 'Resolved', 'Cancelled', 'Closed'].includes(resq.status)) {
    return null;
  }

  resq.responder_lat = lat;
  resq.responder_lng = lng;

  const targetLat = parseFloat(resq.latitude);
  const targetLng = parseFloat(resq.longitude);

  let distanceMeters = null;
  let etaSeconds = null;

  if (!isNaN(targetLat) && !isNaN(targetLng)) {
    distanceMeters = calculateDistanceMeters(targetLat, targetLng, lat, lng);
    const effectiveSpeed = speed > 2 ? speed : 11.11; // ~40 km/h baseline
    etaSeconds = Math.max(10, Math.round(distanceMeters / effectiveSpeed));
  }

  let statusChanged = false;
  const previousStatus = resq.status;
  const now = new Date();

  // ─── 1. AUTO-PROGRESSION: RESPONDER DISPATCHED -> EN ROUTE ───
  if (['Responder Dispatched', 'Dispatched'].includes(resq.status)) {
    resq.status = 'En Route';
    resq.en_route_at = resq.en_route_at || now;
    statusChanged = true;

    try {
      await IncidentTrackingLog.create({
        incident_id: resq.id,
        actor_id: actorInfo?.userId || resq.assigned_responder_id || null,
        actor_name: actorInfo?.name || resq.responder_name || 'Field Responder Unit',
        actor_role: actorInfo?.role || 'responder',
        previous_status: previousStatus,
        new_status: 'En Route',
        notes: '[AUTOMATIC PROGRESSION] Responder telemetry stream active. Unit started transit toward scene.',
        latitude: lat,
        longitude: lng,
      });
    } catch (logErr) {
      console.warn('[IncidentTrackingLog Non-Fatal Warning]:', logErr.message);
    }
  }

  // ─── 2. AUTO-PROGRESSION: EN ROUTE -> ARRIVED (Proximity Detection) ───
  else if (resq.status === 'En Route' && distanceMeters !== null) {
    // Arrival threshold: <= 75 meters
    if (distanceMeters <= 75) {
      const streak = (proximityStreak.get(resq.id) || 0) + 1;
      proximityStreak.set(resq.id, streak);

      // Require 2 consecutive hits <= 75m, or immediate hit if within 40m
      if (streak >= 2 || distanceMeters <= 40) {
        resq.status = 'Arrived';
        resq.arrived_at = resq.arrived_at || now;
        resq.on_scene_at = resq.on_scene_at || now;
        statusChanged = true;
        proximityStreak.delete(resq.id);

        try {
          await IncidentTrackingLog.create({
            incident_id: resq.id,
            actor_id: actorInfo?.userId || resq.assigned_responder_id || null,
            actor_name: actorInfo?.name || resq.responder_name || 'Field Responder Unit',
            actor_role: actorInfo?.role || 'responder',
            previous_status: previousStatus,
            new_status: 'Arrived',
            notes: `[AUTOMATIC PROGRESSION] Proximity detected (${Math.round(distanceMeters)}m from incident). Responder arrived on scene.`,
            latitude: lat,
            longitude: lng,
          });
        } catch (logErr) {
          console.warn('[IncidentTrackingLog Non-Fatal Warning]:', logErr.message);
        }
      }
    } else {
      proximityStreak.set(resq.id, 0);
    }
  }

  await resq.save();

  // ─── 3. BROADCAST REAL-TIME SYNCHRONIZATION ───
  const locationPayload = {
    request_id: resq.id,
    user_id: resq.user_id,
    status: resq.status,
    responder_lat: lat,
    responder_lng: lng,
    speed,
    heading,
    metrics: {
      distanceMeters: distanceMeters !== null ? Math.round(distanceMeters) : null,
      distanceKm: distanceMeters !== null ? (distanceMeters / 1000).toFixed(2) : null,
      etaSeconds,
      etaMinutes: etaSeconds !== null ? Math.ceil(etaSeconds / 60) : null,
      speedKmh: Math.round(speed * 3.6) || (resq.status === 'En Route' ? 40 : 0),
    },
    timestamp: Date.now(),
  };

  if (io) {
    // Continuous live location stream
    io.to(`resq_${resq.id}`).emit(`resq_live_location_${resq.id}`, locationPayload);
    io.to(`resq_${resq.id}`).emit('resq_live_location', locationPayload);
    io.emit('resq_live_location', locationPayload);
    io.emit('responder:location_update', locationPayload);

    if (resq.user_id) {
      io.to(`user_${resq.user_id}`).emit('resq_live_location', locationPayload);
    }

    // Broadcast status change if stage automatically advanced
    if (statusChanged) {
      const fullRequest = await ResqRequest.findByPk(resq.id, {
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

      io.emit('update_rescue_status', fullRequest);
      io.emit('emergency:status_change', fullRequest);
      io.to(`resq_${resq.id}`).emit('update_rescue_status', fullRequest);
      io.to(`user_${resq.user_id}`).emit('update_rescue_status', fullRequest);

      if (resq.status === 'En Route') {
        io.emit('responder_en_route', fullRequest);
        io.to('role_admin').emit('responder_en_route', fullRequest);
        io.to('role_sub_admin').emit('responder_en_route', fullRequest);
        io.to(`user_${resq.user_id}`).emit('responder_en_route', fullRequest);
      } else if (resq.status === 'Arrived') {
        io.emit('responder_arrived', fullRequest);
        io.to('role_admin').emit('responder_arrived', fullRequest);
        io.to('role_sub_admin').emit('responder_arrived', fullRequest);
        io.to(`user_${resq.user_id}`).emit('responder_arrived', fullRequest);
      }
    }
  }

  return {
    success: true,
    request: resq,
    location: locationPayload,
    statusChanged,
  };
}

module.exports = {
  handleLiveLocationAndProgression,
};
