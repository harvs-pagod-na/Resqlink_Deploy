const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const VerificationRequest = sequelize.define('VerificationRequest', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  id_type: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  extracted_id_num: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  extracted_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  id_image_url: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  id_back_image: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  live_selfie_url: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  business_permit_image: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  ocr_extracted_data: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  facial_match_score: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 0,
  },
  quality_score: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 0,
  },
  duplicate_flag: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  ai_confidence: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  ai_recommendation: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('PENDING_ADMIN_APPROVAL', 'APPROVED', 'REJECTED'),
    defaultValue: 'PENDING_ADMIN_APPROVAL',
  },
  admin_notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'verification_requests',
  timestamps: true,
});

module.exports = VerificationRequest;