const socketIo = require('socket.io');
const { processTelemetryPing } = require('../services/telemetryService');

function initSocket(server) {
  const io = socketIo(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT'],
    },
    // Production tuning for high-concurrency connections
    pingInterval: 10000,
    pingTimeout: 5000,
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    console.log(`[SOCKET] Client connected: ${socket.id}`);

    // 1. Join user personal room for private notifications
    socket.on('join_user_room', (data) => {
      const userId = typeof data === 'object' ? data.userId : data;
      const role = typeof data === 'object' ? data.role : null;
      const hub = typeof data === 'object' ? data.hub : null;
      socket.join(`user_${userId}`);
      if (role) {
        socket.join(`role_${role}`);
      }
      if (hub) {
        socket.join(`hub_${hub}`);
      }
      console.log(`[SOCKET] User ${userId} joined room user_${userId} (role: ${role || 'N/A'}, hub: ${hub || 'N/A'})`);
    });

    // 2. Dynamic Emergency Tracking Room Isolation
    socket.on('join_resq_room', (resqId) => {
      if (!resqId) return;
      socket.join(`resq_${resqId}`);
      console.log(`[SOCKET] Socket ${socket.id} joined rescue room resq_${resqId}`);
    });

    socket.on('leave_resq_room', (resqId) => {
      if (!resqId) return;
      socket.leave(`resq_${resqId}`);
      console.log(`[SOCKET] Socket ${socket.id} left rescue room resq_${resqId}`);
    });

    // 3. High-Frequency Bi-Directional Telemetry Stream (1Hz Reporter <-> Responder)
    socket.on('telemetry_ping', async (data) => {
      try {
        const { request_id, user_id, role, latitude, longitude, speed, heading } = data;
        if (!request_id || !latitude || !longitude) return;

        const telemetryResult = await processTelemetryPing(
          request_id,
          user_id,
          role || 'responder',
          {
            latitude,
            longitude,
            speed,
            heading,
          }
        );

        const broadcastPayload = {
          request_id,
          user_id,
          role,
          responder_lat: parseFloat(latitude),
          responder_lng: parseFloat(longitude),
          speed,
          heading,
          metrics: telemetryResult.metrics,
          timestamp: Date.now(),
        };

        // Broadcast to isolated room listeners
        io.to(`resq_${request_id}`).emit(`resq_live_location_${request_id}`, broadcastPayload);
        io.to(`resq_${request_id}`).emit('resq_live_location', broadcastPayload);
        io.emit('resq_live_location', broadcastPayload);

        if (user_id) {
          io.to(`user_${user_id}`).emit('resq_live_location', broadcastPayload);
        }
      } catch (err) {
        console.error('[SOCKET] Telemetry stream error:', err.message);
      }
    });

    // Legacy update_responder_location backward compatibility
    socket.on('update_responder_location', async (data) => {
      if (data && data.request_id && data.responder_lat && data.responder_lng) {
        try {
          const telemetryResult = await processTelemetryPing(
            data.request_id,
            data.user_id || 'responder',
            'responder',
            {
              latitude: data.responder_lat,
              longitude: data.responder_lng,
              speed: 11.11,
              heading: 0,
            }
          );
          const payload = {
            ...data,
            metrics: telemetryResult.metrics,
          };
          io.to(`resq_${data.request_id}`).emit(`resq_live_location_${data.request_id}`, payload);
          io.to(`resq_${data.request_id}`).emit('resq_live_location', payload);
          io.emit('resq_live_location', payload);
          if (data.user_id) {
            io.to(`user_${data.user_id}`).emit('resq_live_location', payload);
          }
        } catch (err) {
          console.error('[SOCKET] Error in update_responder_location:', err.message);
        }
      }
    });

    // Chat / Messages
    socket.on('join_conversation', (conversationId) => {
      socket.join(`conv_${conversationId}`);
    });

    socket.on('send_message', (data) => {
      io.to(`conv_${data.conversation_id}`).emit('new_message', data);
      io.to(`user_${data.receiver_id}`).emit('message_notification', data);
    });

    socket.on('disconnect', () => {
      console.log(`[SOCKET] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

module.exports = initSocket;
