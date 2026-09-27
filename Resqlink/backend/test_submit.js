const { User, VerificationRequest, Profile } = require('./src/models');
const { submitCompleteOnboarding } = require('./src/controllers/verificationController');

async function test() {
  try {
    const user = await User.findOne();
    const req = {
      user: { id: user.id },
      body: {
        first_name: 'Test',
        last_name: 'Test',
        town: 'Santa Rita',
        barangay: 'San Basilio',
      }
    };
    
    const res = {
      status: (code) => {
        console.log('Status:', code);
        return {
          json: (data) => console.log('JSON:', JSON.stringify(data, null, 2))
        };
      }
    };
    
    await submitCompleteOnboarding(req, res);
  } catch (err) {
    console.error('Error:', err);
  }
}
test();
