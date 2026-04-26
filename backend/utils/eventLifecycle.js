const parseDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toLocalCalendarKey = (date) => {
  const normalized = parseDate(date);
  if (!normalized) {
    return null;
  }

  return [
    normalized.getFullYear(),
    String(normalized.getMonth() + 1).padStart(2, '0'),
    String(normalized.getDate()).padStart(2, '0'),
  ].join('-');
};

const getScheduledStartKey = (event) => toLocalCalendarKey(event?.startDate || event?.start_date);

const getScheduledEndKey = (event) => toLocalCalendarKey(event?.endDate || event?.end_date);

const normalizeEventStatus = (value) => {
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

const getEventStatus = (event, now = new Date()) => {
  const storedStatus = normalizeEventStatus(event?.eventStatus || event?.event_status);
  const hasStartRealAt = Boolean(parseDate(event?.startRealAt || event?.start_real_at));
  const hasEndRealAt = Boolean(parseDate(event?.endRealAt || event?.end_real_at));

  if (event?.manualInactivatedAt || event?.manual_inactivated_at || event?.inactiveReason === 'manual') {
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

const isEventExpiredByDate = (event, now = new Date()) => {
  const currentKey = toLocalCalendarKey(now);
  const endKey = getScheduledEndKey(event);

  if (!currentKey || !endKey) {
    return false;
  }

  return getEventStatus(event, now) === 'not_started' && currentKey > endKey;
};

const isEventStartable = (event, now = new Date()) => {
  const currentKey = toLocalCalendarKey(now);
  const startKey = getScheduledStartKey(event);
  const endKey = getScheduledEndKey(event);

  if (!currentKey || !startKey || !endKey) {
    return false;
  }

  if (getEventStatus(event, now) !== 'not_started') {
    return false;
  }

  return currentKey >= startKey && currentKey <= endKey;
};

const getEventVisualState = (event, now = new Date()) => {
  const manualInactivatedAt = parseDate(event?.manualInactivatedAt || event?.manual_inactivated_at);

  if (manualInactivatedAt || event?.inactiveReason === 'manual') {
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

  if (status === 'finalized' || parseDate(event?.endRealAt || event?.end_real_at)) {
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

const isEventCurrentlyActive = (event, now = new Date()) => {
  return getEventStatus(event, now) === 'active';
};

const resolveEventInactivation = (event) => {
  const manualInactivatedAt = parseDate(event?.manualInactivatedAt || event?.manual_inactivated_at);
  const visualState = getEventVisualState(event);
  const endDate = parseDate(event?.endRealAt || event?.end_real_at || event?.endDate || event?.end_date);

  if (manualInactivatedAt) {
    return {
      isInactive: true,
      inactiveReason: 'manual',
      inactiveAt: manualInactivatedAt.toISOString(),
    };
  }

  if (visualState.isInactive) {
    return {
      isInactive: true,
      inactiveReason: visualState.inactiveReason,
      inactiveAt: endDate ? endDate.toISOString() : new Date().toISOString(),
    };
  }

  return {
    isInactive: false,
    inactiveReason: null,
    inactiveAt: null,
  };
};

const enrichEventLifecycle = (event) => {
  const lifecycle = resolveEventInactivation(event);
  const visualState = getEventVisualState(event);

  return {
    ...event,
    eventStatus: getEventStatus(event),
    eventVisualState: visualState,
    eventStatusLabel: visualState.label,
    statusLabel: visualState.label,
    isStartable: isEventStartable(event),
    manualInactivatedAt: event?.manualInactivatedAt || event?.manual_inactivated_at || null,
    manualInactivationComment: event?.manualInactivationComment || event?.manual_inactivation_comment || null,
    manualInactivatedByUserId: event?.manualInactivatedByUserId || event?.manual_inactivated_by_user_id || null,
    ...lifecycle,
  };
};

module.exports = {
  enrichEventLifecycle,
  getEventStatus,
  getEventVisualState,
  isEventCurrentlyActive,
  isEventExpiredByDate,
  isEventStartable,
  parseDate,
  resolveEventInactivation,
  normalizeEventStatus,
  toLocalCalendarKey,
};
