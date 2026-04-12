const { normalizeComparableValue } = require('./adminRecords');

const normalizeClientMutationPayload = (payload = {}) => ({
  username: String(payload.username || '').trim(),
  password: String(payload.password || '').trim(),
  razonSocial: String(payload.razonSocial || '').trim(),
  nit: String(payload.nit || '').trim(),
  contactFullName: String(payload.contactFullName || '').trim(),
  contactRole: String(payload.contactRole || '').trim(),
  phone: String(payload.phone || '').trim(),
  whatsappPhone: String(payload.whatsappPhone || payload.phone || '').trim(),
  email: String(payload.email || '').trim().toLowerCase() || null,
});

const matchesClientIdentityConflict = ({ user, client, normalizedPayload, excludeUserId = null, excludeClientId = null }) => {
  if (user && Number(user.id) !== Number(excludeUserId)) {
    if (normalizeComparableValue(user.username) === normalizeComparableValue(normalizedPayload.username)) return true;
  }

  if (client && Number(client.id || client.clientId) !== Number(excludeClientId)) {
    if (normalizedPayload.nit && normalizeComparableValue(client.nit) === normalizeComparableValue(normalizedPayload.nit)) return true;
  }

  return false;
};

module.exports = {
  matchesClientIdentityConflict,
  normalizeClientMutationPayload,
};
