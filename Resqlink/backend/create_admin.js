const bcrypt = require('bcryptjs');
const { User, Profile } = require('./src/models');
const { sequelize } = require('./src/config/database');

async function createSuperAdmin() {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully.');

    const email = process.argv[2] || 'admin@resqlink.gov.ph';
    const password = process.argv[3] || 'admin123';
    const firstName = process.argv[4] || 'Super';
    const lastName = process.argv[5] || 'Admin';

    const hashedPassword = await bcrypt.hash(password, 10);

    let user = await User.findOne({ where: { email } });

    if (user) {
      console.log(`User ${email} found! Updating role to super_admin...`);
      await user.update({
        role: 'super_admin',
        password_hash: hashedPassword,
        is_verified: true,
        verification_status: 'approved',
        account_status: 'ACTIVE'
      });
      console.log(`✅ User ${email} has been updated to Super Admin with password: "${password}"`);
    } else {
      user = await User.create({
        email,
        password_hash: hashedPassword,
        role: 'super_admin',
        is_verified: true,
        verification_status: 'approved',
        account_status: 'ACTIVE'
      });

      await Profile.create({
        user_id: user.id,
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`,
        headline: 'System Administrator'
      });

      console.log(`✅ Super Admin created successfully!`);
      console.log(`Email: ${email}`);
      console.log(`Password: ${password}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to create Super Admin:', error);
    process.exit(1);
  }
}

createSuperAdmin();
