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

  if (status === 'created' || status === 'not_started' || status === 'pending') {
    return 'created';
  }

  if (status === 'started' || status === 'active') {
    return 'started';
  }

  if (status === 'finished' || status === 'finalized') {
    return 'finished';
  }

  if (status === 'inactive_by_date' || status === 'expired') {
    return 'inactive_by_date';
  }

  return status || 'created';
};

export const getEventStatus = (event, now = new Date()) => {
  // Primary source: backend provided status
  if (event?.eventStatus) {
    return normalizeEventStatus(event.eventStatus);
  }

  const storedStatus = normalizeEventStatus(event?.event_status);
  const hasStartRealAt = Boolean(parseDate(event?.startRealAt || event?.start_real_at));
  const hasEndRealAt = Boolean(parseDate(event?.endRealAt || event?.end_real_at));

  if (event?.inactiveReason === 'manual' || event?.manualInactivatedAt || event?.manual_inactivated_at || hasEndRealAt || storedStatus === 'finished') {
    return 'finished';
  }

  if (hasStartRealAt || storedStatus === 'started') {
    return 'started';
  }

  return 'created';
};

export const isEventExpiredByDate = (event, now = new Date()) => {
  return getEventStatus(event, now) === 'inactive_by_date';
};

export const isEventStartable = (event, now = new Date()) => {
  const status = getEventStatus(event, now);

  if (status !== 'created') {
    return false;
  }

  const currentKey = toLocalCalendarKey(now);
  const startKey = toLocalCalendarKey(event?.startDate || event?.start_date);
  const endKey = toLocalCalendarKey(event?.endDate || event?.end_date);

  if (!currentKey || !startKey || !endKey) {
    return false;
  }

  return currentKey >= startKey && currentKey <= endKey;
};

export const getEventVisualState = (event, now = new Date()) => {
  // If backend already provided the enriched visual state, use it
  if (event?.eventVisualState) {
    return event.eventVisualState;
  }

  const manualInactivatedAt = parseDate(event?.manualInactivatedAt || event?.manual_inactivated_at);
  if (event?.inactiveReason === 'manual' || manualInactivatedAt) {
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

  if (status === 'started') {
    return {
      key: 'started',
      label: 'En curso',
      description: null,
      tone: 'success',
      isInactive: false,
      inactiveReason: null,
    };
  }

  if (status === 'finished') {
    return {
      key: 'finished',
      label: 'Finalizado',
      description: 'El evento ha finalizado',
      tone: 'muted',
      isInactive: true,
      inactiveReason: 'finished',
    };
  }

  if (status === 'inactive_by_date') {
    return {
      key: 'inactive_by_date',
      label: 'Inactivo por fecha',
      description: 'La fecha del evento ya venció sin iniciar',
      tone: 'warning',
      isInactive: true,
      inactiveReason: 'expired',
    };
  }

  return {
    key: 'created',
    label: 'Pendiente',
    description: 'El evento aún no ha iniciado',
    tone: 'info',
    isInactive: false,
    inactiveReason: null,
  };
};

export const isEventCurrentlyActive = (event, now = new Date()) => getEventStatus(event, now) === 'started';

export const getInactiveBadgeLabel = (event) => {
  const visualState = getEventVisualState(event);
  return visualState.isInactive ? visualState.label : null;
};

export const getInactiveDescription = (event) => {
  const visualState = getEventVisualState(event);
  return visualState.isInactive ? visualState.description : null;
};

export { parseDate, toLocalCalendarKey };
