const normalizeExecutiveContact = (user) => {
  if (!user) {
    return null;
  }

  return {
    userId: Number(user.id),
    username: user.username || null,
    fullName: user.fullName || user.full_name || null,
    phone: user.phone || null,
    hasPhone: Boolean(user.phone),
  };
};

const getAssignedCitiesForCoordinator = (event, coordinatorId) => {
  const normalizedCoordinatorId = Number(coordinatorId);

  return (Array.isArray(event?.cities) ? event.cities : []).reduce((cities, city) => {
    const assignedPoints = (Array.isArray(city?.points) ? city.points : []).filter(
      (point) => Number(point?.coordinator?.id) === normalizedCoordinatorId,
    );

    if (assignedPoints.length === 0) {
      return cities;
    }

    cities.push({
      ...city,
      points: assignedPoints,
    });

    return cities;
  }, []);
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
