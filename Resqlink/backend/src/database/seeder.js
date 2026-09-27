const bcrypt = require('bcryptjs');
const runMigration = require('./migrate');
const {
  User,
  Profile,
  VerificationRequest,
  Conversation,
  Message,
  AuditLog,
  ResqRequest,
  PublicAlert,
} = require('../models');

async function seed() {
  console.log('[SEEDER] Initializing migration first...');
  await runMigration();

  console.log('[SEEDER] Populating database with RESQLINK Emergency Response seed data...');

  const adminPass = await bcrypt.hash('AdminPass123!', 10);
  const subAdminPass = await bcrypt.hash('SubAdmin123!', 10);
  const responderPass = await bcrypt.hash('Responder123!', 10);
  const userPass = await bcrypt.hash('UserPass123!', 10);

  // 1. Admin (Command Center Lead)
  const admin = await User.create({
    email: 'admin@resqlink.ph',
    phone_number: '09170000000',
    password_hash: adminPass,
    role: 'admin',
    is_verified: true,
    verification_status: 'approved',
  });
  await Profile.create({
    user_id: admin.id,
    first_name: 'RESQLINK',
    last_name: 'Command Center',
    headline: 'System Admin & Emergency Dispatch Chief',
    city: 'Porac',
    province: 'Pampanga',
  });

  // 2. Sub-Admin (Municipal Dispatchers)
  const subAdminPorac = await User.create({
    email: 'subadmin.porac@resqlink.ph',
    phone_number: '09170001111',
    password_hash: subAdminPass,
    role: 'sub_admin',
    is_verified: true,
    verification_status: 'approved',
  });
  await Profile.create({
    user_id: subAdminPorac.id,
    first_name: 'Dispatcher',
    last_name: 'Porac',
    headline: 'MDRRMO Porac Station Supervisor',
    city: 'Porac',
    province: 'Pampanga',
  });

  const subAdminGuagua = await User.create({
    email: 'subadmin.guagua@resqlink.ph',
    phone_number: '09170001112',
    password_hash: subAdminPass,
    role: 'sub_admin',
    is_verified: true,
    verification_status: 'approved',
  });
  await Profile.create({
    user_id: subAdminGuagua.id,
    first_name: 'Dispatcher',
    last_name: 'Guagua',
    headline: 'MDRRMO Guagua Station Supervisor',
    city: 'Guagua',
    province: 'Pampanga',
  });

  // 3. Field Responders (MDRRMO, PNP, BFP)
  const responder1 = await User.create({
    email: 'medic1@resqlink.ph',
    phone_number: '09170002221',
    password_hash: responderPass,
    role: 'responder',
    is_verified: true,
    verification_status: 'approved',
    responder_badge_number: 'MED-001',
    responder_unit: 'Porac Rescue Unit Alpha',
  });
  await Profile.create({
    user_id: responder1.id,
    first_name: 'Carlos',
    last_name: 'Mendoza',
    headline: 'MDRRMO Emergency Medical Responder',
    city: 'Porac',
    province: 'Pampanga',
    latitude: 15.0684,
    longitude: 120.5422,
  });

  const responderPNP = await User.create({
    email: 'pnp.porac@resqlink.ph',
    phone_number: '09170002222',
    password_hash: responderPass,
    role: 'pnp_responder',
    is_verified: true,
    verification_status: 'approved',
    responder_badge_number: 'PNP-7741',
    responder_unit: 'Porac Municipal Police Station',
  });
  await Profile.create({
    user_id: responderPNP.id,
    first_name: 'Patrolman',
    last_name: 'Santos',
    headline: 'PNP Police First Responder',
    city: 'Porac',
    province: 'Pampanga',
    latitude: 15.0712,
    longitude: 120.5395,
  });

  const responderBFP = await User.create({
    email: 'bfp.porac@resqlink.ph',
    phone_number: '09170002223',
    password_hash: responderPass,
    role: 'bfp_responder',
    is_verified: true,
    verification_status: 'approved',
    responder_badge_number: 'BFP-9902',
    responder_unit: 'BFP Porac Fire Station',
  });
  await Profile.create({
    user_id: responderBFP.id,
    first_name: 'Fire Officer',
    last_name: 'Dizon',
    headline: 'BFP Fire & Rescue Responder',
    city: 'Porac',
    province: 'Pampanga',
    latitude: 15.0699,
    longitude: 120.5410,
  });

  // 4. Citizens / Users (Verified & Unverified)
  const citizenJuan = await User.create({
    email: 'user@resqlink.ph',
    phone_number: '09181234567',
    password_hash: userPass,
    role: 'user',
    is_verified: true,
    verification_status: 'approved',
  });
  await Profile.create({
    user_id: citizenJuan.id,
    first_name: 'Juan',
    last_name: 'Dela Cruz',
    headline: 'Verified Citizen',
    city: 'Porac',
    barangay: 'Cangatba',
    province: 'Pampanga',
    latitude: 15.0675,
    longitude: 120.5435,
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
  });

  const citizenMaria = await User.create({
    email: 'unverified@resqlink.ph',
    phone_number: '09195556677',
    password_hash: userPass,
    role: 'user',
    is_verified: false,
    verification_status: 'pending',
  });
  await Profile.create({
    user_id: citizenMaria.id,
    first_name: 'Maria',
    last_name: 'Clara',
    headline: 'Unverified Citizen',
    city: 'Guagua',
    barangay: 'San Matias',
    province: 'Pampanga',
    latitude: 14.9667,
    longitude: 120.6333,
  });

  // 5. Verification Request (GCash style pending review)
  await VerificationRequest.create({
    user_id: citizenMaria.id,
    id_type: "Philippine National ID",
    extracted_id_num: '1234-5678-9012',
    extracted_name: 'MARIA CLARA SANTOS',
    id_image_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
    id_back_image: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=600&q=80',
    live_selfie_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80',
    ocr_extracted_data: {
      full_name: 'MARIA CLARA SANTOS',
      birthdate: '1996-08-15',
      id_number: '1234-5678-9012',
      address: 'BRGY SAN MATIAS, GUAGUA, PAMPANGA',
    },
    facial_match_score: 95.0,
    quality_score: 98.0,
    duplicate_flag: false,
    ai_confidence: 96.0,
    ai_recommendation: 'approve',
    status: 'PENDING_ADMIN_APPROVAL',
    admin_notes: 'High facial match score (95%). Valid National ID.',
  });

  // 6. Public Alerts
  await PublicAlert.create({
    author_id: admin.id,
    title: 'Flash Flood Advisory - Porac River Level Warning',
    message: 'Continuous heavy rainfall has caused water levels in Porac River to rise to critical stage. Residents along low-lying barangays are advised to prepare for preemptive evacuation.',
    severity: 'High',
    target_municipality: 'Porac',
    is_active: true,
  });

  await PublicAlert.create({
    author_id: admin.id,
    title: 'Emergency Medical & Fire Hotlines Active',
    message: 'MDRRMO, PNP, and BFP emergency response teams in Porac, Santa Rita, and Guagua are on 24/7 high alert status.',
    severity: 'Moderate',
    target_municipality: 'All',
    is_active: true,
  });

  // 7. Initial Rescue Requests (RESQ)
  await ResqRequest.create({
    user_id: citizenJuan.id,
    emergency_type: 'Medical',
    severity_level: 'Critical',
    description: 'Severe vehicular accident near Cangatba intersection. Victim requires urgent ambulance transport.',
    latitude: 15.0684,
    longitude: 120.5422,
    address_location: 'Brgy. Cangatba, Porac, Pampanga',
    contact_number: '09181234567',
    status: 'Responder Dispatched',
    assigned_subadmin_id: subAdminPorac.id,
    assigned_responder_id: responder1.id,
    responder_name: 'Carlos Mendoza',
    responder_phone: '09170002221',
    responder_unit: 'Porac Rescue Unit Alpha',
    responder_lat: 15.0690,
    responder_lng: 120.5415,
    dispatcher_notes: 'Ambulance dispatched from Porac MDRRMO Station. En route with sirens enabled.',
    dispatched_at: new Date(Date.now() - 5 * 60 * 1000),
  });

  await ResqRequest.create({
    user_id: citizenJuan.id,
    emergency_type: 'Fire',
    severity_level: 'High',
    description: 'Residential electrical fire reported near Cangatba public market.',
    latitude: 15.0700,
    longitude: 120.5400,
    address_location: 'Brgy. Cangatba, Porac, Pampanga',
    contact_number: '09181234567',
    status: 'Pending',
    assigned_subadmin_id: subAdminPorac.id,
  });

  // 8. Conversations & Messages
  const conv1 = await Conversation.create({
    participant1_id: citizenJuan.id,
    participant2_id: responder1.id,
    last_message: 'Ambulance is approximately 3 minutes away from your location.',
    last_message_at: new Date(),
  });

  await Message.create({
    conversation_id: conv1.id,
    sender_id: citizenJuan.id,
    receiver_id: responder1.id,
    message_text: 'Sir, paparating na po ba ang ambulansya? Dumudugo po ang sugat ng biktima.',
  });

  await Message.create({
    conversation_id: conv1.id,
    sender_id: responder1.id,
    receiver_id: citizenJuan.id,
    message_text: 'Opo sir, paparating na po kami. Approximately 3 minutes away na po ang Unit Alpha.',
  });

  // 9. Initial Audit Logs
  await AuditLog.create({
    user_id: admin.id,
    action: 'RESQLINK_SYSTEM_BOOTSTRAP',
    entity: 'System',
    entity_id: '1',
    ip_address: '127.0.0.1',
    details: { message: 'RESQLINK Emergency Response System Initialized & Seeded Successfully' },
  });

  console.log('[SEEDER] RESQLINK Database seeding completed successfully!');
}

if (require.main === module) {
  seed().then(() => process.exit(0)).catch((err) => {
    console.error('[SEEDER] Seeding failed:', err);
    process.exit(1);
  });
}

module.exports = seed;
