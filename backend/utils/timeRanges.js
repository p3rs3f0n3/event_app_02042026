const DAY_MS = 24 * 60 * 60 * 1000;

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

const getNormalizedTimeSegments = (value) => {
  const date = parseDate(value);
  if (!date) {
    return null;
  }

  const minutes = (date.getUTCHours() * 60) + date.getUTCMinutes();
  return minutes;
};

const getDailySegments = (start, end) => {
  const startMinutes = getNormalizedTimeSegments(start);
  const endMinutes = getNormalizedTimeSegments(end);

  if ([startMinutes, endMinutes].some((value) => value === null)) {
    return null;
  }

  if (startMinutes === endMinutes) {
    return null;
  }

  return endMinutes > startMinutes
    ? [{ start: startMinutes, end: endMinutes }]
    : [
      { start: startMinutes, end: 1440 },
      { start: 0, end: endMinutes },
    ];
};

const hasTimeOverlap = (leftStart, leftEnd, rightStart, rightEnd) => {
  const leftSegments = getDailySegments(leftStart, leftEnd);
  const rightSegments = getDailySegments(rightStart, rightEnd);

  if (!leftSegments || !rightSegments) {
    return false;
  }

  return leftSegments.some((leftSegment) => rightSegments.some((rightSegment) => leftSegment.start < rightSegment.end && rightSegment.start < leftSegment.end));
};

const normalizeDateTimeRange = (start, end) => {
  const startDate = parseDate(start);
  const endDate = parseDate(end);

  if (!startDate || !endDate) {
    return null;
  }

  const startMinutes = getUtcMinutes(startDate);
  const endMinutes = getUtcMinutes(endDate);

  if (startMinutes === endMinutes) {
    return {
      startDate,
      endDate,
      durationMinutes: 0,
      sameTime: true,
      isValid: false,
    };
  }

  const normalizedEndDate = new Date(endDate.getTime());
  if (normalizedEndDate.getTime() <= startDate.getTime()) {
    normalizedEndDate.setTime(normalizedEndDate.getTime() + DAY_MS);
  }

  const durationMinutes = (normalizedEndDate.getTime() - startDate.getTime()) / 60000;

  return {
    startDate,
    endDate: normalizedEndDate,
    durationMinutes,
    sameTime: false,
    isValid: durationMinutes > 0 && durationMinutes <= 1440,
  };
};

const normalizeEventSchedulePayload = (draftEvent = {}) => ({
  ...draftEvent,
  cities: Array.isArray(draftEvent?.cities)
    ? draftEvent.cities.map((city) => ({
      ...city,
      points: Array.isArray(city?.points)
        ? city.points.map((point) => {
          if (!point || typeof point !== 'object' || Array.isArray(point)) {
            return point;
          }

          const normalizedRange = normalizeDateTimeRange(point.startTime, point.endTime);
          if (!normalizedRange) {
            return point;
          }

          return {
            ...point,
            startTime: normalizedRange.startDate.toISOString(),
            endTime: normalizedRange.endDate.toISOString(),
          };
        })
        : [],
    }))
    : [],
});

module.exports = {
  DAY_MS,
  getUtcMinutes,
  hasTimeOverlap,
  normalizeDateTimeRange,
  normalizeEventSchedulePayload,
  parseDate,
};
