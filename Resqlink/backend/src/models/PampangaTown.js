const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PampangaTown = sequelize.define('PampangaTown', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  town_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
  },
  zip_code: {
    type: DataTypes.STRING(10),
    allowNull: true,
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
}, {
  tableName: 'pampanga_towns',
  timestamps: true,
});

module.exports = PampangaTown;
