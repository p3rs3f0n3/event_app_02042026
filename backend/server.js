const express = require('express');
const cors = require('cors');
const { config } = require('./config/env');
const { getRoleConfig, getRoleConfigList } = require('./config/roles');
const { createRepository } = require('./repositories');
const { collectScheduledAssignments, validateDraftAssignments } = require('./utils/availability');
const {
  badRequest,
  normalizeString,
  validateCoordinatorPhotoPayload,
  validateCoordinatorReportPayload,
  validateEventPayload,
  validateLoginPayload,
  validateManualInactivationPayload,
} = require('./utils/validation');

const app = express();

const asyncHandler = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    next(error);
  }
};

app.use(cors());
app.use(express.json());

app.get('/api/app-config', asyncHandler(async (req, res) => {
  return res.json({
    appName: 'EventApp',
    roles: getRoleConfigList(),
  });
}));

app.post('/api/login', asyncHandler(async (req, res) => {
  const validationError = validateLoginPayload(req.body);
  if (validationError) {
    return badRequest(res, validationError);
  }

  const user = await req.app.locals.repository.authenticateUser({
    username: normalizeString(req.body.username),
    password: normalizeString(req.body.password),
  });

  if (!user) {
    return res.status(401).json({ message: 'Credenciales inválidas' });
  }

  return res.json({
    ...user,
    roleConfig: getRoleConfig(user.role),
  });
}));

app.get('/api/coordinators', asyncHandler(async (req, res) => {
  const { city, startTime, endTime, eventStartDate, eventEndDate, selectedCoordinatorId } = req.query;
  const repository = req.app.locals.repository;
  const [coordinators, events] = await Promise.all([
    repository.getCoordinators({ city }),
    repository.getEvents(),
  ]);
  const scheduledAssignments = collectScheduledAssignments({
    events,
    city,
    startTime,
    endTime,
    eventStartDate,
    eventEndDate,
  });
  const selectedId = Number(selectedCoordinatorId);

  res.json(coordinators.map((coordinator) => {
    const coordinatorId = Number(coordinator.id);
    const isSelected = Number.isInteger(selectedId) && selectedId > 0 && coordinatorId === selectedId;
    const isUnavailable = scheduledAssignments.coordinatorIds.has(coordinatorId) && !isSelected;

    return {
      ...coordinator,
      isAvailable: !isUnavailable,
      unavailableReason: isUnavailable ? `Ocupado en ${scheduledAssignments.coordinatorReasons.get(coordinatorId)}` : null,
    };
  }));
}));

app.get('/api/staff', asyncHandler(async (req, res) => {
  const { city, category, startTime, endTime, eventStartDate, eventEndDate, selectedStaffIds } = req.query;
  const repository = req.app.locals.repository;
  const [staff, events] = await Promise.all([
    repository.getStaff({ city, category }),
    repository.getEvents(),
  ]);
  const scheduledAssignments = collectScheduledAssignments({
    events,
    city,
    startTime,
    endTime,
    eventStartDate,
    eventEndDate,
  });
  const selectedIds = new Set(
    String(selectedStaffIds || '')
      .split(',')
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0),
  );

  res.json(staff.map((staffMember) => {
    const staffId = Number(staffMember.id);
    const isSelected = selectedIds.has(staffId);
    const isUnavailable = scheduledAssignments.staffIds.has(staffId) && !isSelected;

    return {
      ...staffMember,
      isAvailable: !isUnavailable,
      unavailableReason: isUnavailable ? `Ocupado en ${scheduledAssignments.staffReasons.get(staffId)}` : null,
    };
  }));
}));

app.get('/api/colombia-cities', asyncHandler(async (req, res) => {
  const cities = await req.app.locals.repository.getCities();

  if (!Array.isArray(cities)) {
    return res.status(500).json({ message: 'La base de ciudades no está disponible' });
  }

  return res.json(cities);
}));
app.post('/api/colombia-cities', asyncHandler(async (req, res) => {
  const name = normalizeString(req.body?.name);

  if (!name) {
    return badRequest(res, 'El nombre de la ciudad es requerido');
  }

  if (name.toUpperCase() === 'OTRO') {
    return badRequest(res, 'OTRO es una opción reservada');
  }

  const existingCity = await req.app.locals.repository.findCityByName(name);
  if (existingCity) {
    return res.status(200).json(existingCity);
  }

  const newC = await req.app.locals.repository.createCity(name);
  return res.status(201).json(newC);
}));

app.get('/api/events', asyncHandler(async (req, res) => {
  const { createdByUserId } = req.query;

  return res.json(await req.app.locals.repository.getEvents({ createdByUserId }));
}));
app.get('/api/coordinator/events', asyncHandler(async (req, res) => {
  const userId = Number(req.query?.userId);

  if (!Number.isInteger(userId) || userId <= 0) {
    return badRequest(res, 'El userId del coordinador es requerido');
  }

  return res.json(await req.app.locals.repository.getCoordinatorEvents({ userId }));
}));
app.post('/api/events', asyncHandler(async (req, res) => {
  const validationError = validateEventPayload(req.body);
  if (validationError) {
    return badRequest(res, validationError);
  }

  const assignmentConflict = validateDraftAssignments({
    draftEvent: req.body,
    existingEvents: await req.app.locals.repository.getEvents(),
  });
  if (assignmentConflict) {
    return badRequest(res, assignmentConflict);
  }

  const newE = await req.app.locals.repository.createEvent(req.body);
  return res.status(201).json(newE);
}));
app.put('/api/events/:id', asyncHandler(async (req, res) => {
  const existingEvent = await req.app.locals.repository.getEventById(req.params.id);
  if (!existingEvent) {
    return res.status(404).json({ message: 'Evento no encontrado' });
  }

  if (Number(existingEvent.createdByUserId) !== Number(req.body?.createdByUserId)) {
    return res.status(403).json({ message: 'No podés editar un evento de otro ejecutivo' });
  }

  if (existingEvent.isInactive) {
    return badRequest(res, 'El evento está inactivo y no admite edición');
  }

  const validationError = validateEventPayload(req.body);
  if (validationError) {
    return badRequest(res, validationError);
  }

  const assignmentConflict = validateDraftAssignments({
    draftEvent: req.body,
    existingEvents: await req.app.locals.repository.getEvents(),
    excludeEventId: req.params.id,
  });
  if (assignmentConflict) {
    return badRequest(res, assignmentConflict);
  }

  const updatedEvent = await req.app.locals.repository.updateEvent(req.params.id, req.body);
  if (updatedEvent) {
    return res.json(updatedEvent);
  }

  return res.status(404).json({ message: 'Evento no encontrado' });
}));
app.post('/api/events/:id/inactivate', asyncHandler(async (req, res) => {
  const validationError = validateManualInactivationPayload(req.body);
  if (validationError) {
    return badRequest(res, validationError);
  }

  const existingEvent = await req.app.locals.repository.getEventById(req.params.id);
  if (!existingEvent) {
    return res.status(404).json({ message: 'Evento no encontrado' });
  }

  if (Number(existingEvent.createdByUserId) !== Number(req.body.createdByUserId)) {
    return res.status(403).json({ message: 'No podés inactivar un evento de otro ejecutivo' });
  }

  if (existingEvent.isInactive) {
    return badRequest(res, 'El evento ya está inactivo');
  }

  const updatedEvent = await req.app.locals.repository.inactivateEvent(req.params.id, {
    createdByUserId: Number(req.body.createdByUserId),
    comment: normalizeString(req.body.comment),
  });

  return res.json(updatedEvent);
}));

app.post('/api/events/:id/photos', asyncHandler(async (req, res) => {
  const validationError = validateCoordinatorPhotoPayload(req.body);
  if (validationError) {
    return badRequest(res, validationError);
  }

  const updatedEvent = await req.app.locals.repository.addCoordinatorPhoto(req.params.id, {
    authorUserId: Number(req.body.authorUserId),
    uri: normalizeString(req.body.uri),
    mimeType: normalizeString(req.body.mimeType),
    fileName: normalizeString(req.body.fileName),
    fileSize: req.body.fileSize == null ? null : Number(req.body.fileSize),
  });

  if (updatedEvent === false) {
    return res.status(403).json({ message: 'El coordinador no está autorizado para cargar fotos en este evento' });
  }

  if (!updatedEvent) {
    return res.status(404).json({ message: 'Evento no encontrado' });
  }

  return res.json(updatedEvent);
}));

app.post('/api/events/:id/reports', asyncHandler(async (req, res) => {
  const validationError = validateCoordinatorReportPayload(req.body);
  if (validationError) {
    return badRequest(res, validationError);
  }

  const updatedEvent = await req.app.locals.repository.addCoordinatorReport(req.params.id, {
    authorUserId: Number(req.body.authorUserId),
    title: normalizeString(req.body.title),
    startTime: normalizeString(req.body.startTime),
    endTime: normalizeString(req.body.endTime),
    initialInventory: normalizeString(req.body.initialInventory),
    finalInventory: normalizeString(req.body.finalInventory),
    observations: normalizeString(req.body.observations),
    hasRedemptions: Boolean(req.body.hasRedemptions),
    redemptionsCount: Number(req.body.redemptionsCount || 0),
    relevantAspects: normalizeString(req.body.relevantAspects),
  });

  if (updatedEvent === false) {
    return res.status(403).json({ message: 'El coordinador no está autorizado para cargar informes en este evento' });
  }

  if (!updatedEvent) {
    return res.status(404).json({ message: 'Evento no encontrado' });
  }

  return res.json(updatedEvent);
}));

app.get('/api/health', asyncHandler(async (req, res) => {
  await req.app.locals.repository.ping?.();

  return res.json({
    status: 'ok',
    repositoryDriver: config.repository.driver,
  });
}));

app.use((error, req, res, next) => {
  console.error('❌ API error', error);

  if (res.headersSent) {
    return next(error);
  }

  return res.status(500).json({
    message: 'Ocurrió un error interno',
  });
});

const bootstrap = async () => {
  const repository = createRepository();
  app.locals.repository = repository;

  if (typeof repository.ping === 'function') {
    await repository.ping();
  }

  app.listen(config.app.port, () => console.log(`🚀 API on ${config.app.port}`));
};

bootstrap().catch((error) => {
  console.error('❌ Error inicializando la API', error);
  process.exit(1);
});
