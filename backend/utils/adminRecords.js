const DEFAULT_PROFILE_PHOTO = 'https://i.pravatar.cc/150?u=eventapp';
const STAFF_CATEGORIES = ['BARISTAS', 'IMPULSADORES', 'LOGISTICOS'];

const normalizeComparableValue = (value) => String(value || '').trim().toLowerCase();
const normalizePhoneValue = (value) => String(value || '').replace(/\D/g, '');
const normalizeDocumentValue = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const normalizeNitValue = (value) => {
  const rawValue = String(value || '').trim().toLowerCase();
  if (!rawValue) {
    return {
      raw: '',
      full: '',
      base: '',
      candidates: [],
    };
  }

  const full = rawValue.replace(/[^a-z0-9]/g, '');
  const hyphenBase = rawValue.includes('-') ? rawValue.split('-')[0] : rawValue;
  const base = hyphenBase.replace(/[^a-z0-9]/g, '');
  const candidates = [...new Set([
    full,
    base,
    !rawValue.includes('-') && full.length > 1 ? full.slice(0, -1) : '',
  ].filter(Boolean))];

  return {
    raw: rawValue,
    full,
    base,
    candidates,
  };
};

const isNitEquivalent = (leftValue, rightValue) => {
  const leftCandidates = normalizeNitValue(leftValue).candidates;
  const rightCandidates = normalizeNitValue(rightValue).candidates;

  if (leftCandidates.length === 0 || rightCandidates.length === 0) {
    return false;
  }

  return leftCandidates.some((candidate) => rightCandidates.includes(candidate));
};

const isDocumentEquivalent = (leftValue, rightValue) => {
  const leftDocument = normalizeDocumentValue(leftValue);
  const rightDocument = normalizeDocumentValue(rightValue);

  if (!leftDocument || !rightDocument) {
    return false;
  }

  return leftDocument === rightDocument;
};

const sanitizeClientRecord = ({ client, user = null }) => ({
  id: Number(user?.id || client.userId || client.user_id || client.id || 0) || null,
  clientId: Number(client.id || client.clientId || 0) || null,
  userId: Number(client.userId || client.user_id || user?.id || 0) || null,
  username: user?.username || client.username || null,
  fullName: client.razonSocial || client.razon_social || user?.fullName || user?.full_name || client.contactFullName || client.contact_full_name || null,
  razonSocial: client.razonSocial || client.razon_social || user?.fullName || user?.full_name || null,
  nit: client.nit || null,
  contactFullName: client.contactFullName || client.contact_full_name || user?.fullName || user?.full_name || null,
  contactRole: client.contactRole || client.contact_role || null,
  phone: client.phone || user?.phone || null,
  whatsappPhone: client.whatsappPhone || client.whatsapp_phone || user?.whatsappPhone || user?.whatsapp_phone || null,
  email: client.email || user?.email || null,
  role: 'CLIENTE',
  isActive: client.isActive ?? client.is_active ?? user?.isActive ?? true,
});

const sanitizeUserRecord = (user) => ({
  id: Number(user.id),
  username: user.username,
  fullName: user.fullName || user.full_name,
  phone: user.phone || null,
  whatsappPhone: user.whatsappPhone || user.whatsapp_phone || null,
  email: user.email || null,
  role: user.role,
});

const sanitizeCoordinatorAdminRecord = ({ coordinator, user = null }) => ({
  id: Number(coordinator.id),
  userId: Number(coordinator.userId || coordinator.user_id || user?.id || 0) || null,
  username: user?.username || null,
  fullName: coordinator.name || coordinator.fullName || coordinator.full_name,
  cedula: coordinator.cedula,
  address: coordinator.address,
  phone: coordinator.phone || null,
  whatsappPhone: user?.whatsappPhone || user?.whatsapp_phone || null,
  email: user?.email || null,
  city: coordinator.city,
  rating: Number(coordinator.rating || 0),
  photo: coordinator.photo || DEFAULT_PROFILE_PHOTO,
});

const sanitizeStaffAdminRecord = (staffMember) => ({
  id: Number(staffMember.id),
  fullName: staffMember.name || staffMember.fullName || staffMember.full_name,
  cedula: staffMember.cedula,
  city: staffMember.city,
  category: staffMember.category,
  photo: staffMember.photo || DEFAULT_PROFILE_PHOTO,
  clothingSize: staffMember.clothingSize || staffMember.clothing_size || null,
  shoeSize: staffMember.shoeSize || staffMember.shoe_size || null,
  measurements: staffMember.measurements || null,
});

module.exports = {
  DEFAULT_PROFILE_PHOTO,
  STAFF_CATEGORIES,
  isDocumentEquivalent,
  normalizeComparableValue,
  normalizeDocumentValue,
  normalizeNitValue,
  normalizePhoneValue,
  isNitEquivalent,
  sanitizeClientRecord,
  sanitizeCoordinatorAdminRecord,
  sanitizeStaffAdminRecord,
  sanitizeUserRecord,
};
