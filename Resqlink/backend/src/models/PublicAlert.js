const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PublicAlert = sequelize.define('PublicAlert', {
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
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  severity: {
    type: DataTypes.ENUM('Low', 'Advisory', 'Moderate', 'High', 'Critical'),
    allowNull: false,
    defaultValue: 'High',
  },
  alert_type: {
    type: DataTypes.ENUM('Typhoon/Flood', 'Fire Hazard', 'Earthquake', 'Road Advisory', 'Public Safety', 'Health Advisory', 'General Announcement'),
    allowNull: false,
    defaultValue: 'General Announcement',
  },
  target_barangay: {
    type: DataTypes.STRING(100),
    allowNull: false,
    defaultValue: 'All Porac',
  },
  target_municipality: {
    type: DataTypes.STRING(100),
    allowNull: false,
    defaultValue: 'Porac',
  },
  author_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  author_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    defaultValue: 'MDRRMO Porac Command',
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  published_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'public_alerts',
  timestamps: true,
});

module.exports = PublicAlert;
