const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const rawUri = process.env.DATABASE_URL || process.env.MYSQL_URL;
let connectionUri = rawUri;

if (connectionUri) {
  try {
    const parsed = new URL(connectionUri.replace(/^mysql:\/\//i, 'http://'));
    if (!parsed.pathname || parsed.pathname === '/' || parsed.pathname === '/sys') {
      // TiDB Cloud pre-creates the 'test' database for user tables
      parsed.pathname = '/test';
      connectionUri = parsed.toString().replace(/^http:\/\//i, 'mysql://');
    }
  } catch (e) {
    // Keep raw URI
  }
}

const isRemote = (process.env.DB_HOST && process.env.DB_HOST !== '127.0.0.1' && process.env.DB_HOST !== 'localhost') || !!connectionUri;
const enableSSL = process.env.DB_SSL === 'true' || (isRemote && process.env.DB_SSL !== 'false');

const dialectOptions = enableSSL ? {
  ssl: {
    require: true,
    rejectUnauthorized: false,
  },
} : {};

let sequelize;

if (connectionUri) {
  sequelize = new Sequelize(connectionUri, {
    dialect: 'mysql',
    logging: false,
    dialectOptions,
    pool: {
      max: 20,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    define: {
      timestamps: true,
      underscored: false,
    },
  });
} else {
  const dbName = process.env.DB_NAME || 'resqlink_db';
  const dbUser = process.env.DB_USER || 'root';
  const dbPass = process.env.DB_PASS || '';
  const dbHost = process.env.DB_HOST || '127.0.0.1';
  const dbPort = process.env.DB_PORT || 3306;

  sequelize = new Sequelize(dbName, dbUser, dbPass, {
    host: dbHost,
    port: dbPort,
    dialect: 'mysql',
    logging: false,
    dialectOptions,
    pool: {
      max: 20,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    define: {
      timestamps: true,
      underscored: false,
    },
  });
}

const dbName = process.env.DB_NAME || 'resqlink_db';
const dbUser = process.env.DB_USER || 'root';
const dbPass = process.env.DB_PASS || '';
const dbHost = process.env.DB_HOST || '127.0.0.1';
const dbPort = process.env.DB_PORT || 3306;

module.exports = { sequelize, dbName, dbUser, dbPass, dbHost, dbPort };
