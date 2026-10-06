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
sequelize.sync().then(async () => {
  if (process.env.AUTO_SEED === 'true') {
    try {
      const { User } = require('./models');
      const count = await User.count();
      if (count === 0) {
        console.log('[AUTO-SEED] Fresh database detected. Seeding official accounts...');
        const path = require('path');
        require(path.join(__dirname, '../reset_and_seed_admins'));
      }
    } catch (seedErr) {
      console.warn('[AUTO-SEED NOTICE]', seedErr.message);
    }
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('[DB SYNC WARNING]', err.message);
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT} (with DB sync warning)`);
  });
});