const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');
const isValidDateValue = (value) => !Number.isNaN(new Date(value).getTime());
const isValidIdValue = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

const validateLoginPayload = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return 'Payload de login inválido';
  }

  if (!isNonEmptyString(payload.username) || !isNonEmptyString(payload.password)) {
    return 'Usuario y contraseña son requeridos';
  }

  return null;
};

const validateEventPayload = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return 'Payload de evento inválido';
  }

  const { name, client, startDate, endDate, image, cities, createdByUserId } = payload;

  if (!isNonEmptyString(name)) return 'El nombre del evento es requerido';
  if (!isNonEmptyString(client)) return 'El cliente es requerido';
  if (!isNonEmptyString(image)) return 'La imagen del evento es requerida';
  if (!isValidIdValue(createdByUserId)) return 'El usuario creador del evento es requerido';
  if (!isValidDateValue(startDate) || !isValidDateValue(endDate)) return 'Las fechas del evento son inválidas';
  if (new Date(endDate).getTime() <= new Date(startDate).getTime()) return 'La fecha fin debe ser posterior al inicio';
  if (!Array.isArray(cities) || cities.length === 0) return 'El evento debe tener al menos una ciudad';

  for (const city of cities) {
    if (!city || typeof city !== 'object') return 'Cada ciudad debe ser un objeto válido';
    if (!isNonEmptyString(city.name)) return 'Cada ciudad debe tener nombre';
    if (!Array.isArray(city.points) || city.points.length === 0) return 'Cada ciudad debe tener al menos un punto';

    for (const point of city.points) {
      if (!point || typeof point !== 'object') return 'Cada punto debe ser un objeto válido';
      if (!isNonEmptyString(point.establishment)) return 'Cada punto debe tener establecimiento';
      if (!isNonEmptyString(point.address)) return 'Cada punto debe tener dirección';
      if (!isNonEmptyString(point.contact)) return 'Cada punto debe tener contacto';
      if (!isNonEmptyString(point.phone)) return 'Cada punto debe tener teléfono';
      if (!point.coordinator || typeof point.coordinator !== 'object') return 'Cada punto debe tener coordinador';
      if (!isValidIdValue(point.coordinator.id) && !isNonEmptyString(point.coordinator.name)) {
        return 'Cada punto debe tener un coordinador válido';
      }
      if (!isValidDateValue(point.startTime) || !isValidDateValue(point.endTime)) return 'Los horarios de cada punto son obligatorios';
      if (new Date(point.endTime).getTime() <= new Date(point.startTime).getTime()) return 'La hora fin de cada punto debe ser posterior al inicio';
      if (point.assignedStaff && !Array.isArray(point.assignedStaff)) return 'El personal asignado debe ser una lista';
    }
  }

  return null;
};

const validateManualInactivationPayload = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return 'Payload de inactivación inválido';
  }

  if (!isValidIdValue(payload.createdByUserId)) {
    return 'El usuario ejecutor de la inactivación es requerido';
  }

  if (!isNonEmptyString(payload.comment)) {
    return 'El comentario de inactivación es obligatorio';
  }

  return null;
};

module.exports = {
  badRequest: (res, message) => res.status(400).json({ message }),
  normalizeString,
  validateLoginPayload,
  validateManualInactivationPayload,
  validateEventPayload,
};
