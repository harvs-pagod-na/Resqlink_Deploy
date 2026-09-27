const { sequelize } = require('./src/models');

async function migrate() {
  try {
    console.log('[MIGRATION] Updating resq_requests status ENUM column...');
    await sequelize.query(`
      ALTER TABLE resq_requests 
      MODIFY COLUMN status ENUM(
        'Pending', 'Accepted', 'Validated', 'Responder Dispatched', 'Dispatched', 
        'En Route', 'On Scene', 'Arrived', 'In Progress', 'Resolved', 'Completed', 
        'Cancelled', 'Closed'
      ) NOT NULL DEFAULT 'Pending'
    `);
    console.log('✅ Successfully updated status ENUM in resq_requests!');
  } catch(e) {
    console.error('❌ Migration error:', e);
  } finally {
    process.exit(0);
  }
}

migrate();
