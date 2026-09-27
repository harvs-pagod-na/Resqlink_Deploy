const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 4000;

// Base Station Coordinates (Command NOC - Central Hub for Porac, Santa Rita, Guagua)
const BASE_STATION = {
  name: 'CENTRAL COMMAND NOC (PORAC • STA. RITA • GUAGUA)',
  lat: 15.0250,
  lng: 120.5900
};

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const field = file.fieldname || 'upload';
    cb(null, `${field}-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  }
});
const upload = multer({ storage });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Data Persistence for Users & Incidents
const USERS_FILE = path.join(__dirname, 'users_data.json');
const users = new Map();

function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
      for (const u of data) {
        if (!u.municipality) u.municipality = 'Porac';
        users.set(u.id, u);
      }
      console.log(`[AUTH] Loaded ${users.size} users from storage.`);
    }
  } catch (err) {
    console.error('[AUTH] Failed to load users:', err.message);
  }
}

function saveUsers() {
  try {
    const data = Array.from(users.values());
    fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[AUTH] Failed to save users:', err.message);
  }
}
loadUsers();

// In-Memory Incidents Store
const incidents = new Map();

// --- 1. USER KYC VERIFICATION API ---

// Submit KYC Verification (ID Photo + Facial Selfie)
app.post('/api/verification/submit', upload.fields([
  { name: 'idPhoto', maxCount: 1 },
  { name: 'selfiePhoto', maxCount: 1 }
]), (req, res) => {
  try {
    const { fullName, phone, address, municipality, idType, idNumber, existingUserId } = req.body;

    if (!fullName || !phone || !idType) {
      return res.status(400).json({ success: false, message: 'Full Name, Mobile Number, and ID Type are required.' });
    }

    const validTowns = ['Porac', 'Santa Rita', 'Guagua'];
    const chosenTown = validTowns.includes(municipality) ? municipality : 'Porac';

    const idPhotoFile = req.files && req.files['idPhoto'] ? req.files['idPhoto'][0] : null;
    const selfiePhotoFile = req.files && req.files['selfiePhoto'] ? req.files['selfiePhoto'][0] : null;

    const userId = existingUserId || 'USR-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const existingUser = users.get(userId);

    const user = {
      id: userId,
      fullName: fullName.trim().toUpperCase(),
      phone: phone.trim(),
      municipality: chosenTown,
      address: (address || '').trim(),
      idType: idType.trim(),
      idNumber: (idNumber || 'N/A').trim(),
      idPhotoUrl: idPhotoFile ? `/uploads/${idPhotoFile.filename}` : (existingUser ? existingUser.idPhotoUrl : null),
      selfiePhotoUrl: selfiePhotoFile ? `/uploads/${selfiePhotoFile.filename}` : (existingUser ? existingUser.selfiePhotoUrl : null),
      status: 'PENDING', // PENDING -> VERIFIED | REJECTED
      rejectionReason: null,
      submittedAt: new Date().toISOString(),
      verifiedAt: null
    };

    users.set(userId, user);
    saveUsers();

    // Notify all admins via Socket.IO in real-time
    io.emit('new_verification_request', user);
    io.emit('admin_verifications_list', Array.from(users.values()));

    return res.status(201).json({
      success: true,
      message: 'Verification request submitted successfully. Awaiting Command NOC review.',
      user
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Check Verification Status
app.get('/api/verification/status/:userId', (req, res) => {
  const user = users.get(req.params.userId);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User profile not found.' });
  }
  return res.json({ success: true, user });
});

// Get Users List (with optional municipality filter)
app.get('/api/users', (req, res) => {
  const { municipality } = req.query;
  let all = Array.from(users.values());
  if (municipality && municipality !== 'all') {
    all = all.filter(u => u.municipality === municipality);
  }
  return res.json({ success: true, users: all });
});

// --- 2. EMERGENCY INCIDENT LOGGING API ---
app.post('/api/emergency', upload.single('photo'), (req, res) => {
  try {
    const { name, description, lat, lng, userId, phone, userVerified, municipality } = req.body;
    const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const incidentId = 'INC-' + Math.random().toString(36).substring(2, 7).toUpperCase();

    // Verify user profile if userId is provided
    let verifiedStatus = false;
    let verifiedUser = null;
    if (userId && users.has(userId)) {
      verifiedUser = users.get(userId);
      verifiedStatus = verifiedUser.status === 'VERIFIED';
    } else if (userVerified === 'true') {
      verifiedStatus = true;
    }

    const validTowns = ['Porac', 'Santa Rita', 'Guagua'];
    const chosenTown = validTowns.includes(municipality) ? municipality : (verifiedUser ? verifiedUser.municipality : 'Porac');

    const incident = {
      id: incidentId,
      userId: userId || null,
      name: (verifiedUser ? verifiedUser.fullName : (name || 'ANONYMOUS')),
      phone: (verifiedUser ? verifiedUser.phone : (phone || 'N/A')),
      municipality: chosenTown,
      idType: verifiedUser ? verifiedUser.idType : null,
      isVerified: verifiedStatus,
      description: description || 'No description provided',
      photoUrl,
      lat: parseFloat(lat) || 15.0250,
      lng: parseFloat(lng) || 120.5900,
      status: 'PENDING', // PENDING -> ACCEPTED -> EN_ROUTE -> ON_SCENE -> RETURNING_TO_BASE -> DONE
      baseStation: BASE_STATION,
      rescuerLat: BASE_STATION.lat,
      rescuerLng: BASE_STATION.lng,
      rescuerStatus: 'AT_BASE',
      createdAt: new Date().toISOString(),
      messages: []
    };

    incidents.set(incidentId, incident);

    // Broadcast new incident to connected Admins and Rescuers
    io.emit('new_incident_alert', incident);

    return res.status(201).json({
      success: true,
      message: 'Emergency incident logged successfully',
      incident
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// --- 3. SOCKET.IO REAL-TIME OPERATIONS ---
io.on('connection', (socket) => {

  // Citizen joins their personal room for instant verification status push
  socket.on('join_user_room', (userId) => {
    socket.join(`user_${userId}`);
    const u = users.get(userId);
    if (u) {
      socket.emit('user_status_changed', u);
    }
  });

  // Join specific incident tracking room
  socket.on('join_incident_room', (incidentId) => {
    socket.join(`incident_${incidentId}`);
  });

  // Admin requests all incidents
  socket.on('admin_get_incidents', () => {
    socket.emit('admin_incidents_list', Array.from(incidents.values()));
  });

  // Admin requests all user verification requests
  socket.on('admin_get_verifications', () => {
    socket.emit('admin_verifications_list', Array.from(users.values()));
  });

  // Admin approves citizen verification
  socket.on('admin_approve_user', ({ userId }) => {
    const u = users.get(userId);
    if (!u) return;

    u.status = 'VERIFIED';
    u.rejectionReason = null;
    u.verifiedAt = new Date().toISOString();
    users.set(userId, u);
    saveUsers();

    // Instant real-time push to citizen client
    io.to(`user_${userId}`).emit('user_status_changed', u);
    // Broadcast updated list to all admins
    io.emit('admin_verifications_list', Array.from(users.values()));
  });

  // Admin rejects citizen verification
  socket.on('admin_reject_user', ({ userId, reason }) => {
    const u = users.get(userId);
    if (!u) return;

    u.status = 'REJECTED';
    u.rejectionReason = reason || 'ID or selfie verification did not match or was unclear.';
    users.set(userId, u);
    saveUsers();

    // Instant real-time push to citizen client
    io.to(`user_${userId}`).emit('user_status_changed', u);
    // Broadcast updated list to all admins
    io.emit('admin_verifications_list', Array.from(users.values()));
  });

  // Rescuer requests active dispatched incident
  socket.on('rescuer_get_active', () => {
    const all = Array.from(incidents.values());
    const active = all.find(i => ['ACCEPTED', 'EN_ROUTE', 'ON_SCENE', 'RETURNING_TO_BASE'].includes(i.status));
    socket.emit('rescuer_active_incident', active || null);
  });

  // Admin accepts incident
  socket.on('admin_accept_incident', ({ incidentId }) => {
    const inc = incidents.get(incidentId);
    if (!inc) return;

    inc.status = 'ACCEPTED';
    inc.rescuerStatus = 'ASSIGNED';
    incidents.set(incidentId, inc);

    io.to(`incident_${incidentId}`).emit('incident_updated', inc);
    io.emit('admin_incident_updated', inc);
    io.emit('rescuer_active_incident', inc);
  });

  // Admin rejects incident
  socket.on('admin_reject_incident', ({ incidentId }) => {
    const inc = incidents.get(incidentId);
    if (!inc) return;

    inc.status = 'REJECTED';
    incidents.set(incidentId, inc);

    io.to(`incident_${incidentId}`).emit('incident_updated', inc);
    io.emit('admin_incident_updated', inc);
  });

  // Rescuer updates mission status (START TRAVEL -> ARRIVED -> RETURN TO BASE -> DONE)
  socket.on('rescuer_update_status', ({ incidentId, status }) => {
    const inc = incidents.get(incidentId);
    if (!inc) return;

    inc.status = status;
    inc.rescuerStatus = status;

    if (status === 'DONE') {
      inc.resolvedAt = new Date().toISOString();
    }

    incidents.set(incidentId, inc);

    io.to(`incident_${incidentId}`).emit('incident_updated', inc);
    io.emit('admin_incident_updated', inc);
    io.emit('rescuer_active_incident', inc.status === 'DONE' ? null : inc);
  });

  // High-frequency Rescuer Live GPS Telemetry
  socket.on('rescuer_telemetry_ping', ({ incidentId, lat, lng, speed, heading }) => {
    const inc = incidents.get(incidentId);
    if (inc) {
      inc.rescuerLat = parseFloat(lat);
      inc.rescuerLng = parseFloat(lng);
    }

    const payload = {
      incidentId,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      speed: speed || 0,
      heading: heading || 0,
      timestamp: Date.now()
    };

    io.to(`incident_${incidentId}`).emit('live_rescuer_position', payload);
    io.emit('admin_live_rescuer_position', payload);
  });

  // In-App Chat
  socket.on('send_chat', ({ incidentId, sender, text }) => {
    const inc = incidents.get(incidentId);
    if (!inc || !text) return;

    const message = {
      sender,
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };

    inc.messages.push(message);
    io.to(`incident_${incidentId}`).emit('receive_chat', { incidentId, message });
    io.emit('admin_receive_chat', { incidentId, message });
  });
});

// Graceful port-conflict handling
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`\n[INFO] Port ${PORT} is already in use.`);
    console.log(`[INFO] An Emergency App instance is likely already running.`);
    console.log(`[INFO] Open http://localhost:${PORT}/ in your browser to use it.`);
    console.log(`[INFO] Close this window if it is a duplicate.\n`);
    process.exit(0);
  } else {
    console.error('[SERVER ERROR]', err);
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log(`========================================================`);
  console.log(`  RESQLINK EMERGENCY & LIVE TELEMETRY ENGINE (B&W)     `);
  console.log(`  Citizen View   -> http://localhost:${PORT}/            `);
  console.log(`  Admin View     -> http://localhost:${PORT}/admin.html   `);
  console.log(`  Rescuer View   -> http://localhost:${PORT}/rescuer.html `);
  console.log(`========================================================`);
});
