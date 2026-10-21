const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('express-async-errors');
const dotenv = require('dotenv');

dotenv.config();

const { sequelize } = require('./config/database');
const initSocket = require('./socket');
const { apiLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/authRoutes');
const verificationRoutes = require('./routes/verificationRoutes');
const chatRoutes = require('./routes/chatRoutes');
const adminRoutes = require('./routes/adminRoutes');
const profileRoutes = require('./routes/profileRoutes');
const userRoutes = require('./routes/userRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const resqRoutes = require('./routes/resqRoutes');
const alertRoutes = require('./routes/alertRoutes');

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = initSocket(server);
app.set('io', io);

// Security & Base Middleware
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(morgan('dev'));

// Rate Limiter
app.use('/api/', apiLimiter);

// Serve Uploaded Media Files
const uploadsDir = path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsDir));

// Root & Health Check Endpoints
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'RESQLINK Emergency Response System - API Backend',
    version: '1.0.0',
    documentation: '/api/health',
    time: new Date().toISOString()
  });
});

app.get(['/health', '/api/health'], (req, res) => {
  res.json({ status: 'ok', service: 'RESQLINK Backend', time: new Date().toISOString() });
});

// API Endpoint Routes
const uploadMiddleware = require('./middleware/upload');
const authController = require('./controllers/authController');

const crossMatchFields = uploadMiddleware.fields([
  { name: 'id_front', maxCount: 1 },
  { name: 'id_back', maxCount: 1 },
  { name: 'id_file', maxCount: 1 },
]);

app.post('/api/register/cross-match-identity', crossMatchFields, authController.crossMatchIdentity);
app.post('/api/auth/register/cross-match-identity', crossMatchFields, authController.crossMatchIdentity);

app.use('/api/auth', authRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/resq', resqRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);

app.use(errorHandler);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`[INFO] Server port ${PORT} is already running in another window.`);
  } else {
    console.error('[SERVER ERROR]', err);
  }
});

const PORT = process.env.PORT || 3000;

async function bootstrapServer() {
  try {
    await sequelize.authenticate();
    console.log('[DB] Database connection established successfully.');

    // Ensure we are working inside a writable schema rather than the read-only 'sys' schema
    try {
      const [results] = await sequelize.query('SELECT DATABASE() AS current_db;');
      const currentDb = results[0]?.current_db;
      console.log(`[DB] Connected database schema: ${currentDb}`);
      if (!currentDb || currentDb === 'sys') {
        console.log('[DB] Detected system schema. Switching to writable database...');
        try {
          await sequelize.query('CREATE DATABASE IF NOT EXISTS `resqlink_db`;');
          await sequelize.query('USE `resqlink_db`;');
        } catch (_) {
          await sequelize.query('USE `test`;');
        }
      }
    } catch (schemaErr) {
      console.warn('[DB NOTICE] Schema verification:', schemaErr.message);
    }

    // Synchronize all database models
    await sequelize.sync();
    console.log('[DB] Database models synchronized successfully.');

    // Auto-migrate schema updates on boot to ensure cloud DB has all columns
    try {
      const [cols] = await sequelize.query("SHOW COLUMNS FROM resq_requests;");
      const existingColNames = Array.isArray(cols) ? cols.map(c => c.Field) : [];

      const columnsToEnsure = [
        { name: 'assigned_subadmin_id', type: 'INT NULL' },
        { name: 'assigned_sector', type: 'VARCHAR(100) NULL' },
        { name: 'subadmin_confirmed_at', type: 'DATETIME NULL' },
        { name: 'subadmin_notes', type: 'TEXT NULL' },
        { name: 'assigned_department', type: 'VARCHAR(50) NULL' },
        { name: 'is_verified_incident', type: 'TINYINT(1) DEFAULT 0' },
        { name: 'assigned_agency', type: 'VARCHAR(50) NULL' },
        { name: 'dispatcher_notes', type: 'TEXT NULL' },
        { name: 'resolution_notes', type: 'TEXT NULL' },
        { name: 'injury_description', type: 'TEXT NULL' },
        { name: 'validated_at', type: 'DATETIME NULL' },
        { name: 'dispatched_at', type: 'DATETIME NULL' },
        { name: 'en_route_at', type: 'DATETIME NULL' },
        { name: 'on_scene_at', type: 'DATETIME NULL' },
        { name: 'arrived_at', type: 'DATETIME NULL' },
        { name: 'completed_at', type: 'DATETIME NULL' },
        { name: 'closed_at', type: 'DATETIME NULL' },
        { name: 'response_duration_seconds', type: 'INT NULL' },
      ];

      for (const col of columnsToEnsure) {
        if (!existingColNames.includes(col.name)) {
          console.log(`[DB MIGRATION] Adding missing column '${col.name}' to resq_requests...`);
          try {
            await sequelize.query(`ALTER TABLE resq_requests ADD COLUMN ${col.name} ${col.type};`);
            console.log(`[DB MIGRATION] ✓ Added column '${col.name}' successfully.`);
          } catch (colErr) {
            console.warn(`[DB MIGRATION NOTICE] Could not add '${col.name}':`, colErr.message);
          }
        }
      }

      // Ensure resq_injuries table exists
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS resq_injuries (
          id INT AUTO_INCREMENT PRIMARY KEY,
          resq_request_id INT NOT NULL,
          body_part VARCHAR(100) NOT NULL,
          body_part_label VARCHAR(150) NOT NULL,
          view_orientation ENUM('front', 'back', 'both') NOT NULL DEFAULT 'front',
          reported_by ENUM('citizen', 'admin', 'subadmin') NOT NULL DEFAULT 'citizen',
          reporter_user_id INT NULL,
          status ENUM('reported', 'confirmed', 'removed_by_admin') NOT NULL DEFAULT 'reported',
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          severity VARCHAR(50) NULL,
          notes TEXT NULL,
          createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_resq_injuries_req (resq_request_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `).catch(() => {});
    } catch (migErr) {
      console.warn('[DB MIGRATION NOTICE] resq_requests column check:', migErr.message);
    }

    // Auto-seed if database has no accounts or AUTO_SEED is enabled
    try {
      const { User } = require('./models');
      const userCount = await User.count().catch(() => 0);
      if (userCount === 0 || process.env.AUTO_SEED === 'true') {
        console.log('[AUTO-SEED] Seeding official admin accounts and responder units...');
        const resetAndSeed = require('../reset_and_seed_admins');
        const seedResponders = require('../seed_responders');
        await resetAndSeed().catch(err => console.warn('[AUTO-SEED] Admin seed notice:', err.message));
        await seedResponders().catch(err => console.warn('[AUTO-SEED] Responder seed notice:', err.message));
      }
    } catch (seedErr) {
      console.warn('[AUTO-SEED WARNING]', seedErr.message);
    }
  } catch (err) {
    console.error('[DB BOOTSTRAP WARNING]', err.message);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

bootstrapServer();