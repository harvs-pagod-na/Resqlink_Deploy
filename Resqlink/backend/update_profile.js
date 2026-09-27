const { Sequelize } = require('sequelize');
const sequelize = new Sequelize('resqlink_db', 'root', '', { host: '127.0.0.1', dialect: 'mysql' });

async function run() {
  try {
    const [users] = await sequelize.query("SELECT id, email FROM Users WHERE email = 'c@gmail.com' OR email = 'christophermadeja7@gmail.com'");
    if (users.length > 0) {
      const userId = users[0].id;
      const skills = JSON.stringify(['Computer Hardware and Software Literacy', 'Software Quality Specialist', 'Leadership Skills', 'Communication Skills', 'Web Development', 'JavaScript', 'Express', 'Node', 'PHP', 'HTML', 'CSS', 'Tailwind', 'MySQL']);
      const certs = JSON.stringify(['Project Management Ready (PMR)', 'Champion in Vibe Coding Challenged Competition 2025', 'Introduction to Data Science', 'Engaging Stakeholders for Success', 'Data Analytics Essentials', 'Introduction to Cybersecurity', 'Capstone Project', 'Best Capstone in Enterprise Category', 'Outstanding Excellence in Applied I. S/Digital Transformation Award', 'SSITE Innovators Awardee', 'HTML Essentials', 'CSS Essentials', 'JavaScript Essentials', 'Leadership Awardee']);
      const bio = 'Information System fresh graduates specializing in Web Development, real-time platforms, and scalable Learning Management Systems. Skilled at simplifying complex concepts into clear, actionable solutions, with a mission to build intelligent systems that create measurable impact.';
      
      await sequelize.query(`UPDATE Profiles SET 
        headline = 'Web Developer & System Developer',
        bio = '${bio}',
        skills = '${skills}',
        certifications = '${certs}',
        first_name = 'Christopher M.',
        last_name = 'Panoy'
        WHERE user_id = ${userId}`);
      console.log('Profile updated successfully!');
    } else {
      console.log('User not found');
    }
  } catch(e) {
    console.error(e);
  } finally {
    process.exit();
  }
}
run();
