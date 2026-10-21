const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ResqInjury = sequelize.define('ResqInjury', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  resq_request_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'resq_requests',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  body_part: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  body_part_label: {
    type: DataTypes.STRING(150),
    allowNull: false,
  },
  view_orientation: {
    type: DataTypes.ENUM('front', 'back', 'both'),
    allowNull: false,
    defaultValue: 'front',
  },
  reported_by: {
    type: DataTypes.ENUM('citizen', 'admin', 'subadmin'),
    allowNull: false,
    defaultValue: 'citizen',
  },
  reporter_user_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id',
    },
    onDelete: 'SET NULL',
  },
  status: {
    type: DataTypes.ENUM('reported', 'confirmed', 'removed_by_admin'),
    allowNull: false,
    defaultValue: 'reported',
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  severity: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'resq_injuries',
  timestamps: true,
});

module.exports = ResqInjury;
