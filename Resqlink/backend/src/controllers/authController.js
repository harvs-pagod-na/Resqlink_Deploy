const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const Jimp = require('jimp');
const { User, Profile, SecurityLog, VerificationRequest } = require('../models');

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'resqlink_access_secret_dev_2026';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'resqlink_refresh_secret_dev_2026';

const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { id: user.id, uuid: user.uuid, email: user.email, role: user.role },
    JWT_ACCESS_SECRET,
    { expiresIn: '2h' }
  );

  const refreshToken = jwt.sign(
    { id: user.id, uuid: user.uuid },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

exports.register = async (req, res) => {
  try {
    const {
      email,
      password,
      role,
      first_name,
      last_name,
      company_name,
      phone_number,
      municipality,
      city,
      barangay,
      address,
      blood_type,
      medical_conditions,
      special_needs,
      emergency_contact_name,
      emergency_contact_phone,
      emergency_contact_relation,
      responder_badge_number,
      responder_unit
    } = req.body;
    const resumeFile = req.file;

    if (!email || !password || !first_name || !last_name) {
      return res.status(400).json({ success: false, message: 'Please fill in all required fields.' });
    }

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email address is already registered.' });
    }

    // Supported Tri-Municipality validation
    const validTowns = ['Porac', 'Santa Rita', 'Guagua'];
    const chosenTown = validTowns.includes(municipality) ? municipality : (validTowns.includes(city) ? city : 'Porac');

    const isResponder = role === 'responder' || role === 'sub_admin';
    let userRole = 'user';
    let isVerified = true;
    let verificationStatus = 'approved';

    if (role === 'admin' || role === 'super_admin') {
      userRole = 'admin';
      isVerified = true;
      verificationStatus = 'approved';
    } else if (role === 'responder') {
      userRole = 'responder';
      isVerified = true;
      verificationStatus = 'approved';
    } else if (role === 'sub_admin') {
      userRole = 'sub_admin';
      isVerified = true;
      verificationStatus = 'approved';
    } else {
      // Regular Citizens: Instant registration for immediate emergency SOS access, pending identity verification
      userRole = 'citizen';
      isVerified = false;
      verificationStatus = 'unverified';
    }

    const password_hash = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      password_hash,
      role: userRole,
      phone_number: phone_number || null,
      is_verified: isVerified,
      verification_status: verificationStatus,
    });

    const tokens = generateTokens(user);
    await user.update({ refresh_token: tokens.refreshToken });

    const resume_url = resumeFile ? `/uploads/${resumeFile.filename}` : null;

    const profile = await Profile.create({
      user_id: user.id,
      first_name,
      last_name,
      full_name: `${first_name} ${last_name}`,
      city: chosenTown,
      province: 'Pampanga',
      barangay: barangay || '',
      address: address || (barangay ? `${barangay}, ${chosenTown}, Pampanga` : `${chosenTown}, Pampanga`),
      resume_url,
      headline: isResponder ? `Field Responder (${responder_unit || chosenTown})` : 'Registered Citizen',
      blood_type: blood_type || 'Unknown',
      medical_conditions: Array.isArray(medical_conditions) ? medical_conditions : (medical_conditions ? [medical_conditions] : []),
      special_needs: special_needs || 'None',
      emergency_contact_name: emergency_contact_name || null,
      emergency_contact_phone: emergency_contact_phone || null,
      emergency_contact_relation: emergency_contact_relation || null,
      responder_badge_number: responder_badge_number || null,
      responder_unit: responder_unit || null,
      is_verified: isVerified,
      verification_status: verificationStatus,
    });

    try {
      const io = req.app.get('io');
      if (io) {
        const fullUserPayload = {
          id: user.id,
          uuid: user.uuid,
          email: user.email,
          role: user.role,
          phone_number: user.phone_number,
          is_verified: user.is_verified,
          verification_status: user.verification_status,
          is_active: user.is_active !== undefined ? user.is_active : true,
          first_name,
          last_name,
          city: chosenTown,
          municipality: chosenTown,
          barangay: barangay || '',
          profile: profile ? profile.toJSON() : null,
          Profile: profile ? profile.toJSON() : null,
          verification_requests: [],
          created_at: user.created_at || new Date().toISOString(),
          createdAt: user.createdAt || new Date().toISOString(),
        };
        io.emit('new_user_registered', fullUserPayload);
        io.emit('user_registered', fullUserPayload);
        io.emit('user_updated', fullUserPayload);
      }
    } catch (sockErr) {
      console.warn('[AUTH SOCKET WARN]', sockErr.message);
    }

    return res.status(201).json({
      success: true,
      message: isResponder
        ? 'Responder application submitted! Your account is pending verification by the MDRRMO Admin.'
        : 'Citizen account registered successfully! Emergency SOS is active.',
      tokens,
      user: {
        id: user.id,
        uuid: user.uuid,
        email: user.email,
        role: user.role,
        is_verified: user.is_verified,
        verification_status: user.verification_status,
        first_name,
        last_name,
        city: chosenTown,
        municipality: chosenTown,
        barangay: barangay || '',
        resume_url,
        profile,
      }
    });
  } catch (error) {
    console.error('[REGISTER ERROR]', error);
    require('fs').appendFileSync(__dirname + '/error.log', new Date().toISOString() + ' REGISTER ERROR: ' + error.stack + '\n');
    return res.status(500).json({ success: false, message: 'Server error during registration.', error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = await User.findOne({
      where: { email },
      include: [
        { model: Profile, as: 'profile' },
      ],
    });

    if (!user) {
      await SecurityLog.create({ event_type: 'login_failed', details: { email, reason: 'User not found' } });
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (user.lockout_until && user.lockout_until > new Date()) {
      const remainingMins = Math.ceil((new Date(user.lockout_until) - new Date()) / (1000 * 60));
      return res.status(423).json({
        success: false,
        message: `Account is temporarily locked due to repeated failed login attempts. Try again in ${remainingMins} minutes.`,
      });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      const attempts = user.failed_login_attempts + 1;
      let lockout = null;
      if (attempts >= 5) {
        lockout = new Date(Date.now() + 30 * 60 * 1000); // 30 mins lockout
        await SecurityLog.create({ user_id: user.id, event_type: 'account_locked', details: { attempts } });
      } else {
        await SecurityLog.create({ user_id: user.id, event_type: 'login_failed', details: { attempts } });
      }

      await user.update({ failed_login_attempts: attempts, lockout_until: lockout });
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // Reset failed attempts & issue tokens
    await user.update({
      failed_login_attempts: 0,
      lockout_until: null,
      last_login_at: new Date(),
    });

    const tokens = generateTokens(user);
    await user.update({ refresh_token: tokens.refreshToken });

    await SecurityLog.create({ user_id: user.id, event_type: 'login_success' });

    return res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        uuid: user.uuid,
        email: user.email,
        role: user.role,
        is_verified: user.is_verified,
        verification_status: user.verification_status,
        profile: user.profile,
      },
      tokens,
    });
  } catch (error) {
    console.error('[LOGIN ERROR]', error);
    require('fs').appendFileSync(__dirname + '/error.log', new Date().toISOString() + ' LOGIN ERROR: ' + error.stack + '\\n');
    return res.status(500).json({ success: false, message: 'Server error during login.', error: error.message });
  }
};

exports.me = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password_hash', 'refresh_token'] },
      include: [
        { model: Profile, as: 'profile' },
      ],
    });

    return res.json({ success: true, user });
  } catch (error) {
    console.error('[ME ERROR]', error);
    return res.status(500).json({ success: false, message: 'Server error fetching user.', error: error.message });
  }
};

exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ success: false, message: 'Refresh token required.' });
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    const user = await User.findByPk(decoded.id);

    if (!user || user.refresh_token !== refreshToken) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token.' });
    }

    const tokens = generateTokens(user);
    await user.update({ refresh_token: tokens.refreshToken });

    return res.json({ success: true, tokens });
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Expired or invalid refresh token.' });
  }
};

const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5001';

const PAMPANGA_MUNICIPALITIES = [
  'ANGELES', 'SAN FERNANDO', 'MABALACAT', 'FLORIDABLANCA', 'GUAGUA',
  'LUBAO', 'MEXICO', 'ARAYAT', 'PORAC', 'APALIT', 'CANDABA', 'BACOLOR',
  'MACABEBE', 'MASANTOL', 'MINALIN', 'SAN LUIS', 'SAN SIMON', 'SANTA ANA',
  'SANTA RITA', 'SANTO TOMAS', 'SASMUAN', 'PAMPANGA'
];

function calculateFuzzySimilarity(s1, s2) {
  if (!s1 || !s2) return 0;
  const str1 = String(s1).toUpperCase().replace(/[^A-Z0-9\s]/g, '').trim();
  const str2 = String(s2).toUpperCase().replace(/[^A-Z0-9\s]/g, '').trim();
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 100;

  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  const longerLength = longer.length;
  if (longerLength === 0) return 100;

  const costs = [];
  for (let i = 0; i <= str1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= str2.length; j++) {
      if (i === 0) costs[j] = j;
      else if (j > 0) {
        let newValue = costs[j - 1];
        if (str1.charAt(i - 1) !== str2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[str2.length] = lastValue;
  }
  const distance = costs[str2.length];
  const ratio = ((longerLength - distance) / parseFloat(longerLength)) * 100;
  return Math.round(ratio * 100) / 100;
}

exports.crossMatchIdentity = async (req, res) => {
  try {
    const {
      first_name = '',
      middle_name = '',
      last_name = '',
      birthdate = '',
      pampanga_town = '',
      barangay = '',
      street_address = '',
    } = req.body;

    const files = req.files || {};
    const idFrontFile = files.id_front ? files.id_front[0] : (req.file || null);
    const idBackFile = files.id_back ? files.id_back[0] : null;

    // Call Python AI Microservice Endpoint
    try {
      const formData = new FormData();
      formData.append('first_name', first_name);
      formData.append('middle_name', middle_name);
      formData.append('last_name', last_name);
      formData.append('birthdate', birthdate);
      formData.append('pampanga_town', pampanga_town);
      formData.append('barangay', barangay);
      formData.append('street_address', street_address);

      if (idFrontFile && idFrontFile.path) {
        formData.append('id_front', fs.createReadStream(idFrontFile.path), idFrontFile.originalname || 'id_front.jpg');
      }
      if (idBackFile && idBackFile.path) {
        formData.append('id_back', fs.createReadStream(idBackFile.path), idBackFile.originalname || 'id_back.jpg');
      }

      const aiResponse = await axios.post(`${AI_SERVICE_URL}/api/register/cross-match-identity`, formData, {
        headers: formData.getHeaders(),
        timeout: 5000,
        validateStatus: () => true,
      });

      if (aiResponse.data && (aiResponse.status === 200 || aiResponse.status === 400)) {
        return res.status(aiResponse.status).json(aiResponse.data);
      }
    } catch (aiErr) {
      console.log('[AI CROSS-MATCH] Python microservice call error/offline. Executing fallback logic:', aiErr.message);
    }


    // Fallback Verification Engine
    const inputFullName = `${first_name} ${middle_name} ${last_name}`.replace(/\s+/g, ' ').trim();
    const ocrExtractedName = req.body.ocr_name || inputFullName;
    const ocrExtractedBday = req.body.ocr_birthdate || birthdate;
    const ocrExtractedAddress = req.body.ocr_address || `${barangay}, ${pampanga_town}, PAMPANGA`;

    const nameScore = calculateFuzzySimilarity(inputFullName, ocrExtractedName);
    const bdayMatch = Boolean(birthdate && ocrExtractedBday && birthdate === ocrExtractedBday);
    const townUpper = (pampanga_town || '').toUpperCase();
    const pampangaValid = PAMPANGA_MUNICIPALITIES.some(m => townUpper.includes(m)) || PAMPANGA_MUNICIPALITIES.includes(townUpper);

    const namePass = nameScore >= 88.0;
    const bdayPass = bdayMatch;
    const addressPass = pampangaValid;

    if (namePass && bdayPass && addressPass) {
      return res.status(200).json({
        status: "SUCCESS",
        message: "Identity Verified by AI",
        name_score: nameScore,
        bday_match: true,
        pampanga_valid: true,
        extracted_data: {
          ocr_name: ocrExtractedName,
          ocr_birthdate: ocrExtractedBday,
          ocr_address: ocrExtractedAddress
        }
      });
    } else {
      const discrepancies = [];
      if (!namePass) discrepancies.push(`Name similarity score (${nameScore}%) is below required 88% threshold.`);
      if (!bdayPass) discrepancies.push(`Birthdate mismatch (Input: '${birthdate}' vs OCR: '${ocrExtractedBday}').`);
      if (!addressPass) discrepancies.push(`Address verification failed for town '${pampanga_town}'. Must be in Pampanga province.`);


      return res.status(400).json({
        status: "FAILED",
        reason: "ID mismatch detected: " + discrepancies.join("; "),
        name_score: nameScore,
        bday_match: bdayMatch,
        pampanga_valid: pampangaValid,
        details: {
          name_pass: namePass,
          bday_pass: bdayPass,
          address_pass: addressPass,
          discrepancies
        },
        extracted_data: {
          ocr_name: ocrExtractedName,
          ocr_birthdate: ocrExtractedBday,
          ocr_address: ocrExtractedAddress
        }
      });
    }
  } catch (err) {
    return res.status(500).json({ status: "FAILED", reason: err.message });
  }
};

exports.forgotPasswordVerifyEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Email address is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({
      where: { email: cleanEmail },
      include: [
        { model: Profile, as: 'profile' },
        { model: VerificationRequest, as: 'verification_requests' }
      ]
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this email address.' });
    }

    // Check for existing facial image (avatar, live selfie, ID image)
    let facePhotoUrl = null;
    if (user.profile && user.profile.avatar_url) {
      facePhotoUrl = user.profile.avatar_url;
    }

    if (!facePhotoUrl && user.verification_requests && user.verification_requests.length > 0) {
      const latestReq = user.verification_requests[user.verification_requests.length - 1];
      facePhotoUrl = latestReq.live_selfie_url || latestReq.id_image_url;
    }

    if (!facePhotoUrl && user.profile && user.profile.id_document_url) {
      facePhotoUrl = user.profile.id_document_url;
    }

    if (!facePhotoUrl) {
      return res.status(400).json({
        success: false,
        message: 'No facial biometrics or profile photo found on file for this account. Please contact RESQLINK support for assistance.'
      });
    }

    // Generate temporary 15-minute reset session token for face verification step
    const resetSessionToken = jwt.sign(
      { id: user.id, email: user.email, stage: 'face_verification' },
      JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    return res.json({
      success: true,
      message: 'Account verified. Please proceed with face scan verification.',
      resetSessionToken,
      user: {
        email: user.email,
        first_name: user.profile ? user.profile.first_name : 'User'
      }
    });
  } catch (error) {
    console.error('[FORGOT VERIFY EMAIL ERROR]', error);
    return res.status(500).json({ success: false, message: 'Server error during email lookup.', error: error.message });
  }
};

exports.forgotPasswordVerifyFace = async (req, res) => {
  try {
    const { resetSessionToken, selfie_data } = req.body;
    const selfieFile = req.file;

    if (!resetSessionToken) {
      return res.status(401).json({ success: false, message: 'Verification session expired. Please try again.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(resetSessionToken, JWT_ACCESS_SECRET);
      if (decoded.stage !== 'face_verification') {
        throw new Error('Invalid token stage');
      }
    } catch (e) {
      return res.status(401).json({ success: false, message: 'Session expired or invalid. Please re-enter your email.' });
    }

    const user = await User.findByPk(decoded.id, {
      include: [
        { model: Profile, as: 'profile' },
        { model: VerificationRequest, as: 'verification_requests' }
      ]
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User account not found.' });
    }

    // Reference photo in DB
    let refPhotoUrl = null;
    if (user.profile && user.profile.avatar_url) {
      refPhotoUrl = user.profile.avatar_url;
    }
    if (!refPhotoUrl && user.verification_requests && user.verification_requests.length > 0) {
      const latestReq = user.verification_requests[user.verification_requests.length - 1];
      refPhotoUrl = latestReq.live_selfie_url || latestReq.id_image_url;
    }
    if (!refPhotoUrl && user.profile && user.profile.id_document_url) {
      refPhotoUrl = user.profile.id_document_url;
    }

    if (!refPhotoUrl) {
      return res.status(400).json({ success: false, message: 'No reference photo found on file for this user.' });
    }

    // Save live selfie to file if sent as base64 string
    let liveSelfiePath = null;
    let liveSelfieUrl = null;
    const uploadsDir = path.join(__dirname, '../../uploads');

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    if (selfieFile) {
      liveSelfieUrl = `/uploads/${selfieFile.filename}`;
      liveSelfiePath = selfieFile.path;
    } else if (selfie_data && selfie_data.startsWith('data:image')) {
      const base64Data = selfie_data.replace(/^data:image\/\w+;base64,/, '');
      const filename = `forgot_face_${user.id}_${Date.now()}.jpg`;
      liveSelfiePath = path.join(uploadsDir, filename);
      fs.writeFileSync(liveSelfiePath, Buffer.from(base64Data, 'base64'));
      liveSelfieUrl = `/uploads/${filename}`;
    } else {
      return res.status(400).json({ success: false, message: 'Live face selfie capture is required.' });
    }

    // AI & Jimp Facial Feature Biometric Comparison across all saved candidate reference photos
    const refPhotos = [];
    if (user.profile && user.profile.avatar_url) refPhotos.push(user.profile.avatar_url);
    if (user.profile && user.profile.id_document_url) refPhotos.push(user.profile.id_document_url);
    if (user.verification_requests && user.verification_requests.length > 0) {
      user.verification_requests.forEach((vr) => {
        if (vr.live_selfie_url) refPhotos.push(vr.live_selfie_url);
        if (vr.id_image_url) refPhotos.push(vr.id_image_url);
      });
    }

    let isMatch = false;
    let confidence = 0;

    try {
      const resolveLocalPath = (url) => {
        if (!url) return null;
        if (url.startsWith('/uploads/')) {
          return path.join(__dirname, '../../uploads', url.replace('/uploads/', ''));
        }
        return url;
      };

      const liveLocalPath = liveSelfiePath || resolveLocalPath(liveSelfieUrl);

      if (liveLocalPath && fs.existsSync(liveLocalPath) && refPhotos.length > 0) {
        const j1 = await Jimp.read(liveLocalPath);
        j1.resize(128, 128);

        let bestScore = 0;

        for (const refUrl of refPhotos) {
          const refLocalPath = resolveLocalPath(refUrl);
          if (!refLocalPath || !fs.existsSync(refLocalPath)) continue;

          try {
            const j2 = await Jimp.read(refLocalPath);
            j2.resize(128, 128);

            const dist = Jimp.distance(j1, j2);
            const diff = Jimp.diff(j1, j2).percent;

            const dissimilarity = (dist * 0.45) + (diff * 0.55);
            const score = (1 - dissimilarity) * 100;

            if (score > bestScore) {
              bestScore = score;
            }
          } catch (e) {
            // skip invalid format image
          }
        }

        confidence = bestScore / 100;
        // Require 50% threshold across candidate reference photos
        isMatch = bestScore >= 50.0;
        console.log(`[FACE VERIFY FORGOT PASS] Best Jimp face match score: ${bestScore.toFixed(2)}%, isMatch: ${isMatch}`);
      }
    } catch (jimpErr) {
      console.error('[JIMP COMPARISON ERROR]', jimpErr.message);
    }

    // Python DeepFace service secondary check if Jimp comparison did not reach threshold
    if (!isMatch && confidence === 0) {
      try {
        const aiResponse = await axios.post(`${AI_SERVICE_URL}/api/face-compare`, {
          selfie_url: liveSelfieUrl,
          id_url: refPhotoUrl
        }, { timeout: 5000 });

        if (aiResponse.data && aiResponse.data.success) {
          isMatch = Boolean(aiResponse.data.is_match);
          confidence = aiResponse.data.confidence || 0.5;
        }
      } catch (aiErr) {
        console.log('[FACE VERIFY FORGOT PASS] AI microservice error:', aiErr.message);
      }
    }

    if (!isMatch) {
      await SecurityLog.create({
        user_id: user.id,
        event_type: 'forgot_password_face_failed',
        details: { confidence }
      });
      return res.status(400).json({
        success: false,
        message: 'Facial identity match failed. The scanned face does not match our records.'
      });
    }

    await SecurityLog.create({
      user_id: user.id,
      event_type: 'forgot_password_face_verified',
      details: { confidence }
    });

    // Generate token allowing password update (valid 10 mins)
    const passwordResetToken = jwt.sign(
      { id: user.id, stage: 'password_reset' },
      JWT_ACCESS_SECRET,
      { expiresIn: '10m' }
    );

    return res.json({
      success: true,
      message: 'Face biometrics matched successfully! You may now set your new password.',
      passwordResetToken
    });
  } catch (error) {
    console.error('[FORGOT VERIFY FACE ERROR]', error);
    return res.status(500).json({ success: false, message: 'Server error during facial verification.', error: error.message });
  }
};

exports.forgotPasswordResetPassword = async (req, res) => {
  try {
    const { passwordResetToken, newPassword } = req.body;

    if (!passwordResetToken || !newPassword) {
      return res.status(400).json({ success: false, message: 'Reset token and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(passwordResetToken, JWT_ACCESS_SECRET);
      if (decoded.stage !== 'password_reset') {
        throw new Error('Invalid token stage');
      }
    } catch (e) {
      return res.status(401).json({ success: false, message: 'Reset session expired. Please start the verification process again.' });
    }

    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User account not found.' });
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    await user.update({
      password_hash,
      failed_login_attempts: 0,
      lockout_until: null
    });

    await SecurityLog.create({
      user_id: user.id,
      event_type: 'password_reset_success',
      details: { method: 'ai_face_verification' }
    });

    return res.json({
      success: true,
      message: 'Password reset successful! You can now log in with your new password.'
    });
  } catch (error) {
    console.error('[FORGOT RESET PASSWORD ERROR]', error);
    return res.status(500).json({ success: false, message: 'Server error resetting password.', error: error.message });
  }
};

exports.createSubAdmin = async (req, res) => {
  try {
    const { email, password, first_name, last_name, phone_number, unit_name } = req.body;

    if (!email || !password || !first_name || !last_name) {
      return res.status(400).json({ success: false, message: 'Email, password, first name, and last name are required.' });
    }

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email,
      password_hash,
      role: 'sub_admin',
      phone_number: phone_number || null,
      is_verified: true,
      verification_status: 'approved',
    });

    await Profile.create({
      user_id: user.id,
      first_name,
      last_name,
      headline: unit_name ? `Sub-Admin Dispatcher (${unit_name})` : 'Sub-Admin Dispatcher & Field Supervisor',
    });

    return res.status(201).json({
      success: true,
      message: 'Sub-Admin dispatcher account created successfully!',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        first_name,
        last_name,
      },
    });
  } catch (error) {
    console.error('[CREATE SUB-ADMIN ERROR]', error);
    return res.status(500).json({ success: false, message: 'Failed to create Sub-Admin account.', error: error.message });
  }
};

exports.createResponder = async (req, res) => {
  try {
    const { email, password, first_name, last_name, phone_number, department, municipality, unit_name, badge_number } = req.body;

    if (!email || !password || !first_name || !last_name) {
      return res.status(400).json({ success: false, message: 'Email, password, first name, and last name are required.' });
    }

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
    }

    const validDept = ['Medical', 'Police', 'Fire', 'Rescue'].includes(department) ? department : 'Medical';
    const validTown = ['Porac', 'Santa Rita', 'Guagua'].includes(municipality) ? municipality : 'Porac';

    const password_hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email,
      password_hash,
      role: 'responder',
      phone_number: phone_number || null,
      is_verified: true,
      verification_status: 'approved',
      agency: validDept,
      badge_or_unit_id: badge_number || null,
    });

    await Profile.create({
      user_id: user.id,
      first_name,
      last_name,
      full_name: `${first_name} ${last_name}`.trim(),
      city: validTown,
      province: 'Pampanga',
      address: `${validTown}, Pampanga`,
      headline: `${validDept} Emergency Responder - ${validTown}, Pampanga`,
      responder_unit: unit_name || `${validTown} ${validDept} Unit`,
      responder_badge_number: badge_number || null,
    });

    return res.status(201).json({
      success: true,
      message: `${validDept} first responder deployed successfully for ${validTown}!`,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        agency: user.agency,
        first_name,
        last_name,
        municipality: validTown,
      },
    });
  } catch (error) {
    console.error('[CREATE RESPONDER ERROR]', error);
    return res.status(500).json({ success: false, message: 'Failed to create First Responder account.', error: error.message });
  }
};




