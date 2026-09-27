const { sequelize } = require('../config/database');
const User = require('./User');
const Profile = require('./Profile');
const VerificationRequest = require('./VerificationRequest');
const Conversation = require('./Conversation');
const Message = require('./Message');
const AuditLog = require('./AuditLog');
const SecurityLog = require('./SecurityLog');
const PampangaLocation = require('./PampangaLocation');
const PampangaTown = require('./PampangaTown');
const PampangaBarangay = require('./PampangaBarangay');
const Notification = require('./Notification');
const ResqRequest = require('./ResqRequest');
const PublicAlert = require('./PublicAlert');
const IncidentTrackingLog = require('./IncidentTrackingLog');

// ─── ResQLink Core Associations ───────────────────────────────────
User.hasMany(ResqRequest, { foreignKey: 'user_id', as: 'resq_requests', onDelete: 'CASCADE' });
ResqRequest.belongsTo(User, { foreignKey: 'user_id', as: 'requester', onDelete: 'CASCADE' });
ResqRequest.belongsTo(User, { foreignKey: 'assigned_responder_id', as: 'assigned_responder', onDelete: 'SET NULL' });
ResqRequest.belongsTo(User, { foreignKey: 'assigned_subadmin_id', as: 'assigned_subadmin', onDelete: 'SET NULL' });

ResqRequest.hasMany(IncidentTrackingLog, { foreignKey: 'incident_id', as: 'tracking_logs', onDelete: 'CASCADE' });
IncidentTrackingLog.belongsTo(ResqRequest, { foreignKey: 'incident_id', as: 'incident', onDelete: 'CASCADE' });
IncidentTrackingLog.belongsTo(User, { foreignKey: 'actor_id', as: 'actor', onDelete: 'SET NULL' });

User.hasMany(PublicAlert, { foreignKey: 'author_id', as: 'authored_alerts', onDelete: 'SET NULL' });
PublicAlert.belongsTo(User, { foreignKey: 'author_id', as: 'author', onDelete: 'SET NULL' });

// ─── General Associations ─────────────────────────────────────────
Notification.belongsTo(User, { foreignKey: 'sender_id', as: 'sender', onDelete: 'CASCADE' });
Notification.belongsTo(User, { foreignKey: 'receiver_id', as: 'receiver', onDelete: 'CASCADE' });
User.hasMany(Notification, { foreignKey: 'receiver_id', as: 'notifications', onDelete: 'CASCADE' });

User.hasOne(Profile, { foreignKey: 'user_id', as: 'profile', onDelete: 'CASCADE' });
Profile.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(VerificationRequest, { foreignKey: 'user_id', as: 'verification_requests', onDelete: 'CASCADE' });
VerificationRequest.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Conversation.belongsTo(User, { foreignKey: 'participant1_id', as: 'participant1', onDelete: 'CASCADE' });
Conversation.belongsTo(User, { foreignKey: 'participant2_id', as: 'participant2', onDelete: 'CASCADE' });

Conversation.hasMany(Message, { foreignKey: 'conversation_id', as: 'messages', onDelete: 'CASCADE' });
Message.belongsTo(Conversation, { foreignKey: 'conversation_id', as: 'conversation' });

Message.belongsTo(User, { foreignKey: 'sender_id', as: 'sender', onDelete: 'CASCADE' });
Message.belongsTo(User, { foreignKey: 'receiver_id', as: 'receiver', onDelete: 'CASCADE' });

AuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'user', onDelete: 'CASCADE' });
PampangaTown.hasMany(PampangaBarangay, { foreignKey: 'town_id', as: 'barangays', onDelete: 'CASCADE' });
PampangaBarangay.belongsTo(PampangaTown, { foreignKey: 'town_id', as: 'town' });

Profile.belongsTo(PampangaTown, { foreignKey: 'pampanga_town_id', as: 'pampanga_town' });

module.exports = {
  sequelize,
  User,
  Profile,
  VerificationRequest,
  Conversation,
  Message,
  AuditLog,
  SecurityLog,
  PampangaLocation,
  PampangaTown,
  PampangaBarangay,
  Notification,
  ResqRequest,
  PublicAlert,
  IncidentTrackingLog,
};
