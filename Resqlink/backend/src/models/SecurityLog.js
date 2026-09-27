const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SecurityLog = sequelize.define('SecurityLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  event_type: {
    type: DataTypes.ENUM('login_success', 'login_failed', 'account_locked', 'password_change', 'unauthorized_access'),
    allowNull: false,
  },
  ip_address: {
    type: DataTypes.STRING(45),
    allowNull: true,
  },
  details: {
    type: DataTypes.JSON,
    allowNull: true,
  },
}, {
  tableName: 'security_logs',
  updatedAt: false,
});

module.exports = SecurityLog;
