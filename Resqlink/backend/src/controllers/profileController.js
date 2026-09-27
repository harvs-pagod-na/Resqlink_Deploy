const { User, Profile } = require('../models');

exports.getProfile = async (req, res) => {
  const { userId } = req.params;
  const targetId = userId || req.user.id;

  const user = await User.findByPk(targetId, {
    attributes: { exclude: ['password_hash', 'refresh_token'] },
    include: [
      { model: Profile, as: 'profile' },
    ],
  });

  if (!user) {
    return res.status(404).json({ success: false, message: 'User profile not found.' });
  }

  return res.json({ success: true, user });
};

exports.updateProfile = async (req, res) => {
  const profile = await Profile.findOne({ where: { user_id: req.user.id } });
  if (profile) {
    await profile.update(req.body);
  }

  const updatedUser = await User.findByPk(req.user.id, {
    attributes: { exclude: ['password_hash', 'refresh_token'] },
    include: [
      { model: Profile, as: 'profile' },
    ],
  });

  return res.json({ success: true, message: 'Profile updated successfully!', user: updatedUser });
};

exports.uploadDocument = async (req, res) => {
  const file = req.file;
  const { doc_type } = req.body; // 'avatar', 'certification', etc.

  if (!file) {
    return res.status(400).json({ success: false, message: 'No file uploaded.' });
  }

  const filePath = `/uploads/${file.filename}`;
  const profile = await Profile.findOne({ where: { user_id: req.user.id } });

  if (doc_type === 'avatar') {
    if (profile) await profile.update({ avatar_url: filePath });
  } else if (doc_type === 'certification') {
    if (profile) {
      const existingCerts = profile.certifications || [];
      existingCerts.push({
        name: file.originalname,
        url: filePath,
        uploaded_at: new Date(),
      });
      await profile.update({ certifications: existingCerts });
    }
  }

  return res.json({ success: true, message: 'File uploaded successfully!', file_url: filePath });
};
