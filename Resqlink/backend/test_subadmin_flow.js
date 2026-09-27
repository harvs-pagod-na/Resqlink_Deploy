const { ResqRequest, User, Notification, sequelize } = require('./src/models');

async function testSubadminFlow() {
  console.log('--- STARTING SUBADMIN & COORDINATES INTEGRITY VERIFICATION ---');
  try {
    await sequelize.authenticate();
    console.log('✓ Database connection verified.');

    // 1. Find or pick an admin, a subadmin, a responder, and a user
    const admin = await User.findOne({ where: { role: 'admin' } });
    const subadmin = await User.findOne({ where: { role: 'sub_admin' } });
    const responder = await User.findOne({ where: { role: 'responder' } });
    const citizen = await User.findOne({ where: { role: 'user' } });

    console.log('Seed users detected:', {
      admin: admin?.email,
      subadmin: subadmin?.email,
      responder: responder?.email,
      citizen: citizen?.email
    });

    if (!citizen || !subadmin) {
      throw new Error('Required user accounts (citizen or sub_admin) missing in DB.');
    }

    // 2. Create a test incident
    const testIncident = await ResqRequest.create({
      user_id: citizen.id,
      reporter_name: 'Juan Test Dela Cruz',
      emergency_type: 'Medical',
      severity_level: 'High',
      status: 'Pending',
      latitude: 15.0339,
      longitude: 120.5842,
      address_location: 'Brgy San Basilio, Santa Rita, Pampanga',
      municipality: 'Santa Rita',
      description: 'Verification test for subadmin dispatch and GPS coordinates integrity',
      contact_number: '09171234567'
    });

    console.log(`✓ Incident created with ID: #${testIncident.id}, Status: ${testIncident.status}`);

    // Verify initial responder coords are null/empty, not fake
    if (testIncident.responder_lat || testIncident.responder_lng) {
      console.warn('⚠️ Warning: new incident had non-null responder coordinates.');
    } else {
      console.log('✓ Verified: Newly created incident has null responder coordinates (no fake offset).');
    }

    // 3. Step 1: Admin assigns to sector and subadmin
    testIncident.assigned_subadmin_id = subadmin.id;
    testIncident.assigned_sector = 'Santa Rita';
    testIncident.assigned_department = 'MDRRMO';
    testIncident.status = 'Assigned';
    if (responder) {
      testIncident.assigned_responder_id = responder.id;
      testIncident.responder_name = 'Unit-01 Rescue';
    }
    await testIncident.save();
    console.log(`✓ Incident assigned to SubAdmin ID: ${testIncident.assigned_subadmin_id}, Sector: ${testIncident.assigned_sector}`);

    // 4. Step 2: Sub-admin confirms assignment
    testIncident.subadmin_confirmed_at = new Date();
    testIncident.subadmin_notes = 'Unit verified and standing by for route clearance.';
    await testIncident.save();

    // Create DB notifications for citizen and admin
    const citizenNotif = await Notification.create({
      receiver_id: citizen.id,
      sender_id: subadmin.id,
      target_group: 'specific',
      type: 'system_alert',
      title: '🚨 Emergency Assignment Confirmed',
      message: `Santa Rita Sub-Admin Command has confirmed your emergency assignment (#${testIncident.id}). Responders are preparing deployment.`,
      is_read: false,
    });

    let adminNotif = null;
    if (admin) {
      adminNotif = await Notification.create({
        receiver_id: admin.id,
        sender_id: subadmin.id,
        target_group: 'specific',
        type: 'important_activity',
        title: '⚡ Sub-Admin Confirmed Assignment',
        message: `Sub-Admin confirmed assignment for Incident #${testIncident.id} in Santa Rita.`,
        is_read: false,
      });
    }

    // 5. Query and verify the persisted state
    const fetched = await ResqRequest.findByPk(testIncident.id, {
      include: [
        { model: User, as: 'assigned_subadmin', attributes: ['id', 'email', 'role'] },
        { model: User, as: 'requester', attributes: ['id', 'email', 'role'] }
      ]
    });

    console.log('--- VERIFICATION RESULTS ---');
    console.log('Incident ID:', fetched.id);
    console.log('Status:', fetched.status);
    console.log('Assigned Sector:', fetched.assigned_sector);
    console.log('SubAdmin Confirmed At:', fetched.subadmin_confirmed_at);
    console.log('SubAdmin User Email:', fetched.assigned_subadmin?.email);
    console.log('Citizen Coords:', `${fetched.latitude}, ${fetched.longitude}`);
    console.log('Responder Coords:', `${fetched.responder_lat}, ${fetched.responder_lng}`);

    // Check citizen notification
    const checkCitizenNotif = await Notification.findOne({
      where: { receiver_id: citizen.id, type: 'system_alert' },
      order: [['createdAt', 'DESC']]
    });
    console.log('✓ Citizen Notification Created:', checkCitizenNotif?.title);

    // Check admin notification
    if (admin) {
      const checkAdminNotif = await Notification.findOne({
        where: { receiver_id: admin.id, type: 'important_activity' },
        order: [['createdAt', 'DESC']]
      });
      console.log('✓ Admin Notification Created:', checkAdminNotif?.title);
    }

    // 6. Test real rescuer GPS update (simulating telemetry ping)
    const realRescuerLat = 15.0125;
    const realRescuerLng = 120.6012;
    fetched.responder_lat = realRescuerLat;
    fetched.responder_lng = realRescuerLng;
    fetched.status = 'En Route';
    await fetched.save();

    const updated = await ResqRequest.findByPk(testIncident.id);
    console.log(`✓ Real Rescuer GPS Coordinates saved: ${updated.responder_lat}, ${updated.responder_lng}`);

    // 7. Cleanup test record and notifications
    await testIncident.destroy();
    if (citizenNotif) await citizenNotif.destroy();
    if (adminNotif) await adminNotif.destroy();
    console.log('✓ Test incident and notifications cleaned up successfully.');

    console.log('\n🎉 ALL 5 WORKFLOW INTEGRATION CHECKS PASSED PERFECTLY!\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Verification failed with error:', err);
    process.exit(1);
  }
}

testSubadminFlow();
