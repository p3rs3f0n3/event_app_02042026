const parseDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toLocalCalendarKey = (value) => {
  const date = parseDate(value);
  if (!date) {
    return null;
  }

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
};

export const normalizeEventStatus = (value) => {
  const status = String(value || '').toLowerCase();

  if (status === 'started') {
    return 'active';
  }

  if (status === 'active' || status === 'not_started' || status === 'finalized') {
    return status;
  }

  return status;
};

export const getEventStatus = (event, now = new Date()) => {
  const currentKey = toLocalCalendarKey(now);
  const startKey = toLocalCalendarKey(event?.startDate || event?.start_date);
  const endKey = toLocalCalendarKey(event?.endDate || event?.end_date);
  const storedStatus = normalizeEventStatus(event?.eventStatus || event?.event_status);

  if (event?.inactiveReason === 'manual' || event?.manualInactivatedAt || event?.manual_inactivated_at) {
    return 'finalized';
  }

  if (storedStatus === 'finalized') {
    return 'finalized';
  }

  if (storedStatus === 'active') {
    if (currentKey && endKey && currentKey > endKey) {
      return 'finalized';
    }

    return 'active';
  }

  if (!currentKey || !startKey || !endKey) {
    return 'not_started';
  }

  if (currentKey < startKey) {
    return 'not_started';
  }

  if (currentKey > endKey) {
    return 'finalized';
  }

  return 'active';
};

export const isEventCurrentlyActive = (event, now = new Date()) => getEventStatus(event, now) === 'active';

export const getInactiveBadgeLabel = (event) => {
  const status = getEventStatus(event);
  if (status === 'active') {
    return null;
  }

  if (status === 'not_started') {
    return 'NO INICIADO';
  }

  return event.inactiveReason === 'manual' ? 'INACTIVO MANUAL' : 'FINALIZADO';
};

export const getInactiveDescription = (event) => {
  const status = getEventStatus(event);
  if (status === 'active') {
    return null;
  }

  if (status === 'not_started') {
    return 'El evento aún no ha iniciado';
  }

  if (event.inactiveReason === 'manual') {
    return event.manualInactivationComment || 'Evento inactivado manualmente por el ejecutivo';
  }

  return 'El evento ha finalizado';
};

export { parseDate, toLocalCalendarKey };
