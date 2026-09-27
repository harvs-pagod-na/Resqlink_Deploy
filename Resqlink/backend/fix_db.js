const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('resqlink_db', 'root', '', {
  host: '127.0.0.1',
  dialect: 'mysql',
  logging: false,
});

async function run() {
  try {
    await sequelize.authenticate();
    console.log('Connected to MySQL.');

    const [indexes] = await sequelize.query('SHOW INDEX FROM users;');
    
    // Group indexes by Key_name
    const keyNames = [...new Set(indexes.map(idx => idx.Key_name))];

    let dropped = 0;
    for (const key of keyNames) {
      if (key !== 'PRIMARY' && (key.includes('uuid') || key.includes('email'))) {
        console.log(`Dropping index: ${key}`);
        await sequelize.query(`ALTER TABLE users DROP INDEX \`${key}\`;`);
        dropped++;
      }
    }

    console.log(`Successfully dropped ${dropped} duplicate keys from users table.`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

run();
