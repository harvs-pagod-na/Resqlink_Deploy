const { User, Profile, VerificationRequest, Message, Conversation } = require('./src/models');
const { sequelize } = require('./src/config/database');

async function deleteUsers() {
  try {
    await sequelize.authenticate();
    console.log('Connected to DB');

    const emailsToDelete = [
      'buildmanila@resqlink.ph',
      'quickrepair@resqlink.ph',
      'juan.delacruz@resqlink.ph',
      'pedro.penduko@resqlink.ph',
      'b@gmail.com'
    ];

    const users = await User.findAll({
      where: {
        email: emailsToDelete
      }
    });

    for (const user of users) {
      console.log(`Deleting user: ${user.email} (ID: ${user.id})`);
      
      // Delete Profile if exists
      await Profile.destroy({ where: { user_id: user.id } });
      
      // Delete Verification requests
      await VerificationRequest.destroy({ where: { user_id: user.id } });

      // The rest should cascade or be ignorable for dummy data.
      await user.destroy();
    }

    console.log(`Successfully deleted ${users.length} users.`);
    process.exit(0);
  } catch (error) {
    console.error('Error deleting users:', error);
    process.exit(1);
  }
}

deleteUsers();
