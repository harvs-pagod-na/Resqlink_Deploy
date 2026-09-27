const { User, Profile } = require('../models');

exports.getUserReputation = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ success: false, message: 'User ID parameter is required.' });
  }

  try {
    const user = await User.findByPk(id, {
      attributes: ['id', 'email', 'role', 'is_verified'],
      include: [
        { model: Profile, as: 'profile' },
      ],
    });

    if (!user) {
      return res.json({
        success: true,
        reputation: {
          user_id: Number(id),
          is_verified: false,
          reviews: [],
        },
      });
    }

    return res.json({
      success: true,
      reputation: {
        user_id: user.id,
        role: user.role,
        is_verified: user.is_verified,
        profile: user.profile,
        reviews: [],
      },
    });
  } catch (err) {
    console.error('Fetch User Reputation Error:', err);
    return res.json({
      success: true,
      reputation: {
        user_id: Number(id),
        is_verified: false,
        reviews: [],
      },
    });
  }
};
