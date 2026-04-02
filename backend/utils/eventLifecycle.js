const parseDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const resolveEventInactivation = (event) => {
  const manualInactivatedAt = parseDate(event?.manualInactivatedAt || event?.manual_inactivated_at);
  const endDate = parseDate(event?.endDate || event?.end_date);
  const isExpired = Boolean(endDate && endDate.getTime() < Date.now());

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
      inactiveAt: endDate.toISOString(),
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
    manualInactivatedAt: event?.manualInactivatedAt || event?.manual_inactivated_at || null,
    manualInactivationComment: event?.manualInactivationComment || event?.manual_inactivation_comment || null,
    manualInactivatedByUserId: event?.manualInactivatedByUserId || event?.manual_inactivated_by_user_id || null,
    ...lifecycle,
  };
};

module.exports = {
  enrichEventLifecycle,
  parseDate,
  resolveEventInactivation,
};
