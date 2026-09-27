const { sequelize } = require('./src/config/database');

async function migrate() {
  console.log('[MIGRATION] Starting Emergency Flow database schema update...');
  try {
    await sequelize.authenticate();
    console.log('✓ Database connected.');

    // 1. Update status ENUM in resq_requests
    console.log('-> Updating resq_requests status ENUM column...');
    await sequelize.query(`
      ALTER TABLE resq_requests 
      MODIFY COLUMN status ENUM(
        'Pending', 'Assigned', 'Accepted', 'Validated', 'Responder Dispatched', 'Dispatched', 
        'En Route', 'On Scene', 'Arrived', 'In Progress', 'Resolved', 'Completed', 
        'Cancelled', 'Closed'
      ) NOT NULL DEFAULT 'Pending'
    `);
    console.log('  ✓ Updated status ENUM in resq_requests.');

    // 2. Add columns if not exist
    const [cols] = await sequelize.query(`SHOW COLUMNS FROM resq_requests`);
    const colNames = cols.map(c => c.Field);

    if (!colNames.includes('assigned_department')) {
      console.log('-> Adding assigned_department to resq_requests...');
      await sequelize.query(`ALTER TABLE resq_requests ADD COLUMN assigned_department VARCHAR(50) DEFAULT 'Medical' AFTER target_agency;`);
      console.log('  ✓ Added assigned_department.');
    }

    if (!colNames.includes('arrived_at')) {
      console.log('-> Adding arrived_at to resq_requests...');
      await sequelize.query(`ALTER TABLE resq_requests ADD COLUMN arrived_at DATETIME NULL AFTER on_scene_at;`);
      console.log('  ✓ Added arrived_at.');
    }

    if (!colNames.includes('completed_at')) {
      console.log('-> Adding completed_at to resq_requests...');
      await sequelize.query(`ALTER TABLE resq_requests ADD COLUMN completed_at DATETIME NULL AFTER resolved_at;`);
      console.log('  ✓ Added completed_at.');
    }

    // 3. Update users role ENUM
    console.log('-> Updating users role ENUM column...');
    await sequelize.query(`
      ALTER TABLE users 
      MODIFY COLUMN role ENUM(
        'citizen', 'mdrrmo_admin', 'pnp_responder', 'bfp_responder', 
        'super_admin', 'admin', 'sub_admin', 'user', 'responder'
      ) NOT NULL DEFAULT 'citizen'
    `);
    console.log('  ✓ Updated users role ENUM.');

    // 4. Update users agency ENUM
    console.log('-> Updating users agency ENUM column...');
    await sequelize.query(`
      ALTER TABLE users 
      MODIFY COLUMN agency ENUM(
        'MDRRMO', 'PNP', 'BFP', 'CITIZEN', 'NONE', 'Medical', 'Police', 'Fire', 'Rescue'
      ) DEFAULT 'CITIZEN'
    `);
    console.log('  ✓ Updated users agency ENUM.');

    console.log('\n✅ RESQLINK EMERGENCY FLOW MIGRATION COMPLETED SUCCESSFULLY!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
