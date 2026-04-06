const DEFAULT_PROFILE_PHOTO = 'https://i.pravatar.cc/150?u=eventapp';

const normalizePhotoMetadataValue = (value) => {
  const normalizedValue = String(value || '').trim();
  return normalizedValue || null;
};

const normalizePhotoFileSize = (value) => {
  const normalizedValue = Number(value);
  return Number.isFinite(normalizedValue) && normalizedValue > 0 ? normalizedValue : null;
};

const normalizeStoredProfilePhoto = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    const uri = normalizePhotoMetadataValue(value.uri || value.url || value.photoUrl || value.src);
    if (!uri) {
      return null;
    }

    return {
      uri,
      mimeType: normalizePhotoMetadataValue(value.mimeType || value.mime_type),
      fileName: normalizePhotoMetadataValue(value.fileName || value.file_name),
      fileSize: normalizePhotoFileSize(value.fileSize || value.file_size),
      source: normalizePhotoMetadataValue(value.source) || 'admin',
    };
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  if (trimmedValue.startsWith('{')) {
    try {
      return normalizeStoredProfilePhoto(JSON.parse(trimmedValue));
    } catch (error) {
      return { uri: trimmedValue, mimeType: null, fileName: null, fileSize: null, source: 'legacy' };
    }
  }

  return {
    uri: trimmedValue,
    mimeType: null,
    fileName: null,
    fileSize: null,
    source: 'legacy',
  };
};

const normalizeProfilePhotoField = (value) => {
  const normalizedPhoto = normalizeStoredProfilePhoto(value);
  const photo = normalizedPhoto?.uri || DEFAULT_PROFILE_PHOTO;
  const hasMetadata = Boolean(
    normalizedPhoto?.mimeType
      || normalizedPhoto?.fileName
      || normalizedPhoto?.fileSize
      || (normalizedPhoto?.source && normalizedPhoto.source !== 'legacy'),
  );

  return {
    photo,
    photoMetadata: hasMetadata
      ? {
        mimeType: normalizedPhoto.mimeType,
        fileName: normalizedPhoto.fileName,
        fileSize: normalizedPhoto.fileSize,
        source: normalizedPhoto.source,
      }
      : null,
  };
};

const serializeProfilePhotoField = (value) => {
  const normalizedPhoto = normalizeStoredProfilePhoto(value);
  if (!normalizedPhoto?.uri) {
    return DEFAULT_PROFILE_PHOTO;
  }

  if (!normalizedPhoto.mimeType && !normalizedPhoto.fileName && !normalizedPhoto.fileSize && (!normalizedPhoto.source || normalizedPhoto.source === 'legacy')) {
    return normalizedPhoto.uri;
  }

  return JSON.stringify(normalizedPhoto);
};

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
  ...normalizeProfilePhotoField(coordinator.photoMetadata ? { uri: coordinator.photo, ...coordinator.photoMetadata } : coordinator.photo),
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
});

const sanitizeStaffAdminRecord = (staffMember) => ({
  ...normalizeProfilePhotoField(staffMember.photoMetadata ? { uri: staffMember.photo, ...staffMember.photoMetadata } : staffMember.photo),
  id: Number(staffMember.id),
  fullName: staffMember.name || staffMember.fullName || staffMember.full_name,
  cedula: staffMember.cedula,
  city: staffMember.city,
  category: staffMember.category,
  clothingSize: staffMember.clothingSize || staffMember.clothing_size || null,
  shoeSize: staffMember.shoeSize || staffMember.shoe_size || null,
  measurements: staffMember.measurements || null,
});

module.exports = {
  DEFAULT_PROFILE_PHOTO,
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
  normalizeProfilePhotoField,
  normalizeStoredProfilePhoto,
  serializeProfilePhotoField,
};
