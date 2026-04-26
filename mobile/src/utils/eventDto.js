import { normalizeEventStatus } from './eventLifecycle';
import { normalizePhotos } from './eventAssets';

const normalizePhotoUri = (value, photoBaseUrl = '') => {
  const uri = String(value || '').trim();
  if (!uri) return '';

  if (/^(data:|file:|content:)/i.test(uri)) {
    return uri;
  }

  if (uri.startsWith('/')) {
    return `${String(photoBaseUrl || '').replace(/\/$/, '')}${uri}`;
  }

  try {
    const parsed = new URL(uri);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      const base = String(photoBaseUrl || '').replace(/\/$/, '');
      return base ? `${base}${parsed.pathname}${parsed.search}${parsed.hash}` : uri;
    }
  } catch (_) {
    return uri;
  }

  return uri;
};

const normalizeExecutive = (event) => {
  const source = event?.executive || event?.executiveContact || null;

  if (!source) {
    return null;
  }

  const id = Number(source.id || source.userId || source.user_id || event?.executiveId || event?.createdByUserId || 0) || null;
  const name = source.name || source.fullName || source.full_name || source.username || 'Ejecutivo';

  return {
    id,
    name,
    fullName: source.fullName || source.full_name || name,
    phone: source.phone || null,
    whatsappPhone: source.whatsappPhone || source.whatsapp_phone || source.phone || null,
    email: source.email || null,
  };
};

export const normalizeEventDto = (event, { photoBaseUrl = '' } = {}) => {
  if (!event || typeof event !== 'object') {
    return event;
  }

  const eventStatus = normalizeEventStatus(event.eventStatus || event.event_status);
  const statusLabel = event.statusLabel || event.eventStatusLabel || null;
  const executive = normalizeExecutive(event);
  const photos = normalizePhotos(event.photos).map((photo) => ({
    ...photo,
    uri: normalizePhotoUri(photo.uri || photo.photoUrl || photo.photo_url, photoBaseUrl),
    photoUrl: normalizePhotoUri(photo.photoUrl || photo.photo_url || photo.uri, photoBaseUrl),
    photo_url: normalizePhotoUri(photo.photo_url || photo.photoUrl || photo.uri, photoBaseUrl),
  }));

  return {
    ...event,
    eventStatus,
    event_status: eventStatus,
    statusLabel,
    eventStatusLabel: event.eventStatusLabel || statusLabel,
    photos,
    executive,
    executiveContact: executive,
  };
};

export const normalizeEventDtoList = (events, options = {}) => (Array.isArray(events) ? events.map((event) => normalizeEventDto(event, options)) : []);
