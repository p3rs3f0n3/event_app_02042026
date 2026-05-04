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

const getEventStatus = (event, now = new Date()) => {
  const storedStatus = normalizeEventStatus(event?.eventStatus || event?.event_status);
  const hasStartRealAt = Boolean(parseDate(event?.startRealAt || event?.start_real_at));
  const hasEndRealAt = Boolean(parseDate(event?.endRealAt || event?.end_real_at));

  // 1. Manual inactivation or real end date always means finished
  if (event?.manualInactivatedAt || event?.manual_inactivated_at || hasEndRealAt || storedStatus === 'finished') {
    return 'finished';
  }

  // 2. Real start date means it has started
  if (hasStartRealAt || storedStatus === 'started') {
    return 'started';
  }

  // 3. If not started, check if it already expired by date
  const currentKey = toLocalCalendarKey(now);
  const endKey = getScheduledEndKey(event);

  if (currentKey && endKey && currentKey > endKey) {
    return 'inactive_by_date';
  }

  return 'created';
};

const isEventExpiredByDate = (event, now = new Date()) => {
  return getEventStatus(event, now) === 'inactive_by_date';
};

const isEventStartable = (event, now = new Date()) => {
  const currentKey = toLocalCalendarKey(now);
  const startKey = getScheduledStartKey(event);
  const endKey = getScheduledEndKey(event);

  if (!currentKey || !startKey || !endKey) {
    return false;
  }

  const status = getEventStatus(event, now);
  if (status !== 'created') {
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

const isEventCurrentlyActive = (event, now = new Date()) => {
  return getEventStatus(event, now) === 'started';
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
  const visualState = getEventVisualState(event);
  const lifecycle = resolveEventInactivation(event);

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
