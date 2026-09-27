const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ResqRequest = sequelize.define('ResqRequest', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  uuid: {
    type: DataTypes.STRING,
    defaultValue: DataTypes.UUIDV4,
    allowNull: false,
    unique: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  reporter_name: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
  contact_number: {
    type: DataTypes.STRING(25),
    allowNull: true,
  },
  emergency_type: {
    type: DataTypes.ENUM('Fire', 'Crime/Police', 'Medical', 'Flood/Disaster', 'Accident', 'Evacuation', 'Other'),
    allowNull: false,
    defaultValue: 'Medical',
  },
  severity_level: {
    type: DataTypes.ENUM('Critical', 'High', 'Moderate', 'Low'),
    allowNull: false,
    defaultValue: 'High',
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: false,
  },
  longitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: false,
  },
  municipality: {
    type: DataTypes.STRING(100),
    allowNull: false,
    defaultValue: 'Porac',
  },
  barangay: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  address_location: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  landmark: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  photo_url: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  target_agency: {
    type: DataTypes.ENUM('MDRRMO', 'PNP', 'BFP', 'Multi-Agency', 'Unassigned'),
    allowNull: false,
    defaultValue: 'MDRRMO',
  },
  assigned_department: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: 'Medical',
  },
  status: {
    type: DataTypes.ENUM('Pending', 'Assigned', 'Accepted', 'Validated', 'Responder Dispatched', 'Dispatched', 'En Route', 'On Scene', 'Arrived', 'In Progress', 'Resolved', 'Completed', 'Cancelled', 'Closed'),
    defaultValue: 'Pending',
  },
  is_verified_incident: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  assigned_subadmin_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  assigned_sector: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  subadmin_confirmed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  subadmin_notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  assigned_responder_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  assigned_agency: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  responder_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  responder_phone: {
    type: DataTypes.STRING(25),
    allowNull: true,
  },
  responder_unit: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  responder_lat: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: true,
  },
  responder_lng: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: true,
  },
  dispatcher_notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  resolution_notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  reported_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  validated_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  dispatched_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  en_route_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  on_scene_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  arrived_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  resolved_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  closed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  response_duration_seconds: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
}, {
  tableName: 'resq_requests',
  timestamps: true,
});

module.exports = ResqRequest;
