const { normalizeString } = require('./validation');
const { resolveEventInactivation } = require('./eventLifecycle');

const normalizeCityName = (value) => normalizeString(value).toLowerCase();

const parseDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getUtcMinutes = (value) => {
  const date = parseDate(value);
  if (!date) {
    return null;
  }

  return (date.getUTCHours() * 60) + date.getUTCMinutes();
};

const hasTimeOverlap = (leftStart, leftEnd, rightStart, rightEnd) => {
  const leftStartMinutes = getUtcMinutes(leftStart);
  const leftEndMinutes = getUtcMinutes(leftEnd);
  const rightStartMinutes = getUtcMinutes(rightStart);
  const rightEndMinutes = getUtcMinutes(rightEnd);

  if ([leftStartMinutes, leftEndMinutes, rightStartMinutes, rightEndMinutes].some((value) => value === null)) {
    return false;
  }

  return leftStartMinutes < rightEndMinutes && rightStartMinutes < leftEndMinutes;
};

const hasDateRangeOverlap = (leftStart, leftEnd, rightStart, rightEnd) => {
  const normalizedLeftStart = parseDate(leftStart);
  const normalizedLeftEnd = parseDate(leftEnd);
  const normalizedRightStart = parseDate(rightStart);
  const normalizedRightEnd = parseDate(rightEnd);

  if (!normalizedLeftStart || !normalizedLeftEnd || !normalizedRightStart || !normalizedRightEnd) {
    return false;
  }

  return normalizedLeftStart.getTime() < normalizedRightEnd.getTime() && normalizedRightStart.getTime() < normalizedLeftEnd.getTime();
};

const collectScheduledAssignments = ({ events = [], city, startTime, endTime, eventStartDate, eventEndDate, excludeEventId } = {}) => {
  const targetCity = normalizeCityName(city);

  if (!targetCity || !startTime || !endTime || !eventStartDate || !eventEndDate) {
    return {
      coordinatorIds: new Set(),
      staffIds: new Set(),
      coordinatorReasons: new Map(),
      staffReasons: new Map(),
    };
  }

  const conflicts = {
    coordinatorIds: new Set(),
    staffIds: new Set(),
    coordinatorReasons: new Map(),
    staffReasons: new Map(),
  };

  for (const event of events) {
    if (!event || (excludeEventId && Number(event.id) === Number(excludeEventId))) {
      continue;
    }

    if (resolveEventInactivation(event).isInactive) {
      continue;
    }

    if (!hasDateRangeOverlap(event.startDate, event.endDate, eventStartDate, eventEndDate)) {
      continue;
    }

    for (const eventCity of Array.isArray(event.cities) ? event.cities : []) {
      if (normalizeCityName(eventCity?.name) !== targetCity) {
        continue;
      }

      for (const point of Array.isArray(eventCity?.points) ? eventCity.points : []) {
        if (!hasTimeOverlap(point?.startTime, point?.endTime, startTime, endTime)) {
          continue;
        }

        const reason = `${event.name || 'Evento'} · ${eventCity.name || city}`;
        const coordinatorId = Number(point?.coordinator?.id);

        if (Number.isInteger(coordinatorId) && coordinatorId > 0) {
          conflicts.coordinatorIds.add(coordinatorId);
          if (!conflicts.coordinatorReasons.has(coordinatorId)) {
            conflicts.coordinatorReasons.set(coordinatorId, reason);
          }
        }

        for (const staffMember of Array.isArray(point?.assignedStaff) ? point.assignedStaff : []) {
          const staffId = Number(staffMember?.id);
          if (Number.isInteger(staffId) && staffId > 0) {
            conflicts.staffIds.add(staffId);
            if (!conflicts.staffReasons.has(staffId)) {
              conflicts.staffReasons.set(staffId, reason);
            }
          }
        }
      }
    }
  }

  return conflicts;
};

const validateDraftAssignments = ({ draftEvent, existingEvents = [], excludeEventId } = {}) => {
  const draftCities = Array.isArray(draftEvent?.cities) ? draftEvent.cities : [];

  for (const city of draftCities) {
    const cityName = city?.name;
    const points = Array.isArray(city?.points) ? city.points : [];

    for (let index = 0; index < points.length; index += 1) {
      const point = points[index];
      const slotLabel = `${cityName} / ${point?.establishment || `Punto ${index + 1}`}`;

      for (let nextIndex = index + 1; nextIndex < points.length; nextIndex += 1) {
        const nextPoint = points[nextIndex];
        if (!hasTimeOverlap(point?.startTime, point?.endTime, nextPoint?.startTime, nextPoint?.endTime)) {
          continue;
        }

        if (Number(point?.coordinator?.id) > 0 && Number(point?.coordinator?.id) === Number(nextPoint?.coordinator?.id)) {
          return `El coordinador ${point.coordinator.name || point.coordinator.id} ya está asignado en un horario cruzado para ${cityName}`;
        }

        const pointStaffIds = new Set((Array.isArray(point?.assignedStaff) ? point.assignedStaff : []).map((item) => Number(item?.id)).filter((id) => Number.isInteger(id) && id > 0));
        for (const staffMember of Array.isArray(nextPoint?.assignedStaff) ? nextPoint.assignedStaff : []) {
          const staffId = Number(staffMember?.id);
          if (pointStaffIds.has(staffId)) {
            return `La persona ${staffMember?.name || staffId} ya está asignada en un horario cruzado para ${cityName}`;
          }
        }
      }

      const persistedConflicts = collectScheduledAssignments({
        events: existingEvents,
        city: cityName,
        startTime: point?.startTime,
        endTime: point?.endTime,
        eventStartDate: draftEvent?.startDate,
        eventEndDate: draftEvent?.endDate,
        excludeEventId,
      });

      const coordinatorId = Number(point?.coordinator?.id);
      if (Number.isInteger(coordinatorId) && coordinatorId > 0 && persistedConflicts.coordinatorIds.has(coordinatorId)) {
        return `El coordinador ${point.coordinator.name || coordinatorId} ya está ocupado en ${slotLabel}`;
      }

      for (const staffMember of Array.isArray(point?.assignedStaff) ? point.assignedStaff : []) {
        const staffId = Number(staffMember?.id);
        if (Number.isInteger(staffId) && staffId > 0 && persistedConflicts.staffIds.has(staffId)) {
          return `La persona ${staffMember?.name || staffId} ya está ocupada en ${slotLabel}`;
        }
      }
    }
  }

  return null;
};

module.exports = {
  collectScheduledAssignments,
  hasDateRangeOverlap,
  hasTimeOverlap,
  validateDraftAssignments,
};
