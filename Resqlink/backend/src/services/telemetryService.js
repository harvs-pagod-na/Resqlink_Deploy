/**
 * High-Concurrency Telemetry Ingestion & Real-Time Geo Calculation Engine
 * - In-Memory / Redis Ephemeral state storage
 * - Dead Reckoning & Linear Projection
 * - Great-Circle Haversine Distance & Dynamic ETA calculation
 * - Write-Behind Batch Flusher to protect DB from IOPS saturation
 */

const { redisClient } = require('../config/redis');

// In-memory write-behind buffer for bulk telemetry history
let telemetryBuffer = [];
const BATCH_FLUSH_INTERVAL = 5000; // Flush every 5 seconds
const BATCH_MAX_SIZE = 100;

/**
 * Calculates Great-Circle Distance via Haversine Formula (Meters)
 */
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Dead Reckoning extrapolation:
 * Projects position forward if packets are delayed or intermittent.
 */
function deadReckoningProject(lat, lon, speedMps, headingDeg, deltaSeconds) {
  if (!speedMps || speedMps <= 0) return { lat, lon };
  const distance = speedMps * deltaSeconds;
  const R = 6371e3;
  const brng = (headingDeg * Math.PI) / 180;
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lon * Math.PI) / 180;

  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(distance / R) +
      Math.cos(φ1) * Math.sin(distance / R) * Math.cos(brng)
  );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(distance / R) * Math.cos(φ1),
      Math.cos(distance / R) - Math.sin(φ1) * Math.sin(φ2)
    );

  return {
    lat: (φ2 * 180) / Math.PI,
    lon: (λ2 * 180) / Math.PI,
  };
}

// In-memory fallback map when Redis is not active
const inMemoryTelemetry = new Map();

/**
 * Ingest high-frequency telemetry ping and compute dynamic ETA
 */
async function processTelemetryPing(requestId, userId, role, telemetryData) {
  const { latitude, longitude, speed = 0, heading = 0, timestamp = Date.now() } = telemetryData;

  const record = {
    userId,
    role,
    latitude: parseFloat(latitude),
    longitude: parseFloat(longitude),
    speed: parseFloat(speed),
    heading: parseFloat(heading),
    timestamp,
  };

  const hashKey = `telemetry:resq:${requestId}`;
  let allMembers = {};

  try {
    if (redisClient && redisClient.status === 'ready') {
      await redisClient.hset(hashKey, `${role}_${userId}`, JSON.stringify(record));
      allMembers = await redisClient.hgetall(hashKey);
    } else {
      if (!inMemoryTelemetry.has(hashKey)) inMemoryTelemetry.set(hashKey, {});
      const group = inMemoryTelemetry.get(hashKey);
      group[`${role}_${userId}`] = JSON.stringify(record);
      allMembers = group;
    }
  } catch (err) {
    if (!inMemoryTelemetry.has(hashKey)) inMemoryTelemetry.set(hashKey, {});
    const group = inMemoryTelemetry.get(hashKey);
    group[`${role}_${userId}`] = JSON.stringify(record);
    allMembers = group;
  }

  // 2. Compute Distance and ETA between Reporter and Responder
  let distanceMeters = null;
  let etaSeconds = null;

  const entries = Object.values(allMembers || {}).map((v) => {
    try {
      return typeof v === 'string' ? JSON.parse(v) : v;
    } catch (e) {
      return null;
    }
  }).filter(Boolean);

  const reporter = entries.find((e) => e.role === 'user' || e.role === 'CITIZEN' || e.role === 'requester');
  const responder = entries.find((e) => e.role === 'responder' || e.role === 'admin' || e.role === 'sub_admin' || e.role === 'RESPONDER');

  if (reporter && responder) {
    distanceMeters = calculateDistanceMeters(
      reporter.latitude,
      reporter.longitude,
      responder.latitude,
      responder.longitude
    );

    // Emergency vehicle average operating speed ~ 40km/h (11.11 m/s) with minimum floor
    const effectiveSpeed = responder.speed > 2 ? responder.speed : 11.11;
    etaSeconds = Math.max(15, Math.round(distanceMeters / effectiveSpeed));
  }

  // 3. Queue to Write-Behind Buffer
  telemetryBuffer.push({
    request_id: requestId,
    user_id: userId,
    role,
    latitude: record.latitude,
    longitude: record.longitude,
    speed: record.speed,
    heading: record.heading,
    recorded_at: new Date(timestamp),
  });

  if (telemetryBuffer.length >= BATCH_MAX_SIZE) {
    flushTelemetryBuffer();
  }

  return {
    record,
    metrics: {
      distanceMeters: distanceMeters !== null ? Math.round(distanceMeters) : null,
      etaSeconds: etaSeconds !== null ? etaSeconds : null,
      distanceKm: distanceMeters !== null ? (distanceMeters / 1000).toFixed(2) : null,
      etaMinutes: etaSeconds !== null ? Math.ceil(etaSeconds / 60) : null,
    },
  };
}

/**
 * Flush telemetry buffer to database in batches
 */
async function flushTelemetryBuffer() {
  if (telemetryBuffer.length === 0) return;
  const toFlush = [...telemetryBuffer];
  telemetryBuffer = [];

  try {
    // Check if ResqRequest or telemetry table exists
    const { ResqRequest } = require('../models');
    // Update latest responder location on active request
    const latestResponderPing = toFlush
      .filter((p) => ['responder', 'admin', 'sub_admin', 'RESPONDER'].includes(p.role))
      .pop();

    if (latestResponderPing && latestResponderPing.request_id) {
      await ResqRequest.update(
        {
          responder_lat: latestResponderPing.latitude,
          responder_lng: latestResponderPing.longitude,
        },
        {
          where: { id: latestResponderPing.request_id },
        }
      );
    }
  } catch (err) {
    console.error('[TelemetryFlusher] Bulk flush warning:', err.message);
  }
}

// Start periodic flusher timer
setInterval(flushTelemetryBuffer, BATCH_FLUSH_INTERVAL);

module.exports = {
  calculateDistanceMeters,
  deadReckoningProject,
  processTelemetryPing,
  flushTelemetryBuffer,
};
