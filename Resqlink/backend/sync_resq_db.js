const { sequelize, User, ResqRequest, PublicAlert, IncidentTrackingLog } = require('./src/models');

async function syncDatabase() {
  try {
    console.log('[DB MIGRATION] Connecting to database...');
    await sequelize.authenticate();
    console.log('[DB MIGRATION] Connected successfully. Syncing tables with alter: true...');
    
    // Sync models
    await User.sync({ alter: true });
    await ResqRequest.sync({ alter: true });
    await PublicAlert.sync({ alter: true });
    await IncidentTrackingLog.sync({ alter: true });

    console.log('[DB MIGRATION] All ResQLink tables synchronized successfully!');
    process.exit(0);
  } catch (error) {
    console.error('[DB MIGRATION ERROR]', error);
    process.exit(1);
  }
}

syncDatabase();
