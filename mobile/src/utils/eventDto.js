import { normalizeEventStatus } from './eventLifecycle';

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

export const normalizeEventDto = (event) => {
  if (!event || typeof event !== 'object') {
    return event;
  }

  const eventStatus = normalizeEventStatus(event.eventStatus || event.event_status);
  const executive = normalizeExecutive(event);

  return {
    ...event,
    eventStatus,
    event_status: eventStatus,
    executive,
    executiveContact: executive,
  };
};

export const normalizeEventDtoList = (events) => (Array.isArray(events) ? events.map(normalizeEventDto) : []);
