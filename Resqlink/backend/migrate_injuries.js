const { sequelize } = require('./src/config/database');

async function migrateInjuries() {
  console.log('[MIGRATION] Starting Injury Mapping schema update...');
  try {
    await sequelize.authenticate();
    console.log('✓ Database connected.');

    // 1. Check & add injury_description column to resq_requests
    const [cols] = await sequelize.query(`SHOW COLUMNS FROM resq_requests`);
    const colNames = cols.map(c => c.Field);

    if (!colNames.includes('injury_description')) {
      console.log('-> Adding injury_description column to resq_requests...');
      await sequelize.query(`ALTER TABLE resq_requests ADD COLUMN injury_description TEXT NULL AFTER resolution_notes;`);
      console.log('  ✓ Added injury_description.');
    } else {
      console.log('  ✓ injury_description column already exists in resq_requests.');
    }

    // 2. Create resq_injuries table if it does not exist
    console.log('-> Creating resq_injuries table if not exists...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS resq_injuries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        resq_request_id INT NOT NULL,
        body_part VARCHAR(100) NOT NULL,
        body_part_label VARCHAR(150) NOT NULL,
        view_orientation ENUM('front', 'back', 'both') NOT NULL DEFAULT 'front',
        reported_by ENUM('citizen', 'admin', 'subadmin') NOT NULL DEFAULT 'citizen',
        reporter_user_id INT NULL,
        status ENUM('reported', 'confirmed', 'removed_by_admin') NOT NULL DEFAULT 'reported',
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        severity VARCHAR(50) NULL,
        notes TEXT NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_resq_injuries_req (resq_request_id),
        INDEX idx_resq_injuries_body_part (body_part),
        INDEX idx_resq_injuries_active (is_active),
        CONSTRAINT fk_resq_injuries_request FOREIGN KEY (resq_request_id) REFERENCES resq_requests(id) ON DELETE CASCADE,
        CONSTRAINT fk_resq_injuries_user FOREIGN KEY (reporter_user_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('  ✓ resq_injuries table verified/created.');

    console.log('\n✅ INJURY MAPPING DATABASE MIGRATION COMPLETED SUCCESSFULLY!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

migrateInjuries();
