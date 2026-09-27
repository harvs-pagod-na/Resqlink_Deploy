const http = require('http');

function postJson(path, body, token = null) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'POST',
      headers,
    }, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(responseBody) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: responseBody });
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function putJson(path, body, token = null) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'PUT',
      headers,
    }, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(responseBody) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: responseBody });
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getJson(path, token = null) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'GET',
      headers,
    }, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(responseBody) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: responseBody });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING MUNICIPAL JURISDICTION ISOLATION INTEGRATION TESTS');
  console.log('================================================================\n');

  try {
    // 1. Log in Santa Rita Admin
    console.log('1. Logging in as Santa Rita Admin (admin.santarita@resqlink.gov.ph)...');
    const srLogin = await postJson('/api/auth/login', {
      email: 'admin.santarita@resqlink.gov.ph',
      password: 'Admin@123456'
    });
    const srToken = srLogin.data.tokens?.accessToken || srLogin.data.token;
    if (!srToken) throw new Error('Santa Rita Admin login failed: ' + JSON.stringify(srLogin.data));
    console.log('   ✓ Login successful.');

    // 1.1 Verify Santa Rita Incidents
    console.log('   -> Testing GET /api/resq/admin/all (Santa Rita Admin)...');
    const srIncidents = await getJson('/api/resq/admin/all', srToken);
    console.log('   -> Response:', srIncidents.status, srIncidents.data);
    if (!srIncidents.data?.requests) {
      throw new Error('Failed to get requests: ' + JSON.stringify(srIncidents.data));
    }
    const nonSrIncidents = srIncidents.data.requests.filter(r => {
      const town = r.municipality || r.hub;
      return town && town !== 'Santa Rita';
    });
    if (nonSrIncidents.length > 0) {
      throw new Error(`LEAK DETECTED: Santa Rita Admin saw non-Santa Rita incidents: ${JSON.stringify(nonSrIncidents)}`);
    }
    console.log(`   ✓ Santa Rita Incidents Isolated: ${srIncidents.data.requests.length} requests returned (0 leaks).`);

    // 1.2 Verify Santa Rita Users
    console.log('   -> Testing GET /api/admin/users (Santa Rita Admin)...');
    const srUsers = await getJson('/api/admin/users', srToken);
    const nonSrUsers = (srUsers.data.users || []).filter(u => {
      const city = u.profile?.city;
      return city && city !== 'Santa Rita' && !u.email.includes('santarita');
    });
    if (nonSrUsers.length > 0) {
      throw new Error(`LEAK DETECTED: Santa Rita Admin saw users from other towns: ${nonSrUsers.map(u => u.email + ' (' + u.profile?.city + ')').join(', ')}`);
    }
    console.log(`   ✓ Santa Rita Users Isolated: ${srUsers.data.users.length} users returned (0 leaks).`);

    // 1.3 Verify Santa Rita Responders
    console.log('   -> Testing GET /api/resq/responders (Santa Rita Admin)...');
    const srResponders = await getJson('/api/resq/responders', srToken);
    const nonSrResponders = (srResponders.data.responders || []).filter(r => {
      const city = r.profile?.city;
      return city && city !== 'Santa Rita' && !r.email.includes('santarita');
    });
    if (nonSrResponders.length > 0) {
      throw new Error(`LEAK DETECTED: Santa Rita Admin saw responders from other towns: ${JSON.stringify(nonSrResponders)}`);
    }
    console.log(`   ✓ Santa Rita Responders Isolated: ${srResponders.data.responders.length} responders returned (0 leaks).`);

    // 1.4 Verify Santa Rita Analytics
    console.log('   -> Testing GET /api/resq/analytics (Santa Rita Admin)...');
    const srAnalytics = await getJson('/api/resq/analytics', srToken);
    if (srAnalytics.data.jurisdiction !== 'Santa Rita') {
      throw new Error(`Expected jurisdiction "Santa Rita" but got: ${srAnalytics.data.jurisdiction}`);
    }
    console.log(`   ✓ Santa Rita Analytics Scoped: jurisdiction = ${srAnalytics.data.jurisdiction}`);

    // 2. Log in Porac Admin
    console.log('\n2. Logging in as Porac Admin (admin.porac@resqlink.gov.ph)...');
    const poracLogin = await postJson('/api/auth/login', {
      email: 'admin.porac@resqlink.gov.ph',
      password: 'Admin@123456'
    });
    const poracToken = poracLogin.data.tokens?.accessToken || poracLogin.data.token;
    if (!poracToken) throw new Error('Porac Admin login failed: ' + JSON.stringify(poracLogin.data));
    console.log('   ✓ Login successful.');

    // 2.1 Verify Porac Users
    console.log('   -> Testing GET /api/admin/users (Porac Admin)...');
    const poracUsers = await getJson('/api/admin/users', poracToken);
    const nonPoracUsers = (poracUsers.data.users || []).filter(u => {
      const city = u.profile?.city;
      return city && city !== 'Porac' && !u.email.includes('porac');
    });
    if (nonPoracUsers.length > 0) {
      throw new Error(`LEAK DETECTED: Porac Admin saw users from other towns: ${nonPoracUsers.map(u => u.email).join(', ')}`);
    }
    console.log(`   ✓ Porac Users Isolated: ${poracUsers.data.users.length} users returned (0 leaks).`);

    // 2.2 Verify Porac Analytics
    console.log('   -> Testing GET /api/resq/analytics (Porac Admin)...');
    const poracAnalytics = await getJson('/api/resq/analytics', poracToken);
    if (poracAnalytics.data.jurisdiction !== 'Porac') {
      throw new Error(`Expected jurisdiction "Porac" but got: ${poracAnalytics.data.jurisdiction}`);
    }
    console.log(`   ✓ Porac Analytics Scoped: jurisdiction = ${poracAnalytics.data.jurisdiction}`);

    // 3. Log in Super Admin
    console.log('\n3. Logging in as Central Super Admin (superadmin@resqlink.gov.ph)...');
    const superLogin = await postJson('/api/auth/login', {
      email: 'superadmin@resqlink.gov.ph',
      password: 'Admin@123456'
    });
    const superToken = superLogin.data.tokens?.accessToken || superLogin.data.token;
    if (!superToken) throw new Error('Super Admin login failed: ' + JSON.stringify(superLogin.data));
    console.log('   ✓ Login successful.');

    // 3.1 Verify Super Admin Unrestricted Tri-Municipality Access
    console.log('   -> Testing GET /api/admin/users (Super Admin)...');
    const superUsers = await getJson('/api/admin/users', superToken);
    const hasPorac = superUsers.data.users.some(u => u.email.includes('porac') || u.profile?.city === 'Porac');
    const hasSantaRita = superUsers.data.users.some(u => u.email.includes('santarita') || u.profile?.city === 'Santa Rita');
    const hasGuagua = superUsers.data.users.some(u => u.email.includes('guagua') || u.profile?.city === 'Guagua');

    if (!hasPorac || !hasSantaRita || !hasGuagua) {
      throw new Error(`Super Admin must see all municipalities! (Porac: ${hasPorac}, Santa Rita: ${hasSantaRita}, Guagua: ${hasGuagua})`);
    }
    console.log(`   ✓ Super Admin Global Scope Confirmed: ${superUsers.data.users.length} total users across Porac, Santa Rita, Guagua.`);

    // 3.2 Verify Super Admin Analytics
    console.log('   -> Testing GET /api/resq/analytics (Super Admin)...');
    const superAnalytics = await getJson('/api/resq/analytics', superToken);
    if (superAnalytics.data.jurisdiction !== 'all') {
      throw new Error(`Expected Super Admin jurisdiction "all" but got: ${superAnalytics.data.jurisdiction}`);
    }
    // 4. Test Cross-Jurisdiction Mutation Protection
    console.log('\n4. Testing Cross-Jurisdiction Mutation Protection...');
    const newPoracRes = await postJson('/api/resq/request', {
      emergency_type: 'Fire',
      severity_level: 'High',
      municipality: 'Porac',
      barangay: 'Cangatba',
      latitude: 15.0719,
      longitude: 120.5419,
      address_location: 'Brgy. Cangatba, Porac, Pampanga',
      description: 'Test Porac incident for cross-jurisdiction defense verification',
      reporter_name: 'Porac Resident',
      contact_number: '0917-000-9999',
    }, poracToken);

    const poracIncidentId = newPoracRes.data?.request?.id;
    if (poracIncidentId) {
      console.log(`   -> Created Porac Incident #${poracIncidentId}.`);
      console.log(`   -> Santa Rita Admin attempting to modify/dispatch Porac Incident #${poracIncidentId}...`);
      const crossAttempt = await putJson(`/api/resq/dispatch/${poracIncidentId}`, { status: 'Responder Dispatched' }, srToken);
      if (crossAttempt.status !== 403) {
        throw new Error(`SECURITY VULNERABILITY: Santa Rita Admin was not rejected with 403 on Porac Incident! Got HTTP ${crossAttempt.status}`);
      }
      console.log(`   ✓ Protected: Server rejected cross-jurisdiction mutation with HTTP 403 Forbidden.`);
      console.log(`     Message: "${crossAttempt.data?.message}"`);
    }

    console.log('\n================================================================');
    console.log('🎉 ALL JURISDICTION ISOLATION TESTS PASSED WITHOUT ERRORS!');
    console.log('================================================================');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err.message);
    process.exit(1);
  }
}

runTests();
