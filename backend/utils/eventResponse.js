const { enrichEventLifecycle } = require('./eventLifecycle');
const { normalizeExecutiveContact } = require('./coordinatorEvents');
const { normalizePhotoEntry } = require('./eventAssets');

const EVENT_CRITICAL_FIELDS = ['eventStatus', 'startDate', 'endDate', 'startRealAt', 'endRealAt'];

const warnMissingEventFields = (event, source = 'event') => {
  const missing = EVENT_CRITICAL_FIELDS.filter((field) => event?.[field] === undefined);
  if (missing.length > 0) {
    console.warn('[events] response missing critical fields', {
      source,
      eventId: event?.id ?? null,
      missing,
    });
  }
};

const canonicalizePhotoUri = (value) => {
  const uri = String(value || '').trim();
  if (!uri) return '';

  // We no longer return base64 in canonical responses to force using physical files
  if (/^(data:)/i.test(uri)) {
    console.warn('[events] base64 found in canonical response, this should be avoided');
    return uri; // Keep it if it somehow leaked, but the goal is to not have it here
  }

  if (/^(file:|content:)/i.test(uri)) {
    return uri;
  }

  try {
    const parsed = new URL(uri);
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch (_) {
    return uri.startsWith('/') ? uri : `/${uri}`;
  }
};

const mergeCanonicalPhotos = (event) => {
  const photos = Array.isArray(event?.photos)
    ? event.photos.map((photo) => {
      const normalized = normalizePhotoEntry(photo);
      if (!normalized) return null;
      const photo_url = canonicalizePhotoUri(normalized.photo_url || normalized.uri || normalized.photoUrl);

      return {
        ...normalized,
        photo_url,
      };
    }).filter(Boolean)
    : [];

  const derivedMilestones = [
    event?.startPhotoUrl ? {
      id: `start-photo-${event?.id || 'event'}`,
      photo_url: canonicalizePhotoUri(event.startPhotoUrl),
      createdAt: event.startRealAt || null,
      source: 'start_photo',
      milestoneType: 'start_photo',
      author: null,
    } : null,
    event?.endPhotoUrl ? {
      id: `end-photo-${event?.id || 'event'}`,
      photo_url: canonicalizePhotoUri(event.endPhotoUrl),
      createdAt: event.endRealAt || null,
      source: 'end_photo',
      milestoneType: 'end_photo',
      author: null,
    } : null,
  ].filter(Boolean).map(normalizePhotoEntry);

  const merged = new Map();
  [...photos, ...derivedMilestones].forEach((photo) => {
    if (!photo?.photo_url) return;
    const key = photo.photo_url;
    if (!merged.has(key)) {
      merged.set(key, photo);
    }
  });

  return Array.from(merged.values());
};

const normalizeExecutiveAssociation = (event, executiveContact = null) => {
  const normalizedContact = normalizeExecutiveContact(executiveContact || event?.executiveContact || null);
  const executiveId = Number(
    event?.executiveId
    || event?.createdByUserId
    || event?.created_by_user_id
    || normalizedContact?.userId
    || 0,
  ) || null;

  return {
    executiveId,
    createdByUserId: Number(event?.createdByUserId || event?.created_by_user_id || executiveId || 0) || null,
    executive: normalizedContact
      ? {
        id: normalizedContact.userId,
        name: normalizedContact.fullName,
        fullName: normalizedContact.fullName,
        phone: normalizedContact.phone,
        whatsappPhone: normalizedContact.whatsappPhone,
        email: normalizedContact.email,
      }
      : null,
    executiveContact: normalizedContact,
  };
};

const buildEventResponse = (event, { executiveContact = null } = {}) => {
  const canonicalEvent = enrichEventLifecycle(event);
  warnMissingEventFields(canonicalEvent, 'buildEventResponse');
  const executiveAssociation = normalizeExecutiveAssociation(canonicalEvent, executiveContact);

  return {
    ...canonicalEvent,
    statusLabel: canonicalEvent.eventStatusLabel || canonicalEvent.statusLabel || null,
    photos: mergeCanonicalPhotos(canonicalEvent),
    event_status: canonicalEvent.eventStatus,
    ...executiveAssociation,
  };
};

module.exports = {
  buildEventResponse,
  normalizeExecutiveAssociation,
};
