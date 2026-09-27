const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Profile = sequelize.define('Profile', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
  },
  first_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  last_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  avatar_url: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  headline: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  bio: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  birthdate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  address: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  full_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  pampanga_town_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  barangay: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  street: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  id_document_url: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: true,
    defaultValue: 'City of San Fernando',
  },
  province: {
    type: DataTypes.STRING(100),
    allowNull: true,
    defaultValue: 'Pampanga',
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: true,
    defaultValue: 15.0343,
  },
  longitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: true,
    defaultValue: 120.6843,
  },
  skills: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
  },
  hourly_rate: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 100.00,
  },
  daily_rate: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 600.00,
  },
  availability_status: {
    type: DataTypes.ENUM('available', 'busy', 'hired'),
    defaultValue: 'available',
  },
  resume_url: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  certifications: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
  },
  years_experience: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  average_rating: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0.0,
  },
  total_reviews: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  completed_jobs_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  // Emergency Health & Safety Metadata
  blood_type: {
    type: DataTypes.STRING(10),
    allowNull: true,
    defaultValue: 'Unknown',
  },
  medical_conditions: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
  },
  special_needs: {
    type: DataTypes.STRING(100),
    allowNull: true,
    defaultValue: 'None',
  },
  household_count: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  household_infants: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  household_seniors: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  emergency_contact_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  emergency_contact_phone: {
    type: DataTypes.STRING(25),
    allowNull: true,
  },
  emergency_contact_relation: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  responder_badge_number: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  responder_unit: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
}, {
  tableName: 'profiles',
});

module.exports = Profile;
