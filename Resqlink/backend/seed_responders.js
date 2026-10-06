const bcrypt = require('bcryptjs');
const { sequelize } = require('./src/config/database');
const { User, Profile } = require('./src/models');

async function seedResponders() {
  console.log('--- SEEDING OFFICIAL TRI-MUNICIPALITY RESPONDER UNITS ---');
  try {
    await sequelize.authenticate();
    console.log('✓ Database connected.');

    const defaultPassword = 'Responder@123';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    const responders = [
      // PORAC
      {
        email: 'medic.porac@resqlink.gov.ph',
        firstName: 'Porac',
        lastName: 'Medic Unit 1',
        phone: '0917-210-0001',
        city: 'Porac',
        department: 'Medical',
        agency: 'Medical',
        badge: 'MED-POR-01',
        unit: 'Porac EMS Ambulance 1',
        headline: 'MDRRMO Porac Emergency Medical Service',
        lat: 15.0689,
        lng: 120.5400,
      },
      {
        email: 'police.porac@resqlink.gov.ph',
        firstName: 'Porac',
        lastName: 'Police Mobile 1',
        phone: '0917-210-0002',
        city: 'Porac',
        department: 'Police',
        agency: 'Police',
        badge: 'PNP-POR-101',
        unit: 'PNP Porac Patrol Car 01',
        headline: 'PNP Porac Municipal Police Station Tactical Unit',
        lat: 15.0710,
        lng: 120.5420,
      },
      {
        email: 'fire.porac@resqlink.gov.ph',
        firstName: 'Porac',
        lastName: 'Fire Engine 1',
        phone: '0917-210-0003',
        city: 'Porac',
        department: 'Fire',
        agency: 'Fire',
        badge: 'BFP-POR-201',
        unit: 'BFP Porac Fire Engine 1',
        headline: 'BFP Porac Fire Protection & Rescue Engine',
        lat: 15.0670,
        lng: 120.5380,
      },

      // SANTA RITA
      {
        email: 'medic.santarita@resqlink.gov.ph',
        firstName: 'Sta. Rita',
        lastName: 'Medic Unit 1',
        phone: '0917-310-0001',
        city: 'Santa Rita',
        department: 'Medical',
        agency: 'Medical',
        badge: 'MED-STR-01',
        unit: 'Santa Rita EMS Ambulance 1',
        headline: 'MDRRMO Santa Rita Emergency Medical Service',
        lat: 14.9986,
        lng: 120.6186,
      },
      {
        email: 'police.santarita@resqlink.gov.ph',
        firstName: 'Sta. Rita',
        lastName: 'Police Mobile 1',
        phone: '0917-310-0002',
        city: 'Santa Rita',
        department: 'Police',
        agency: 'Police',
        badge: 'PNP-STR-101',
        unit: 'PNP Santa Rita Patrol Car 01',
        headline: 'PNP Santa Rita Police Mobile Unit',
        lat: 15.0010,
        lng: 120.6200,
      },
      {
        email: 'fire.santarita@resqlink.gov.ph',
        firstName: 'Sta. Rita',
        lastName: 'Fire Engine 1',
        phone: '0917-310-0003',
        city: 'Santa Rita',
        department: 'Fire',
        agency: 'Fire',
        badge: 'BFP-STR-201',
        unit: 'BFP Santa Rita Fire Engine 1',
        headline: 'BFP Santa Rita Fire & Rescue Service',
        lat: 14.9970,
        lng: 120.6160,
      },

      // GUAGUA
      {
        email: 'medic.guagua@resqlink.gov.ph',
        firstName: 'Guagua',
        lastName: 'Medic Unit 1',
        phone: '0917-410-0001',
        city: 'Guagua',
        department: 'Medical',
        agency: 'Medical',
        badge: 'MED-GUA-01',
        unit: 'Guagua EMS Ambulance 1',
        headline: 'MDRRMO Guagua Emergency Medical Service',
        lat: 14.9667,
        lng: 120.6333,
      },
      {
        email: 'police.guagua@resqlink.gov.ph',
        firstName: 'Guagua',
        lastName: 'Police Mobile 1',
        phone: '0917-410-0002',
        city: 'Guagua',
        department: 'Police',
        agency: 'Police',
        badge: 'PNP-GUA-101',
        unit: 'PNP Guagua Patrol Car 01',
        headline: 'PNP Guagua Police Mobile Unit',
        lat: 14.9680,
        lng: 120.6350,
      },
      {
        email: 'fire.guagua@resqlink.gov.ph',
        firstName: 'Guagua',
        lastName: 'Fire Engine 1',
        phone: '0917-410-0003',
        city: 'Guagua',
        department: 'Fire',
        agency: 'Fire',
        badge: 'BFP-GUA-201',
        unit: 'BFP Guagua Fire Engine 1',
        headline: 'BFP Guagua Fire & Rescue Engine',
        lat: 14.9650,
        lng: 120.6310,
      },
    ];

    for (const r of responders) {
      let user = await User.findOne({ where: { email: r.email } });
      if (!user) {
        user = await User.create({
          email: r.email,
          phone_number: r.phone,
          password_hash: passwordHash,
          role: 'responder',
          agency: r.agency,
          badge_or_unit_id: r.badge,
          is_verified: true,
          verification_status: 'approved',
          is_active: true,
        });

        await Profile.create({
          user_id: user.id,
          first_name: r.firstName,
          last_name: r.lastName,
          full_name: `${r.firstName} ${r.lastName}`,
          headline: r.headline,
          address: `${r.city}, Pampanga`,
          city: r.city,
          province: 'Pampanga',
          latitude: r.lat,
          longitude: r.lng,
          responder_badge_number: r.badge,
          responder_unit: r.unit,
          is_verified: true,
          verification_status: 'approved',
        });
        console.log(`  ✓ Created [${r.department.toUpperCase()}] ${r.email} (${r.city})`);
      } else {
        await user.update({
          role: 'responder',
          agency: r.agency,
          badge_or_unit_id: r.badge,
          password_hash: passwordHash,
          is_verified: true,
          verification_status: 'approved',
        });
        const profile = await Profile.findOne({ where: { user_id: user.id } });
        if (profile) {
          await profile.update({
            city: r.city,
            responder_badge_number: r.badge,
            responder_unit: r.unit,
            headline: r.headline,
          });
        }
        console.log(`  ✓ Updated [${r.department.toUpperCase()}] ${r.email} (${r.city})`);
      }
    }

    console.log('\n======================================================');
    console.log('✅ SEEDING COMPLETE FOR ALL MUNICIPALITY RESPONDERS!');
    console.log(`Default Password: ${defaultPassword}`);
    console.log('======================================================');
    if (require.main === module) {
      process.exit(0);
    }
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    if (require.main === module) {
      process.exit(1);
    }
    throw err;
  }
}

module.exports = seedResponders;

if (require.main === module) {
  seedResponders();
}
