const normalizeExecutiveContact = (user) => {
  if (!user) {
    return null;
  }

  return {
    userId: Number(user.id),
    username: user.username || null,
    fullName: user.fullName || user.full_name || null,
    phone: user.phone || user.phone_number || null,
    whatsappPhone: user.whatsappPhone || user.whatsapp_phone || user.phone || user.phone_number || null,
    email: user.email || null,
    hasPhone: Boolean(user.phone || user.phone_number),
  };
};

const getAssignedCitiesForCoordinator = (event, coordinatorId) => {
  const normalizedCoordinatorId = Number(coordinatorId);
  const groupedCities = new Map();

  (Array.isArray(event?.cities) ? event.cities : []).forEach((city) => {
    const assignedPoints = (Array.isArray(city?.points) ? city.points : []).filter(
      (point) => Number(point?.coordinator?.id) === normalizedCoordinatorId,
    );

    if (assignedPoints.length === 0) {
      return;
    }

    const cityKey = String(city?.name || 'Sin ciudad').trim().toLowerCase();
    const existingCity = groupedCities.get(cityKey);

    if (existingCity) {
      existingCity.points.push(...assignedPoints);
      return;
    }

    groupedCities.set(cityKey, {
      ...city,
      points: [...assignedPoints],
    });
  });

  return Array.from(groupedCities.values());
};

const mapCoordinatorEvent = ({ event, coordinatorProfile, executiveContact }) => {
  const assignedCities = getAssignedCitiesForCoordinator(event, coordinatorProfile?.id);

  if (assignedCities.length === 0) {
    return null;
  }

  const pointsCount = assignedCities.reduce((total, city) => total + city.points.length, 0);
  const staffCount = assignedCities.reduce(
    (total, city) => total + city.points.reduce((cityTotal, point) => cityTotal + (Array.isArray(point?.assignedStaff) ? point.assignedStaff.length : 0), 0),
    0,
  );

  return {
    ...event,
    cities: assignedCities,
    coordinatorProfile,
    executiveContact,
    assignmentSummary: {
      citiesCount: assignedCities.length,
      pointsCount,
      staffCount,
    },
  };
};

module.exports = {
  mapCoordinatorEvent,
  normalizeExecutiveContact,
};
