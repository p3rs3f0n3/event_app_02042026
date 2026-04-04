const { normalizeComparableValue, normalizePhoneValue } = require('./adminRecords');

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
    if (normalizedPayload.email && normalizeComparableValue(user.email) === normalizeComparableValue(normalizedPayload.email)) return true;
    if (normalizedPayload.phone && normalizePhoneValue(user.phone) === normalizePhoneValue(normalizedPayload.phone)) return true;
    if (normalizedPayload.whatsappPhone && normalizePhoneValue(user.whatsappPhone || user.whatsapp_phone) === normalizePhoneValue(normalizedPayload.whatsappPhone)) return true;
  }

  if (client && Number(client.id || client.clientId) !== Number(excludeClientId)) {
    if (normalizedPayload.nit && normalizeComparableValue(client.nit) === normalizeComparableValue(normalizedPayload.nit)) return true;
    if (normalizedPayload.email && normalizeComparableValue(client.email) === normalizeComparableValue(normalizedPayload.email)) return true;
    if (normalizedPayload.phone && normalizePhoneValue(client.phone) === normalizePhoneValue(normalizedPayload.phone)) return true;
    if (normalizedPayload.whatsappPhone && normalizePhoneValue(client.whatsappPhone || client.whatsapp_phone) === normalizePhoneValue(normalizedPayload.whatsappPhone)) return true;
    if (normalizedPayload.razonSocial && normalizeComparableValue(client.razonSocial || client.razon_social) === normalizeComparableValue(normalizedPayload.razonSocial)) return true;
    if (normalizedPayload.contactFullName && normalizeComparableValue(client.contactFullName || client.contact_full_name) === normalizeComparableValue(normalizedPayload.contactFullName)) return true;
  }

  return false;
};

module.exports = {
  matchesClientIdentityConflict,
  normalizeClientMutationPayload,
};
