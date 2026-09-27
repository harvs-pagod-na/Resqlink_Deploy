/**
 * RESQLINK Verification Authorization Middleware
 * Ensures unverified accounts CANNOT apply for jobs or post job listings
 * until verification_status === 'verified' (or 'approved').
 */

const requireVerifiedUser = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  // Super Admins bypass verification checks
  if (req.user.role === 'super_admin') {
    return next();
  }

  const status = req.user.verification_status;
  const isVerified = req.user.is_verified;

  if (!isVerified || (status !== 'verified' && status !== 'approved')) {
    return res.status(403).json({
      success: false,
      message: 'Access Restricted: Your account must be verified by AI & Admin before applying for jobs or posting job listings.',
      verification_status: status || 'unverified',
      is_verified: false,
      action_required: 'Please complete your Pampanga ID document onboarding verification.',
    });
  }

  next();
};

module.exports = { requireVerifiedUser };
