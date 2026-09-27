const mysql = require('mysql2/promise');
const { sequelize, dbHost, dbPort, dbUser, dbPass, dbName } = require('../config/database');
const models = require('../models');

async function runMigration() {
  console.log('[MIGRATE] Connecting to MySQL server...');
  try {
    const connection = await mysql.createConnection({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPass,
    });

    console.log(`[MIGRATE] Re-creating database "${dbName}"...`);
    await connection.query('SET FOREIGN_KEY_CHECKS = 0;');
    await connection.query(`DROP DATABASE IF EXISTS \`${dbName}\`;`);
    await connection.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.query('SET FOREIGN_KEY_CHECKS = 1;');
    await connection.end();

    console.log('[MIGRATE] Synchronizing Sequelize models with MySQL...');
    await sequelize.authenticate();
    await sequelize.sync({ force: true });
    console.log('[MIGRATE] Database migration completed successfully!');
  } catch (error) {
    console.error('[MIGRATE] Migration failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  runMigration().then(() => process.exit(0));
}

module.exports = runMigration;
