const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PAMPANGA_MUNICIPALITIES = [
  'Angeles City',
  'City of San Fernando',
  'Mabalacat City',
  'Apalit',
  'Arayat',
  'Bacolor',
  'Candaba',
  'Floridablanca',
  'Guagua',
  'Lubao',
  'Macabebe',
  'Masantol',
  'Mexico',
  'Minalin',
  'Porac',
  'San Luis',
  'San Simon',
  'Santa Ana',
  'Santa Rita',
  'Santo Tomas',
  'Sasmuan',
];

const PampangaLocation = sequelize.define('PampangaLocation', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  municipality: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  barangay: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  postal_code: {
    type: DataTypes.STRING(10),
    allowNull: true,
  },
}, {
  tableName: 'pampanga_locations',
  timestamps: true,
});

PampangaLocation.PAMPANGA_MUNICIPALITIES = PAMPANGA_MUNICIPALITIES;

PampangaLocation.isValidPampangaTown = (townName) => {
  if (!townName) return false;
  const normalized = townName.trim().toLowerCase();
  return PAMPANGA_MUNICIPALITIES.some((m) =>
    normalized.includes(m.toLowerCase()) || m.toLowerCase().includes(normalized)
  );
};

module.exports = PampangaLocation;
