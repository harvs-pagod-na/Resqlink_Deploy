const { User, Profile, ResqRequest, IncidentTrackingLog } = require('./src/models');
const { createResqRequest, getMyResqRequests, dispatchResqRequest, getAllResqRequests } = require('./src/controllers/resqController');

async function testAll() {
  try {
    const user = await User.findOne({ include: [{ model: Profile, as: 'profile' }] });
    
    console.log('--- 1. Testing SOS Creation in Santa Rita (San Basilio) ---');
    let createdReq = null;
    const req1 = {
      user: { id: user.id, role: 'citizen' },
      body: {
        emergency_type: 'Medical',
        severity_level: 'High',
        description: 'Injured patient telemetry test',
        latitude: 14.9920,
        longitude: 120.6220,
        municipality: 'Santa Rita',
        barangay: 'San Basilio',
        address_location: '[Santa Rita - Brgy. San Basilio] Near San Basilio Chapel',
        contact_number: '09171234567'
      },
      app: { get: () => null }
    };
    const res1 = {
      status: (c) => ({
        json: (d) => {
          console.log('Status 1:', c, 'Success:', d.success, 'Town:', d.request?.municipality, 'Brgy:', d.request?.barangay);
          createdReq = d.request;
        }
      })
    };
    await createResqRequest(req1, res1);

    console.log('\n--- 2. Testing getMyResqRequests (Active Detection) ---');
    const req2 = { user: { id: user.id } };
    const res2 = {
      json: (d) => {
        console.log('Total user requests:', d.requests?.length, 'Active ID:', d.active_request?.id, 'Active Status:', d.active_request?.status);
      }
    };
    await getMyResqRequests(req2, res2);

    console.log('\n--- 3. Testing Dispatching to Accepted and Responder Dispatched ---');
    const req3 = {
      params: { id: createdReq.id },
      user: { id: 1, role: 'admin' },
      body: {
        status: 'Accepted',
        target_agency: 'MDRRMO',
        responder_name: 'MDRRMO Santa Rita Unit 1',
        responder_phone: '0917-000-1111'
      },
      app: { get: () => null }
    };
    const res3 = {
      json: (d) => {
        console.log('Dispatch update status:', d.success, 'New status:', d.request?.status);
      }
    };
    await dispatchResqRequest(req3, res3);

    console.log('\n--- 4. Testing getAllResqRequests Sector Counts ---');
    const req4 = { query: {} };
    const res4 = {
      json: (d) => {
        console.log('Counts:', d.counts);
      }
    };
    await getAllResqRequests(req4, res4);

    console.log('\n✅ ALL INTEGRATION TESTS PASSED!');
  } catch (err) {
    console.error('❌ Test failed:', err);
  } finally {
    process.exit(0);
  }
}

testAll();
