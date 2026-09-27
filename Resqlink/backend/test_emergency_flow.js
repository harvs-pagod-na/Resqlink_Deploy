const http = require('http');

const BASE_URL = 'http://localhost:3000/api';

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const postData = body ? JSON.stringify(body) : '';
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers
    }, (res) => {
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
    });

    req.on('error', reject);
    if (body) {
      req.write(postData);
    }
    req.end();
  });
}

async function runTest() {
  console.log('--- STARTING EMERGENCY RESPONSE FLOW E2E TEST ---');

  // 1. Login Citizen
  console.log('\n1. Logging in Citizen (or registering temporary test citizen)...');
  let citizenToken;
  let citizenRes = await request('POST', '/auth/login', {
    email: 'test_citizen@resqlink.gov.ph',
    password: 'Password@123'
  });

  if (citizenRes.status !== 200) {
    console.log('Registering test citizen...');
    const regRes = await request('POST', '/auth/register', {
      first_name: 'Test',
      last_name: 'Citizen',
      email: 'test_citizen@resqlink.gov.ph',
      phone_number: '09123456789',
      password: 'Password@123',
      role: 'citizen',
      municipality: 'Santa Rita'
    });
    if (regRes.status !== 201 && regRes.status !== 200) {
      throw new Error('Citizen registration failed: ' + JSON.stringify(regRes));
    }
    const loginAgain = await request('POST', '/auth/login', {
      email: 'test_citizen@resqlink.gov.ph',
      password: 'Password@123'
    });
    if (loginAgain.status !== 200) {
      throw new Error('Citizen login after registration failed: ' + JSON.stringify(loginAgain));
    }
    citizenToken = loginAgain.body.tokens?.accessToken || loginAgain.body.token;
  } else {
    citizenToken = citizenRes.body.tokens?.accessToken || citizenRes.body.token;
  }
  console.log(' Citizen logged in successfully');

  // 2. Login Santa Rita Admin
  console.log('\n2. Logging in Santa Rita Admin...');
  const adminRes = await request('POST', '/auth/login', {
    email: 'admin.santarita@resqlink.gov.ph',
    password: 'Admin@123456'
  });
  if (adminRes.status !== 200) {
    throw new Error('Admin login failed: ' + JSON.stringify(adminRes));
  }
  const adminToken = adminRes.body.tokens?.accessToken || adminRes.body.token;
  console.log(' Admin logged in successfully');

  // 3. Login Santa Rita Medic Responder
  console.log('\n3. Logging in Santa Rita Medic Responder...');
  const medicRes = await request('POST', '/auth/login', {
    email: 'medic.santarita@resqlink.gov.ph',
    password: 'Responder@123'
  });
  if (medicRes.status !== 200) {
    throw new Error('Medic login failed: ' + JSON.stringify(medicRes));
  }
  const medicToken = medicRes.body.tokens?.accessToken || medicRes.body.token;
  const medicId = medicRes.body.user.id;
  console.log(' Medic logged in successfully. Medic ID:', medicId);

  // 4. Login Porac Police Responder (for privacy isolation check)
  console.log('\n4. Logging in Porac Police Responder (for isolation test)...');
  const poracPoliceRes = await request('POST', '/auth/login', {
    email: 'police.porac@resqlink.gov.ph',
    password: 'Responder@123'
  });
  if (poracPoliceRes.status !== 200) {
    throw new Error('Porac Police login failed: ' + JSON.stringify(poracPoliceRes));
  }
  const poracPoliceToken = poracPoliceRes.body.tokens?.accessToken || poracPoliceRes.body.token;
  console.log(' Porac Police logged in successfully');

  // 5. Citizen submits emergency request selecting Santa Rita Hub
  console.log('\n5. Citizen submitting Emergency Request with nearest hub = Santa Rita...');
  const createReqRes = await request('POST', '/resq/request', {
    emergency_type: 'Medical',
    latitude: 15.0003,
    longitude: 120.6138,
    landmark: 'Santa Rita Town Plaza near Church',
    notes: 'Severe chest pain, urgent help required',
    urgency: 'Critical',
    hub: 'Santa Rita',
    municipality: 'Santa Rita'
  }, citizenToken);

  if (createReqRes.status !== 201 && createReqRes.status !== 200) {
    throw new Error('Emergency request creation failed: ' + JSON.stringify(createReqRes));
  }
  const incidentData = createReqRes.body.request || createReqRes.body.data;
  const requestId = incidentData.id;
  console.log(` Emergency request submitted successfully! ID: ${requestId}, Hub: ${incidentData.hub || incidentData.municipality}, Status: ${incidentData.status}`);

  // 6. Verify responders list filtered by Santa Rita & Medical
  console.log('\n6. Admin fetching available responders in Santa Rita for Medical...');
  const respListRes = await request('GET', '/resq/responders?municipality=Santa%20Rita&department=Medical', null, adminToken);
  console.log('Responders query response status:', respListRes.status, 'body:', JSON.stringify(respListRes.body || respListRes.raw));
  const respondersList = respListRes.body?.responders || respListRes.body?.data || [];
  if (respListRes.status !== 200 || !respondersList.some(r => r.id === medicId)) {
    throw new Error('Responders list did not return the expected Santa Rita medic: ' + JSON.stringify(respListRes));
  }
  console.log(` Admin retrieved ${respondersList.length} available responder(s) matching criteria.`);

  // 7. Admin assigns emergency to Santa Rita Medic
  console.log(`\n7. Admin assigning Incident #${requestId} to Medic #${medicId} (Medical)...`);
  const assignRes = await request('POST', `/resq/assign/${requestId}`, {
    assigned_responder_id: medicId,
    assigned_department: 'Medical',
    responder_name: 'Santa Rita Medic Unit',
    responder_unit: 'Santa Rita Medical Team Alpha'
  }, adminToken);

  const assignedReq = assignRes.body.request || assignRes.body.data;
  if (assignRes.status !== 200 || assignedReq.status !== 'Assigned') {
    throw new Error('Assignment failed: ' + JSON.stringify(assignRes));
  }
  console.log(` Assigned successfully! Status: ${assignedReq.status}, Department: ${assignedReq.assigned_department}`);

  // 8. Strict Privacy / Isolation check:
  // Porac Police should NOT see this Santa Rita incident on their active incident endpoint
  console.log('\n8. Checking Strict Isolation: Porac Police checking active incident...');
  const poracActiveRes = await request('GET', '/resq/responder/active', null, poracPoliceToken);
  const poracIncident = poracActiveRes.body.active_incident || poracActiveRes.body.data;
  if (poracActiveRes.status === 200 && poracIncident && poracIncident.id === requestId) {
    throw new Error('PRIVACY VIOLATION: Porac Police saw Santa Rita incident!');
  }
  console.log(' Strict isolation verified: Porac Police received no unauthorized access to Santa Rita incident.');

  // 9. Assigned Medic checks their active incident
  console.log('\n9. Santa Rita Medic checking active incident...');
  const medicActiveRes = await request('GET', '/resq/responder/active', null, medicToken);
  const medicActiveIncident = medicActiveRes.body.active_incident || medicActiveRes.body.data;
  if (medicActiveRes.status !== 200 || !medicActiveIncident || medicActiveIncident.id !== requestId) {
    throw new Error('Medic could not find assigned incident: ' + JSON.stringify(medicActiveRes));
  }
  console.log(` Medic retrieved assigned incident #${medicActiveIncident.id}, status: ${medicActiveIncident.status}`);

  // 10. Medic accepts the emergency request
  console.log(`\n10. Medic accepting Emergency Request #${requestId}...`);
  const acceptRes = await request('POST', `/resq/accept/${requestId}`, {}, medicToken);
  const acceptedReq = acceptRes.body.request || acceptRes.body.data;
  if (acceptRes.status !== 200 || acceptedReq.status !== 'Accepted') {
    throw new Error('Medic acceptance failed: ' + JSON.stringify(acceptRes));
  }
  console.log(` Medic accepted emergency! Status: ${acceptedReq.status}`);

  // 11. Admin dispatches the responder: "Responder Dispatched"
  console.log(`\n11. Admin dispatching responder: changing status to 'Responder Dispatched'...`);
  const dispatchRes = await request('PUT', `/resq/dispatch/${requestId}`, {
    status: 'Responder Dispatched'
  }, adminToken);
  const dispatchedReq = dispatchRes.body.request || dispatchRes.body.data;
  if (dispatchRes.status !== 200 || dispatchedReq.status !== 'Responder Dispatched') {
    throw new Error('Dispatch failed: ' + JSON.stringify(dispatchRes));
  }
  console.log(` Status changed to: ${dispatchedReq.status}`);

  // 12. Medic changes status to "En Route"
  console.log(`\n12. Medic leaving for location: changing status to 'En Route'...`);
  const enRouteRes = await request('PUT', `/resq/dispatch/${requestId}`, {
    status: 'En Route',
    responder_lat: 15.0010,
    responder_lng: 120.6140
  }, medicToken);
  const enRouteReq = enRouteRes.body.request || enRouteRes.body.data;
  if (enRouteRes.status !== 200 || enRouteReq.status !== 'En Route') {
    throw new Error('En Route update failed: ' + JSON.stringify(enRouteRes));
  }
  console.log(` Status changed to: ${enRouteReq.status}`);

  // 13. Medic arrives at scene: changing status to "Arrived"
  console.log(`\n13. Medic arrived on scene: changing status to 'Arrived'...`);
  const arrivedRes = await request('PUT', `/resq/dispatch/${requestId}`, {
    status: 'Arrived',
    responder_lat: 15.0003,
    responder_lng: 120.6138
  }, medicToken);
  const arrivedReq = arrivedRes.body.request || arrivedRes.body.data;
  if (arrivedRes.status !== 200 || arrivedReq.status !== 'Arrived' || !arrivedReq.arrived_at) {
    throw new Error('Arrived update failed: ' + JSON.stringify(arrivedRes));
  }
  console.log(` Status changed to: ${arrivedReq.status}, Arrived At: ${arrivedReq.arrived_at}`);

  // 14. Medic completes rescue operation: changing status to "Completed"
  console.log(`\n14. Medic completing rescue operation: changing status to 'Completed'...`);
  const completeRes = await request('PUT', `/resq/dispatch/${requestId}`, {
    status: 'Completed',
    resolution_notes: 'Patient stabilized and transported to nearest medical facility.'
  }, medicToken);
  const completedReq = completeRes.body.request || completeRes.body.data;
  if (completeRes.status !== 200 || completedReq.status !== 'Completed' || !completedReq.completed_at) {
    throw new Error('Completed update failed: ' + JSON.stringify(completeRes));
  }
  console.log(` Rescue completed! Status: ${completedReq.status}, Completed At: ${completedReq.completed_at}, Response Duration: ${completedReq.response_duration_minutes} mins`);

  // 15. Verify queue segregation: Incident must be removed from Active Queue and placed into History
  console.log('\n15. Checking Admin Active Queue vs History...');
  const allIncidentsRes = await request('GET', '/resq/admin/all', null, adminToken);
  const allRequests = allIncidentsRes.body.requests || [];
  
  // Active queue criteria in Admin Dashboard:
  // ['Pending', 'Assigned', 'Accepted', 'Responder Dispatched', 'Dispatched', 'En Route', 'On Scene', 'Arrived', 'In Progress']
  const activeQueue = allRequests.filter(r => 
    ['Pending', 'Assigned', 'Accepted', 'Responder Dispatched', 'Dispatched', 'En Route', 'On Scene', 'Arrived', 'In Progress'].includes(r.status)
  );
  // History criteria:
  // ['Completed', 'Resolved', 'Closed', 'Cancelled']
  const historyQueue = allRequests.filter(r => 
    ['Completed', 'Resolved', 'Closed', 'Cancelled'].includes(r.status)
  );

  const isInActive = activeQueue.some(r => r.id === requestId);
  if (isInActive) {
    throw new Error(`FAILURE: Incident #${requestId} is still present in Active Queue!`);
  }
  console.log(` Incident #${requestId} successfully removed from Active Queue.`);

  const isInHistory = historyQueue.some(r => r.id === requestId);
  if (!isInHistory) {
    throw new Error(`FAILURE: Incident #${requestId} not found in History!`);
  }
  console.log(` Incident #${requestId} verified in History.`);

  // 16. Verify Medic active incident is now cleared
  console.log('\n16. Verifying Medic active incident endpoint is now empty...');
  const finalMedicActive = await request('GET', '/resq/responder/active', null, medicToken);
  if (finalMedicActive.status === 200 && finalMedicActive.body.active_incident) {
    throw new Error('Medic still has active incident after completion!');
  }
  console.log(' Medic active incident is now null / cleared.');

  console.log('\n========================================');
  console.log(' ALL 16 FLOW & ISOLATION CHECKS PASSED!');
  console.log('========================================\n');
}

runTest().catch((err) => {
  console.error('\n❌ TEST FAILED:', err.message || err);
  process.exit(1);
});
