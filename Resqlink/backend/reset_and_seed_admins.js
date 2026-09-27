const bcrypt = require('bcryptjs');
const { sequelize } = require('./src/config/database');
const {
  User,
  Profile,
  VerificationRequest,
  Conversation,
  Message,
  AuditLog,
  SecurityLog,
  Notification,
  ResqRequest
} = require('./src/models');

async function resetAndSeed() {
  console.log('--- RESQLINK: RESETTING ALL USERS & SEEDING REAL ADMIN ACCOUNTS ---');
  try {
    await sequelize.authenticate();
    console.log('✓ Database connected successfully.');

    // 1. Temporarily disable foreign key checks for clean wipe
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');

    console.log('-> Clearing all previous user data and dependent tables...');
    const tablesToClear = [
      'users',
      'profiles',
      'verification_requests',
      'conversations',
      'messages',
      'audit_logs',
      'security_logs',
      'notifications',
      'resq_requests'
    ];

    for (const table of tablesToClear) {
      try {
        await sequelize.query(`TRUNCATE TABLE \`${table}\`;`);
        console.log(`  ✓ Cleared table: ${table}`);
      } catch (err) {
        // Fallback delete if truncate fails
        try {
          await sequelize.query(`DELETE FROM \`${table}\`;`);
          console.log(`  ✓ Deleted rows from: ${table}`);
        } catch (innerErr) {
          console.log(`  - Table ${table} not present or skipped: ${innerErr.message}`);
        }
      }
    }

    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('✓ All previous user accounts and related data completely cleared.');

    // 2. Generate Master Password Hash
    const defaultPassword = 'Admin@123456';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    // 3. Define Official Accounts
    const accounts = [
      // Central Super Admin
      {
        email: 'superadmin@resqlink.gov.ph',
        role: 'super_admin',
        phone: '0917-100-0000',
        firstName: 'Central',
        lastName: 'Command NOC',
        city: 'Pampanga',
        headline: 'Central Command NOC Super Administrator',
        lat: 15.0250,
        lng: 120.5900,
      },

      // PORAC MUNICIPALITY
      {
        email: 'admin.porac@resqlink.gov.ph',
        role: 'admin',
        phone: '0917-200-0001',
        firstName: 'Porac',
        lastName: 'MDRRMO Admin',
        city: 'Porac',
        headline: 'MDRRMO Chief Administrator - Porac, Pampanga',
        lat: 15.0689,
        lng: 120.5400,
      },
      {
        email: 'subadmin.porac@resqlink.gov.ph',
        role: 'sub_admin',
        phone: '0917-200-0002',
        firstName: 'Porac',
        lastName: 'Duty Dispatcher',
        city: 'Porac',
        headline: 'MDRRMO Sub-Admin & Dispatch Officer - Porac, Pampanga',
        lat: 15.0689,
        lng: 120.5400,
      },

      // SANTA RITA MUNICIPALITY
      {
        email: 'admin.santarita@resqlink.gov.ph',
        role: 'admin',
        phone: '0917-300-0001',
        firstName: 'Santa Rita',
        lastName: 'MDRRMO Admin',
        city: 'Santa Rita',
        headline: 'MDRRMO Chief Administrator - Santa Rita, Pampanga',
        lat: 14.9986,
        lng: 120.6186,
      },
      {
        email: 'subadmin.santarita@resqlink.gov.ph',
        role: 'sub_admin',
        phone: '0917-300-0002',
        firstName: 'Santa Rita',
        lastName: 'Duty Dispatcher',
        city: 'Santa Rita',
        headline: 'MDRRMO Sub-Admin & Dispatch Officer - Santa Rita, Pampanga',
        lat: 14.9986,
        lng: 120.6186,
      },

      // GUAGUA MUNICIPALITY
      {
        email: 'admin.guagua@resqlink.gov.ph',
        role: 'admin',
        phone: '0917-400-0001',
        firstName: 'Guagua',
        lastName: 'MDRRMO Admin',
        city: 'Guagua',
        headline: 'MDRRMO Chief Administrator - Guagua, Pampanga',
        lat: 14.9667,
        lng: 120.6333,
      },
      {
        email: 'subadmin.guagua@resqlink.gov.ph',
        role: 'sub_admin',
        phone: '0917-400-0002',
        firstName: 'Guagua',
        lastName: 'Duty Dispatcher',
        city: 'Guagua',
        headline: 'MDRRMO Sub-Admin & Dispatch Officer - Guagua, Pampanga',
        lat: 14.9667,
        lng: 120.6333,
      },
    ];

    console.log('\n-> Provisioning new official Main Admin and Sub Admin accounts...');
    for (const acc of accounts) {
      const user = await User.create({
        email: acc.email,
        phone_number: acc.phone,
        password_hash: passwordHash,
        role: acc.role,
        is_verified: true,
        verification_status: 'approved',
        is_active: true,
      });

      await Profile.create({
        user_id: user.id,
        first_name: acc.firstName,
        last_name: acc.lastName,
        full_name: `${acc.firstName} ${acc.lastName}`,
        headline: acc.headline,
        address: `${acc.city}, Pampanga`,
        city: acc.city,
        province: 'Pampanga',
        latitude: acc.lat,
        longitude: acc.lng,
        is_verified: true,
        verification_status: 'approved',
      });

      console.log(`  ✓ Created [${acc.role.toUpperCase()}] ${acc.email} (${acc.city})`);
    }

    console.log('\n======================================================');
    console.log('✅ DATABASE RESET & ADMIN PROVISIONING COMPLETE!');
    console.log(`Default Password for all accounts: ${defaultPassword}`);
    console.log('======================================================');

    process.exit(0);
  } catch (error) {
    console.error('❌ Reset & Seed Failed:', error);
    process.exit(1);
  }
}

resetAndSeed();
