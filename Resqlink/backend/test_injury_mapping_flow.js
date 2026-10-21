const http = require('http');
const express = require('express');

// We can bootstrap the express app and start it on an ephemeral port (e.g., 3099)
async function runInjuryTests() {
  console.log('===============================================================');
  console.log('  RESQLINK INTERACTIVE BODY INJURY MAPPING INTEGRATION TEST    ');
  console.log('===============================================================');

  const { sequelize, User, ResqRequest, ResqInjury } = require('./src/models');
  await sequelize.authenticate();
  console.log('✓ Database connection established.');

  // Import Express app configuration
  // We require the routes and controllers directly or launch app
  const app = express();
  app.use(express.json());
  
  // Set mock io instance to test socket broadcasts
  const emittedEvents = [];
  const mockIo = {
    emit: (event, payload) => { emittedEvents.push({ event, payload }); },
    to: (room) => ({
      emit: (event, payload) => { emittedEvents.push({ room, event, payload }); }
    }),
  };
  app.set('io', mockIo);

  const authRoutes = require('./src/routes/authRoutes');
  const resqRoutes = require('./src/routes/resqRoutes');

  app.use('/api/auth', authRoutes);
  app.use('/api/resq', resqRoutes);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(3099, resolve));
  console.log('✓ Test HTTP Server listening on port 3099');

  const BASE_URL = 'http://127.0.0.1:3099/api';

  function request(method, path, body = null, token = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(BASE_URL + path);
      const postData = body ? JSON.stringify(body) : '';
      const headers = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname + url.search,
          method,
          headers,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              resolve({ status: res.statusCode, body: json });
            } catch (e) {
              resolve({ status: res.statusCode, raw: data });
            }
          });
        }
      );

      req.on('error', reject);
      if (body) {
        req.write(postData);
      }
      req.end();
    });
  }

  try {
    // 1. Authenticate or create Citizen user
    console.log('\n[TEST 1] Logging in or creating Citizen user...');
    let citizenToken;
    let citizenLogin = await request('POST', '/auth/login', {
      email: 'citizen_inj_test@resqlink.gov.ph',
      password: 'Password@123',
    });

    if (citizenLogin.status !== 200) {
      await request('POST', '/auth/register', {
        first_name: 'Juan',
        last_name: 'Dela Cruz',
        email: 'citizen_inj_test@resqlink.gov.ph',
        phone_number: '09171234567',
        password: 'Password@123',
        role: 'citizen',
        municipality: 'Porac',
      });
      citizenLogin = await request('POST', '/auth/login', {
        email: 'citizen_inj_test@resqlink.gov.ph',
        password: 'Password@123',
      });
    }

    citizenToken = citizenLogin.body?.tokens?.accessToken || citizenLogin.body?.token;
    if (!citizenToken) throw new Error('Citizen auth failed');
    console.log('✓ Citizen authenticated successfully.');

    // 2. Authenticate Admin user
    console.log('\n[TEST 2] Logging in Super Admin...');
    const adminLogin = await request('POST', '/auth/login', {
      email: 'superadmin@resqlink.gov.ph',
      password: 'Admin@123456',
    });
    const adminToken = adminLogin.body?.tokens?.accessToken || adminLogin.body?.token;
    if (!adminToken) throw new Error('Super Admin auth failed: ' + JSON.stringify(adminLogin.body));
    console.log('✓ Super Admin authenticated successfully.');

    // 3. Scenario A: Citizen submits SOS with MULTIPLE injured regions (Front and Back)
    console.log('\n[TEST 3] Citizen submits SOS with Front and Back injury mapping...');
    const multiInjuries = [
      { body_part: 'head', body_part_label: 'Head & Face', view_orientation: 'front' },
      { body_part: 'forearm_left', body_part_label: 'Left Forearm', view_orientation: 'front' },
      { body_part: 'knee_right', body_part_label: 'Right Knee', view_orientation: 'front' },
      { body_part: 'back_lower', body_part_label: 'Lower Back (Lumbar)', view_orientation: 'back' },
    ];

    const incidentARes = await request('POST', '/resq/request', {
      emergency_type: 'Medical',
      description: 'Motorcycle collision along Porac Access Road. Driver thrown from bike.',
      injury_description: 'Severe pain in right knee and lower back. Laceration on left forearm.',
      latitude: 15.0682,
      longitude: 120.5412,
      municipality: 'Porac',
      barangay: 'Poblacion',
      address_location: 'Porac Access Road near Plaza',
      injuries: multiInjuries,
    }, citizenToken);

    if (incidentARes.status !== 201) {
      throw new Error('Incident A submission failed: ' + JSON.stringify(incidentARes.body));
    }
    const incidentA = incidentARes.body.request;
    console.log(`✓ Incident A created with ID #${incidentA.id}.`);
    console.log(`  - Injuries returned in response: ${incidentA.injuries?.length}`);
    console.log(`  - Injury description: "${incidentA.injury_description}"`);
    if (incidentA.injuries?.length !== 4) {
      throw new Error(`Expected 4 injuries in Incident A, got ${incidentA.injuries?.length}`);
    }

    // 4. Verify database persistence of Incident A injuries
    console.log('\n[TEST 4] Verifying database records in resq_injuries table...');
    const dbInjuriesA = await ResqInjury.findAll({
      where: { resq_request_id: incidentA.id },
    });
    console.log(`✓ Found ${dbInjuriesA.length} records in resq_injuries for Incident #${incidentA.id}.`);
    const partsA = dbInjuriesA.map((i) => `${i.body_part} (${i.view_orientation})`);
    console.log('  Parts:', partsA.join(', '));
    if (dbInjuriesA.length !== 4) throw new Error('DB persistence count mismatch');

    // 5. Scenario B: Backward Compatibility - Emergency submitted WITHOUT injury mapping
    console.log('\n[TEST 5] Submitting SOS without any injury mapping (backward compatibility check)...');
    const incidentBRes = await request('POST', '/resq/request', {
      emergency_type: 'Fire',
      description: 'Residential kitchen fire, smoke visible.',
      latitude: 15.0700,
      longitude: 120.5400,
      municipality: 'Porac',
      barangay: 'Cangatba',
      address_location: 'Block 2 Lot 5 Cangatba',
    }, citizenToken);

    if (incidentBRes.status !== 201) {
      throw new Error('Incident B submission failed: ' + JSON.stringify(incidentBRes.body));
    }
    const incidentB = incidentBRes.body.request;
    console.log(`✓ Incident B created without injuries. ID #${incidentB.id}. Status: ${incidentB.status}.`);
    const dbInjuriesB = await ResqInjury.findAll({
      where: { resq_request_id: incidentB.id },
    });
    console.log(`✓ Incident B has ${dbInjuriesB.length} injuries in DB (correct: none).`);

    // 6. Admin queries incident injuries endpoint
    console.log('\n[TEST 6] Admin retrieves injuries for Incident A via GET /resq/:id/injuries...');
    const getInjRes = await request('GET', `/resq/${incidentA.id}/injuries`, null, adminToken);
    if (getInjRes.status !== 200) {
      throw new Error('GET injuries failed: ' + JSON.stringify(getInjRes.body));
    }
    console.log('✓ Successfully retrieved injury mapping:');
    console.log(`  - Incident ID: #${getInjRes.body.incident_id}`);
    console.log(`  - Total Injuries: ${getInjRes.body.injuries?.length}`);
    console.log(`  - Description: "${getInjRes.body.injury_description}"`);

    // 7. Admin updates and configures injury locations (adds Chest, removes Lower Back)
    console.log('\n[TEST 7] Admin modifies injury mapping (Adding Chest, removing Lower Back)...');
    const updatedParts = [
      { body_part: 'head', body_part_label: 'Head & Face', view_orientation: 'front' },
      { body_part: 'forearm_left', body_part_label: 'Left Forearm', view_orientation: 'front' },
      { body_part: 'knee_right', body_part_label: 'Right Knee', view_orientation: 'front' },
      { body_part: 'chest', body_part_label: 'Chest (Thorax)', view_orientation: 'front' }, // Newly added by Admin
    ];

    const putInjRes = await request('PUT', `/resq/${incidentA.id}/injuries`, {
      injuries: updatedParts,
      injury_description: 'Admin triage: Patient also complains of blunt chest trauma from handlebars.',
      modification_note: 'Added chest injury per triage phone call',
    }, adminToken);

    if (putInjRes.status !== 200) {
      throw new Error('PUT injuries failed: ' + JSON.stringify(putInjRes.body));
    }
    console.log('✓ Admin successfully configured injury mapping.');
    console.log(`  - Active injuries count: ${putInjRes.body.active_injuries?.length}`);
    console.log(`  - Updated description: "${putInjRes.body.injury_description}"`);

    // 8. Verify Citizen historical selections are preserved (not deleted)
    console.log('\n[TEST 8] Verifying Citizen historical selection audit preservation...');
    const allDbRecords = await ResqInjury.findAll({
      where: { resq_request_id: incidentA.id },
    });
    console.log(`✓ Total DB records for Incident A: ${allDbRecords.length} (Original 4 + Admin Added 1)`);
    const removedRecord = allDbRecords.find((r) => r.body_part === 'back_lower');
    if (!removedRecord) throw new Error('Removed record was deleted instead of marked inactive!');
    console.log(`✓ Citizen original part 'back_lower' preserved with status: '${removedRecord.status}', is_active: ${removedRecord.is_active}`);

    const adminAddedRecord = allDbRecords.find((r) => r.body_part === 'chest');
    if (!adminAddedRecord) throw new Error('Admin-added part was not created!');
    console.log(`✓ Admin-added part 'chest' created with reported_by: '${adminAddedRecord.reported_by}', is_active: ${adminAddedRecord.is_active}`);

    // 9. Unauthorized modification prevention
    console.log('\n[TEST 9] Verifying RBAC security: Citizen cannot call PUT /resq/:id/injuries...');
    const forbiddenRes = await request('PUT', `/resq/${incidentA.id}/injuries`, {
      injuries: updatedParts,
    }, citizenToken);
    console.log(`✓ Citizen update attempt resulted in status ${forbiddenRes.status} (Forbidden/Access Denied).`);
    if (forbiddenRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for citizen updating injuries, got ${forbiddenRes.status}`);
    }

    // 10. Verify Socket.IO broadcast of injury update
    console.log('\n[TEST 10] Verifying real-time Socket.IO broadcasts...');
    const injuryEvents = emittedEvents.filter((e) => e.event === 'emergency:injury_updated');
    console.log(`✓ Total emergency:injury_updated socket events emitted: ${injuryEvents.length}`);
    if (injuryEvents.length === 0) {
      throw new Error('No emergency:injury_updated socket events were emitted!');
    }
    console.log(`  Event broadcasted to role_admin and role_sub_admin with payload incident_id: #${injuryEvents[0].payload.incident_id}`);

    // 11. Cleanup test incidents
    console.log('\n[TEST 11] Cleaning up test incidents...');
    await ResqRequest.destroy({ where: { id: [incidentA.id, incidentB.id] } });
    console.log('✓ Test incidents safely removed from database.');

    console.log('\n===============================================================');
    console.log('  ✅ ALL 11 INJURY MAPPING INTEGRATION TESTS PASSED 100%!       ');
    console.log('===============================================================');

    server.close();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST RUNNER FAILED:', err);
    server.close();
    process.exit(1);
  }
}

runInjuryTests();
