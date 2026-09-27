const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('resqlink_db', 'root', '', {
  host: '127.0.0.1',
  dialect: 'mysql',
  logging: false,
});

async function run() {
  try {
    await sequelize.authenticate();
    console.log('Connected to MySQL to fix foreign keys...');

    // Find all foreign keys pointing to the users table
    const [results] = await sequelize.query(`
      SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE REFERENCED_TABLE_NAME = 'users' 
        AND REFERENCED_COLUMN_NAME = 'id' 
        AND TABLE_SCHEMA = 'resqlink_db';
    `);

    for (const fk of results) {
      const { TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME } = fk;
      
      console.log(`Fixing foreign key ${CONSTRAINT_NAME} on table ${TABLE_NAME}...`);
      
      // Drop the existing constraint (which is likely ON DELETE NO ACTION)
      await sequelize.query(`ALTER TABLE \`${TABLE_NAME}\` DROP FOREIGN KEY \`${CONSTRAINT_NAME}\`;`);
      
      // Re-add the constraint with ON DELETE CASCADE
      await sequelize.query(`
        ALTER TABLE \`${TABLE_NAME}\` 
        ADD CONSTRAINT \`${CONSTRAINT_NAME}_cascade\` 
        FOREIGN KEY (\`${COLUMN_NAME}\`) 
        REFERENCES \`users\`(\`id\`) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
      `);
    }

    console.log(`Successfully upgraded ${results.length} foreign keys to CASCADE on delete!`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

run();
