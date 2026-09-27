const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  sender_id: {
    type: DataTypes.INTEGER,
    allowNull: true, // null if system-generated
  },
  receiver_id: {
    type: DataTypes.INTEGER,
    allowNull: true, // null if broadcast targeting group
  },
  target_group: {
    type: DataTypes.ENUM('all', 'responders', 'citizens', 'specific'),
    defaultValue: 'specific',
  },
  type: {
    type: DataTypes.ENUM('broadcast', 'booking_update', 'system_alert', 'important_activity'),
    defaultValue: 'broadcast',
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  booking_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  is_read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  tableName: 'notifications',
  timestamps: true,
});

module.exports = Notification;
