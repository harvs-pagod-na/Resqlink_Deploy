/**
 * Municipal Jurisdiction Enforcement Helper
 * Determines whether the authenticated user has global provincial access (Super Admin)
 * or is strictly scoped to their assigned municipality (Porac, Santa Rita, Guagua).
 */
function getAdminJurisdiction(user) {
  if (!user) return 'all';

  const role = user.role || '';
  const email = (user.email || '').toLowerCase();

  // Super Admins have unrestricted access to all municipalities
  if (role === 'super_admin' || email.includes('superadmin')) {
    return 'all';
  }

  // Check profile city
  if (user.profile?.city && ['Porac', 'Santa Rita', 'Guagua'].includes(user.profile.city)) {
    return user.profile.city;
  }

  // Fallback to email detection
  if (email.includes('porac')) return 'Porac';
  if (email.includes('santarita') || email.includes('santa rita')) return 'Santa Rita';
  if (email.includes('guagua')) return 'Guagua';

  return 'all';
}

function getUserJurisdiction(user) {
  if (!user) return 'Other';

  const role = user.role || '';
  const email = (user.email || '').toLowerCase();

  // Super Admins belong to Provincial Central Command
  if (role === 'super_admin' || email.includes('superadmin')) {
    return 'Provincial Command';
  }

  if (user.municipality && ['Porac', 'Santa Rita', 'Guagua'].includes(user.municipality)) {
    return user.municipality;
  }

  const city = user.profile?.city || '';
  if (['Porac', 'Santa Rita', 'Guagua'].includes(city)) {
    return city;
  }

  if (email.includes('porac')) return 'Porac';
  if (email.includes('santarita') || email.includes('santa rita')) return 'Santa Rita';
  if (email.includes('guagua')) return 'Guagua';

  const text = `${user.profile?.address || ''} ${user.profile?.barangay || ''} ${user.address || ''} ${city}`.toLowerCase();
  if (text.includes('santa rita') || text.includes('sta. rita') || text.includes('starita') || text.includes('san basilio') || text.includes('becuran') || text.includes('dila dila')) {
    return 'Santa Rita';
  }
  if (text.includes('guagua') || text.includes('pulungmasle') || text.includes('ascomo') || text.includes('bancal')) {
    return 'Guagua';
  }
  if (text.includes('porac') || text.includes('cangatba') || text.includes('manibaug') || text.includes('pulung santol') || text.includes('inararo')) {
    return 'Porac';
  }

  if (user.profile?.latitude) {
    const lat = parseFloat(user.profile.latitude);
    if (lat >= 15.035) return 'Porac';
    if (lat >= 14.985) return 'Santa Rita';
    return 'Guagua';
  }

  return 'Other';
}

function isUserInJurisdiction(user, targetJurisdiction) {
  if (!targetJurisdiction || targetJurisdiction === 'all') return true;
  return getUserJurisdiction(user) === targetJurisdiction;
}

module.exports = {
  getAdminJurisdiction,
  getUserJurisdiction,
  isUserInJurisdiction,
};

