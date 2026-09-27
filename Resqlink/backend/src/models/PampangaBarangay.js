const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PampangaBarangay = sequelize.define('PampangaBarangay', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  town_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  barangay_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
}, {
  tableName: 'pampanga_barangays',
  timestamps: true,
});

module.exports = PampangaBarangay;
