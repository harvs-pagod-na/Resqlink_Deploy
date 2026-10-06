const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const rawUri = process.env.DATABASE_URL || process.env.MYSQL_URL;
let dbName = process.env.DB_NAME || 'resqlink_db';
let dbUser = process.env.DB_USER || 'root';
let dbPass = process.env.DB_PASS || '';
let dbHost = process.env.DB_HOST || '127.0.0.1';
let dbPort = parseInt(process.env.DB_PORT || '3306', 10);

if (rawUri) {
  try {
    const parsed = new URL(rawUri.replace(/^mysql:\/\//i, 'http://'));
    dbHost = parsed.hostname || dbHost;
    dbPort = parsed.port ? parseInt(parsed.port, 10) : 3306;
    if (parsed.username) dbUser = decodeURIComponent(parsed.username);
    if (parsed.password) dbPass = decodeURIComponent(parsed.password);

    const cleanPath = (parsed.pathname || '').replace(/^\/+/, '');
    if (cleanPath && cleanPath !== 'sys') {
      dbName = cleanPath;
    } else {
      // TiDB Cloud default writable database is 'test'
      dbName = 'test';
    }
  } catch (err) {
    console.warn('[DB URL PARSE NOTICE]', err.message);
  }
}

const isRemote = (dbHost && dbHost !== '127.0.0.1' && dbHost !== 'localhost') || !!rawUri;
const enableSSL = process.env.DB_SSL === 'true' || (isRemote && process.env.DB_SSL !== 'false');

const dialectOptions = enableSSL ? {
  ssl: {
    require: true,
    rejectUnauthorized: false,
  },
} : {};

const sequelize = new Sequelize(dbName, dbUser, dbPass, {
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

module.exports = { sequelize, dbName, dbUser, dbPass, dbHost, dbPort };
