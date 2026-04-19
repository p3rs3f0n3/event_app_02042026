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

const getEventStatus = (event, now = new Date()) => {
  const currentKey = toLocalCalendarKey(now);
  const startKey = toLocalCalendarKey(event?.startDate || event?.start_date);
  const endKey = toLocalCalendarKey(event?.endDate || event?.end_date);

  if (!currentKey || !startKey || !endKey) {
    return 'finalized';
  }

  if (event?.manualInactivatedAt || event?.manual_inactivated_at || event?.inactiveReason === 'manual') {
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

const isEventCurrentlyActive = (event, now = new Date()) => {
  return getEventStatus(event, now) === 'active';
};

const resolveEventInactivation = (event) => {
  const manualInactivatedAt = parseDate(event?.manualInactivatedAt || event?.manual_inactivated_at);
  const currentStatus = getEventStatus(event);
  const endDate = parseDate(event?.endDate || event?.end_date);
  const isExpired = currentStatus === 'finalized';

  if (manualInactivatedAt) {
    return {
      isInactive: true,
      inactiveReason: 'manual',
      inactiveAt: manualInactivatedAt.toISOString(),
    };
  }

  if (isExpired) {
    return {
      isInactive: true,
      inactiveReason: 'expired',
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

  return {
    ...event,
    eventStatus: getEventStatus(event),
    manualInactivatedAt: event?.manualInactivatedAt || event?.manual_inactivated_at || null,
    manualInactivationComment: event?.manualInactivationComment || event?.manual_inactivation_comment || null,
    manualInactivatedByUserId: event?.manualInactivatedByUserId || event?.manual_inactivated_by_user_id || null,
    ...lifecycle,
  };
};

module.exports = {
  enrichEventLifecycle,
  getEventStatus,
  isEventCurrentlyActive,
  parseDate,
  resolveEventInactivation,
  toLocalCalendarKey,
};
