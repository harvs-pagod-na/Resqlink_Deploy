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

const categorizeUser = (u) => {
  const r = (u.role || '').toLowerCase();
  if (['admin', 'super_admin', 'mdrrmo_admin'].includes(r)) return 'admins';
  if (['sub_admin'].includes(r)) return 'sub_admins';
  if (['responder', 'pnp_responder', 'bfp_responder'].includes(r)) return 'responders';
  return 'citizens';
};

const getResponderDept = (u) => {
  if (u.agency && ['Medical', 'Police', 'Fire', 'Rescue'].includes(u.agency)) return u.agency;
  const email = (u.email || '').toLowerCase();
  const headline = (u.profile?.headline || '').toLowerCase();
  const unit = (u.profile?.responder_unit || '').toLowerCase();
  if (email.includes('police') || headline.includes('police') || unit.includes('police') || u.role === 'pnp_responder') return 'Police';
  if (email.includes('fire') || headline.includes('fire') || unit.includes('fire') || u.role === 'bfp_responder') return 'Fire';
  if (email.includes('medic') || headline.includes('medic') || headline.includes('mdrrmo') || unit.includes('medic') || unit.includes('ambulance')) return 'Medical';
  if (headline.includes('rescue') || unit.includes('rescue') || u.agency === 'Rescue') return 'Rescue';
  return 'Medical';
};

async function verifyUserManagement() {
  console.log('--- VERIFYING USER MANAGEMENT CATEGORIZATION ---');

  // 1. Admin login
  const loginRes = await request('POST', '/auth/login', {
    email: 'superadmin@resqlink.gov.ph',
    password: 'Admin@123456'
  });
  if (loginRes.status !== 200) {
    throw new Error('Admin login failed: ' + JSON.stringify(loginRes));
  }
  const token = loginRes.body.tokens?.accessToken || loginRes.body.token;

  // 2. Fetch all users via /admin/users
  const usersRes = await request('GET', '/admin/users', null, token);
  if (usersRes.status !== 200 || !usersRes.body.users) {
    throw new Error('Fetch users failed: ' + JSON.stringify(usersRes));
  }
  const users = usersRes.body.users;
  console.log(`Total users in system: ${users.length}`);

  // 3. Category segregation
  const admins = users.filter(u => categorizeUser(u) === 'admins');
  const subAdmins = users.filter(u => categorizeUser(u) === 'sub_admins');
  const citizens = users.filter(u => categorizeUser(u) === 'citizens');
  const responders = users.filter(u => categorizeUser(u) === 'responders');

  console.log(`\n👑 1. Administrators: ${admins.length} account(s)`);
  admins.forEach(a => console.log(`   - [ID #${a.id}] ${a.email} (${a.role}) - Town: ${a.profile?.city || 'Central'}`));
  if (admins.length !== 4) throw new Error(`Expected 4 Admins, found ${admins.length}`);

  console.log(`\n🔰 2. Sub-Administrators: ${subAdmins.length} account(s)`);
  subAdmins.forEach(s => console.log(`   - [ID #${s.id}] ${s.email} (${s.role}) - Sector: ${s.profile?.city}`));
  if (subAdmins.length !== 3) throw new Error(`Expected 3 Sub-Admins, found ${subAdmins.length}`);

  console.log(`\n👥 3. Citizens / Registered Users: ${citizens.length} account(s)`);
  citizens.forEach(c => console.log(`   - [ID #${c.id}] ${c.email} (${c.role}) - Town: ${c.profile?.city}, Verified: ${c.is_verified}`));
  if (citizens.length !== 2) throw new Error(`Expected 2 Citizens, found ${citizens.length}`);

  console.log(`\n🚑 4. First Responders: ${responders.length} account(s)`);
  const medical = responders.filter(r => getResponderDept(r) === 'Medical');
  const police = responders.filter(r => getResponderDept(r) === 'Police');
  const fire = responders.filter(r => getResponderDept(r) === 'Fire');
  console.log(`   - 🚑 Medical: ${medical.length} (${medical.map(m => m.profile?.city).join(', ')})`);
  console.log(`   - 🚔 Police:  ${police.length} (${police.map(p => p.profile?.city).join(', ')})`);
  console.log(`   - 🚒 Fire:    ${fire.length} (${fire.map(f => f.profile?.city).join(', ')})`);

  if (responders.length !== 9) throw new Error(`Expected 9 Responders, found ${responders.length}`);
  if (medical.length !== 3) throw new Error(`Expected 3 Medical, found ${medical.length}`);
  if (police.length !== 3) throw new Error(`Expected 3 Police, found ${police.length}`);
  if (fire.length !== 3) throw new Error(`Expected 3 Fire, found ${fire.length}`);

  console.log('\n======================================================');
  console.log(' ALL 4 USER CATEGORIES PROVEN 100% CLEANLY SEPARATED!');
  console.log('======================================================\n');
}

verifyUserManagement().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
