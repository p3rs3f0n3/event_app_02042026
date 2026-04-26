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

  if (status === 'created' || status === 'not_started') {
    return 'not_started';
  }

  if (status === 'started' || status === 'active') {
    return 'active';
  }

  if (status === 'finished' || status === 'finalized') {
    return 'finalized';
  }

  return status || 'not_started';
};

export const getEventStatus = (event, now = new Date()) => {
  const storedStatus = normalizeEventStatus(event?.eventStatus || event?.event_status);
  const hasStartRealAt = Boolean(parseDate(event?.startRealAt || event?.start_real_at));
  const hasEndRealAt = Boolean(parseDate(event?.endRealAt || event?.end_real_at));

  if (event?.inactiveReason === 'manual' || event?.manualInactivatedAt || event?.manual_inactivated_at) {
    return 'finalized';
  }

  if (hasEndRealAt || storedStatus === 'finalized') {
    return 'finalized';
  }

  if (hasStartRealAt || storedStatus === 'active') {
    return 'active';
  }

  return 'not_started';
};

export const isEventExpiredByDate = (event, now = new Date()) => {
  const currentKey = toLocalCalendarKey(now);
  const endKey = toLocalCalendarKey(event?.endDate || event?.end_date);

  if (!currentKey || !endKey) {
    return false;
  }

  return getEventStatus(event, now) === 'not_started' && currentKey > endKey;
};

export const isEventStartable = (event, now = new Date()) => {
  const currentKey = toLocalCalendarKey(now);
  const startKey = toLocalCalendarKey(event?.startDate || event?.start_date);
  const endKey = toLocalCalendarKey(event?.endDate || event?.end_date);

  if (!currentKey || !startKey || !endKey) {
    return false;
  }

  if (getEventStatus(event, now) !== 'not_started') {
    return false;
  }

  return currentKey >= startKey && currentKey <= endKey;
};

export const getEventVisualState = (event, now = new Date()) => {
  if (event?.inactiveReason === 'manual' || event?.manualInactivatedAt || event?.manual_inactivated_at) {
    return {
      key: 'manual_inactive',
      label: 'INACTIVO MANUAL',
      description: event?.manualInactivationComment || 'Evento inactivado manualmente por el ejecutivo',
      tone: 'muted',
      isInactive: true,
      inactiveReason: 'manual',
    };
  }

  const status = getEventStatus(event, now);

  if (status === 'active') {
    return {
      key: 'active',
      label: 'En curso',
      description: null,
      tone: 'success',
      isInactive: false,
      inactiveReason: null,
    };
  }

  if (status === 'finalized' || Boolean(parseDate(event?.endRealAt || event?.end_real_at))) {
    return {
      key: 'finished',
      label: 'Evento finalizado por el coordinador',
      description: 'El evento ha finalizado por el coordinador',
      tone: 'muted',
      isInactive: true,
      inactiveReason: 'finished',
    };
  }

  if (isEventExpiredByDate(event, now)) {
    return {
      key: 'expired',
      label: 'Evento inactivo por fecha',
      description: 'La fecha del evento ya venció sin iniciar',
      tone: 'warning',
      isInactive: true,
      inactiveReason: 'expired',
    };
  }

  return {
    key: 'pending',
    label: 'Pendiente',
    description: 'El evento aún no ha iniciado',
    tone: 'info',
    isInactive: false,
    inactiveReason: null,
  };
};

export const isEventCurrentlyActive = (event, now = new Date()) => getEventStatus(event, now) === 'active';

export const getInactiveBadgeLabel = (event) => {
  const visualState = getEventVisualState(event);
  return visualState.isInactive ? visualState.label : null;
};

export const getInactiveDescription = (event) => {
  const visualState = getEventVisualState(event);
  if (!visualState.isInactive) {
    return null;
  }

  return visualState.description;
};

export { parseDate, toLocalCalendarKey };
