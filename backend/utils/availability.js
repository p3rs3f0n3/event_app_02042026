const { normalizeString } = require('./validation');
const { hasTimeOverlap, normalizeEventSchedulePayload } = require('./timeRanges');
const { resolveEventInactivation } = require('./eventLifecycle');
const normalizeCityName = (value) => normalizeString(value).toLowerCase();

const parseDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const hasDateRangeOverlap = (leftStart, leftEnd, rightStart, rightEnd) => {
  const normalizedLeftStart = parseDate(leftStart);
  const normalizedLeftEnd = parseDate(leftEnd);
  const normalizedRightStart = parseDate(rightStart);
  const normalizedRightEnd = parseDate(rightEnd);

  if (!normalizedLeftStart || !normalizedLeftEnd || !normalizedRightStart || !normalizedRightEnd) {
    return false;
  }

  return normalizedLeftStart.getTime() <= normalizedRightEnd.getTime() && normalizedRightStart.getTime() <= normalizedLeftEnd.getTime();
};

const normalizePointOriginalRef = (value = {}) => {
  const eventId = Number(value?.eventId ?? value?.excludeEventId);
  const cityIndex = Number(value?.cityIndex ?? value?.excludeCityIndex);
  const pointIndex = Number(value?.pointIndex ?? value?.excludePointIndex);

  if (!Number.isInteger(eventId) || eventId <= 0 || !Number.isInteger(cityIndex) || cityIndex < 0 || !Number.isInteger(pointIndex) || pointIndex < 0) {
    return null;
  }

  return { eventId, cityIndex, pointIndex };
};

const isSamePointOriginalRef = (leftRef, rightRef) => (
  Boolean(leftRef)
  && Boolean(rightRef)
  && Number(leftRef.eventId) === Number(rightRef.eventId)
  && Number(leftRef.cityIndex) === Number(rightRef.cityIndex)
  && Number(leftRef.pointIndex) === Number(rightRef.pointIndex)
);

const stripDraftAssignmentMetadata = (draftEvent = {}) => ({
  ...draftEvent,
  cities: Array.isArray(draftEvent?.cities)
    ? draftEvent.cities.map((city) => ({
      ...city,
      points: Array.isArray(city?.points)
        ? city.points.map((point) => {
          if (!point || typeof point !== 'object' || Array.isArray(point)) {
            return point;
          }

          const { __originalRef, ...cleanPoint } = point;
          return cleanPoint;
        })
        : [],
    }))
    : [],
});

const collectScheduledAssignments = ({ events = [], city, startTime, endTime, eventStartDate, eventEndDate, excludePointOriginalRef } = {}) => {
  const targetCity = normalizeCityName(city);
  const normalizedExcludePointOriginalRef = normalizePointOriginalRef(excludePointOriginalRef);

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
    if (!event) {
      continue;
    }

    if (resolveEventInactivation(event).isInactive) {
      continue;
    }

    if (!hasDateRangeOverlap(event.startDate, event.endDate, eventStartDate, eventEndDate)) {
      continue;
    }

    for (const [cityIndex, eventCity] of (Array.isArray(event.cities) ? event.cities : []).entries()) {
      if (normalizeCityName(eventCity?.name) !== targetCity) {
        continue;
      }

      for (const [pointIndex, point] of (Array.isArray(eventCity?.points) ? eventCity.points : []).entries()) {
        const pointOriginalRef = point?.__originalRef || { eventId: event.id, cityIndex, pointIndex };
        if (isSamePointOriginalRef(pointOriginalRef, normalizedExcludePointOriginalRef)) {
          continue;
        }

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

const validateDraftAssignments = ({ draftEvent, existingEvents = [] } = {}) => {
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
        excludePointOriginalRef: point?.__originalRef,
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
  normalizeEventSchedulePayload,
  normalizePointOriginalRef,
  stripDraftAssignmentMetadata,
  validateDraftAssignments,
};
