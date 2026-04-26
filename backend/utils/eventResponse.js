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

  if (/^(data:|file:|content:)/i.test(uri)) {
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
      const uri = canonicalizePhotoUri(normalized.uri || normalized.photoUrl || normalized.photo_url);

      return {
        ...normalized,
        uri,
        photoUrl: uri,
        photo_url: uri,
      };
    }).filter(Boolean)
    : [];
  const derivedMilestones = [
    event?.startPhotoUrl ? {
      id: `start-photo-${event?.id || 'event'}`,
      uri: canonicalizePhotoUri(event.startPhotoUrl),
      photoUrl: canonicalizePhotoUri(event.startPhotoUrl),
      photo_url: canonicalizePhotoUri(event.startPhotoUrl),
      createdAt: event.startRealAt || null,
      source: 'start_photo',
      milestoneType: 'start_photo',
      author: null,
    } : null,
    event?.endPhotoUrl ? {
      id: `end-photo-${event?.id || 'event'}`,
      uri: canonicalizePhotoUri(event.endPhotoUrl),
      photoUrl: canonicalizePhotoUri(event.endPhotoUrl),
      photo_url: canonicalizePhotoUri(event.endPhotoUrl),
      createdAt: event.endRealAt || null,
      source: 'end_photo',
      milestoneType: 'end_photo',
      author: null,
    } : null,
  ].filter(Boolean).map(normalizePhotoEntry);

  const merged = new Map();
  [...photos, ...derivedMilestones].forEach((photo) => {
    if (!photo?.uri) return;
    const key = photo.uri;
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
