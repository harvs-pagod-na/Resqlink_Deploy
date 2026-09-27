const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
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
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
  phone_number: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  password_hash: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM(
      'citizen',
      'mdrrmo_admin',
      'pnp_responder',
      'bfp_responder',
      'super_admin',
      'admin',
      'sub_admin',
      'user',
      'responder'
    ),
    allowNull: false,
    defaultValue: 'citizen',
  },
  agency: {
    type: DataTypes.ENUM('MDRRMO', 'PNP', 'BFP', 'CITIZEN', 'NONE', 'Medical', 'Police', 'Fire', 'Rescue'),
    defaultValue: 'CITIZEN',
  },
  badge_or_unit_id: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  is_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  verification_status: {
    type: DataTypes.ENUM('unverified', 'pending_ai', 'pending_admin', 'approved', 'rejected'),
    defaultValue: 'unverified',
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  failed_login_attempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  lockout_until: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  last_login_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  refresh_token: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  account_status: {
    type: DataTypes.ENUM('ACTIVE', 'SUSPENDED', 'BLOCKED'),
    defaultValue: 'ACTIVE',
  },
  penalty_balance: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
  },
  suspension_ends_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'users',
});

module.exports = User;
