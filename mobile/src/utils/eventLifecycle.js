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

export const getEventStatus = (event, now = new Date()) => {
  const currentKey = toLocalCalendarKey(now);
  const startKey = toLocalCalendarKey(event?.startDate || event?.start_date);
  const endKey = toLocalCalendarKey(event?.endDate || event?.end_date);

  if (!currentKey || !startKey || !endKey) {
    return 'finalized';
  }

  if (event?.inactiveReason === 'manual' || event?.manualInactivatedAt || event?.manual_inactivated_at) {
    return 'finalized';
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
  const status = event?.eventStatus || getEventStatus(event);
  if (status === 'active') {
    return null;
  }

  if (status === 'not_started') {
    return 'NO INICIADO';
  }

  return event.inactiveReason === 'manual' ? 'INACTIVO MANUAL' : 'FINALIZADO';
};

export const getInactiveDescription = (event) => {
  const status = event?.eventStatus || getEventStatus(event);
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
