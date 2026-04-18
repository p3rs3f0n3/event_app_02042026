const express = require('express');
const cors = require('cors');
const { config } = require('./config/env');
const { getRoleConfig, getRoleConfigList } = require('./config/roles');
const { createRepository } = require('./repositories');
const { createWelcomeEmailService } = require('./utils/mailer');
const {
  collectScheduledAssignments,
  normalizePointOriginalRef,
  normalizeEventSchedulePayload,
  stripDraftAssignmentMetadata,
  validateDraftAssignments,
} = require('./utils/availability');
const {
  badRequest,
  normalizePhoneDigits,
  normalizeString,
  validateCoordinatorPhotoPayload,
  validateCoordinatorReportPayload,
  validateExecutiveReportPayload,
  validateAdminClientPayload,
  validateAdminClientUpdatePayload,
  validateAcceptTermsPayload,
  validateAdminCoordinatorPayload,
  validateAdminCoordinatorUpdatePayload,
  validateAdminExecutivePayload,
  validateAdminExecutiveUpdatePayload,
  validateAdminEntityInactivationPayload,
  validateAdminStaffPayload,
  validateAdminStaffUpdatePayload,
  validateChangePasswordPayload,
  validateEventPayload,
  validateLoginPayload,
  validateManualInactivationPayload,
} = require('./utils/validation');
const { normalizeStaffCategoryName } = require('./utils/staffCategories');
const { normalizeStaffSexo } = require('./utils/staffMeasurements');

const APP_DISPLAY_NAME = 'Eventrix';

const app = express();

const asyncHandler = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    next(error);
  }
};

const summarizeCreateEventPayload = (payload = {}) => ({
  name: normalizeString(payload?.name),
  createdByUserId: Number(payload?.createdByUserId) || null,
  clientUserId: Number(payload?.clientUserId) || null,
  cityCount: Array.isArray(payload?.cities) ? payload.cities.length : 0,
  pointCount: Array.isArray(payload?.cities)
    ? payload.cities.reduce((total, city) => total + (Array.isArray(city?.points) ? city.points.length : 0), 0)
    : 0,
  startDate: payload?.startDate || null,
  endDate: payload?.endDate || null,
});

const serializeErrorForLog = (error) => ({
  name: error?.name || 'Error',
  message: error?.message || 'Sin mensaje',
  code: error?.code || null,
  detail: error?.detail || null,
  constraint: error?.constraint || null,
  table: error?.table || null,
  column: error?.column || null,
  where: error?.where || null,
  routine: error?.routine || null,
  operation: error?.operation || null,
  stack: typeof error?.stack === 'string' ? error.stack.split('\n').slice(0, 5).join('\n') : null,
});

const normalizeAdminPhonePayload = (payload = {}) => ({
  phone: normalizePhoneDigits(payload.phone).slice(0, 10),
  whatsappPhone: normalizePhoneDigits(payload.whatsappPhone).slice(0, 10),
});

const normalizeAdminPhotoPayload = (photo) => {
  if (typeof photo === 'string') {
    const uri = normalizeString(photo);
    return uri ? { uri, mimeType: null, fileSize: null, fileName: null, source: 'legacy' } : null;
  }

  if (!photo || typeof photo !== 'object' || Array.isArray(photo)) {
    return null;
  }

  return {
    uri: normalizeString(photo.uri),
    mimeType: normalizeString(photo.mimeType).toLowerCase() || null,
    fileSize: Number(photo.fileSize || 0) || null,
    fileName: normalizeString(photo.fileName) || null,
    source: normalizeString(photo.source) || 'admin',
  };
};

const normalizeEventImagePayload = (image) => {
  if (typeof image === 'string') {
    return normalizeString(image) || null;
  }

  return normalizeAdminPhotoPayload(image);
};

const appendEmailDeliveryMetadata = (record, emailDelivery) => ({
  ...record,
  emailDelivery,
});

const formatCsvDate = (value) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString();
};

const escapeCsvValue = (value) => {
  const normalized = String(value ?? '');
  if (!/[",\n\r]/.test(normalized)) {
    return normalized;
  }

  return `"${normalized.replace(/"/g, '""')}"`;
};

const buildCsv = ({ headers, rows }) => {
  const csvHeader = headers.map((header) => escapeCsvValue(header.label)).join(',');
  const csvRows = (Array.isArray(rows) ? rows : []).map((row) => headers
    .map((header) => escapeCsvValue(row?.[header.key]))
    .join(','));

  return `\uFEFF${[csvHeader, ...csvRows].join('\n')}`;
};

const resolveAdminActor = async (req, res) => {
  const actorUserId = Number(req.query?.actorUserId);
  if (!Number.isInteger(actorUserId) || actorUserId <= 0) {
    badRequest(res, 'El actor administrativo es obligatorio');
    return null;
  }

  const actor = await req.app.locals.repository.findUserById(actorUserId);
  if (!actor) {
    res.status(404).json({ message: 'Usuario administrador no encontrado' });
    return null;
  }

  if (String(actor.role || '').toUpperCase() !== 'ADMIN') {
    res.status(403).json({ message: 'No tienes permisos para exportar listados administrativos' });
    return null;
  }

  return actor;
};

const sendProfileWelcomeEmail = async (req, { email, recipientName, roleLabel, username, password }) => {
  return req.app.locals.welcomeEmailService.sendWelcomeCredentialsEmail({
    to: email,
    recipientName,
    roleLabel,
    username,
    password,
  });
};

app.use(cors());
app.use(express.json({ limit: '15mb' }));

app.get('/api/app-config', asyncHandler(async (req, res) => {
  return res.json({
    appName: APP_DISPLAY_NAME,
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

app.post('/api/terms/accept', asyncHandler(async (req, res) => {
  const validationError = validateAcceptTermsPayload(req.body);
  if (validationError) {
    return badRequest(res, validationError);
  }

  const result = await req.app.locals.repository.acceptUserTerms({
    userId: Number(req.body.userId),
  });

  if (result?.errorCode === 'USER_NOT_FOUND') {
    return res.status(404).json({ message: 'Usuario no encontrado' });
  }

  if (result?.errorCode === 'USER_INACTIVE') {
    return res.status(409).json({ message: 'El usuario está inactivo y no puede aceptar términos' });
  }

  return res.json({
    ...result,
    roleConfig: getRoleConfig(result.role),
    message: 'Términos aceptados correctamente',
  });
}));

app.post('/api/change-password', asyncHandler(async (req, res) => {
  const validationError = validateChangePasswordPayload(req.body);
  if (validationError) {
    return badRequest(res, validationError);
  }

  const result = await req.app.locals.repository.changeUserPassword({
    userId: Number(req.body.userId),
    currentPassword: normalizeString(req.body.currentPassword),
    newPassword: normalizeString(req.body.newPassword),
  });

  if (result?.errorCode === 'USER_NOT_FOUND') {
    return res.status(404).json({ message: 'Usuario no encontrado' });
  }

  if (result?.errorCode === 'INVALID_CURRENT_PASSWORD') {
    return res.status(401).json({ message: 'La contraseña actual es incorrecta' });
  }

  return res.json({
    message: 'Contraseña actualizada correctamente',
    userId: result.id,
    username: result.username,
  });
}));

app.get('/api/coordinators', asyncHandler(async (req, res) => {
  const { city, startTime, endTime, eventStartDate, eventEndDate, selectedCoordinatorId, excludeEventId, excludeCityIndex, excludePointIndex } = req.query;
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
    excludePointOriginalRef: normalizePointOriginalRef({ excludeEventId, excludeCityIndex, excludePointIndex }),
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

app.get('/api/clients', asyncHandler(async (req, res) => {
  return res.json(await req.app.locals.repository.getClients({
    search: normalizeString(req.query?.q),
  }));
}));

app.get('/api/admin/clients', asyncHandler(async (req, res) => {
  return res.json(await req.app.locals.repository.getAdminClients());
}));

app.get('/api/admin/clients/by-nit', asyncHandler(async (req, res) => {
  const nit = normalizeString(req.query?.nit);
  if (!nit) {
    return badRequest(res, 'El NIT es obligatorio');
  }

  const client = await req.app.locals.repository.findAdminClientByNit(nit);
  return res.json({
    exists: Boolean(client),
    client: client || null,
    auditLogs: client ? await req.app.locals.repository.getAuditLogsForEntity({ entityType: 'client', entityId: client.clientId, limit: 10 }) : [],
  });
}));

app.get('/api/admin/executives', asyncHandler(async (req, res) => {
  return res.json(await req.app.locals.repository.getAdminExecutives());
}));

app.get('/api/admin/executives/by-cedula', asyncHandler(async (req, res) => {
  const cedula = normalizeString(req.query?.cedula);
  if (!cedula) {
    return badRequest(res, 'La cédula es obligatoria');
  }

  const executive = await req.app.locals.repository.findAdminExecutiveByCedula(cedula);
  return res.json({
    exists: Boolean(executive),
    executive: executive || null,
    auditLogs: executive ? await req.app.locals.repository.getAuditLogsForEntity({ entityType: 'executive', entityId: executive.id, limit: 10 }) : [],
  });
}));

app.post('/api/admin/executives', asyncHandler(async (req, res) => {
  const validationError = validateAdminExecutivePayload(req.body);
  if (validationError) {
    return badRequest(res, validationError);
  }

  const normalizedPhones = normalizeAdminPhonePayload(req.body);

  const result = await req.app.locals.repository.createExecutive({
    actorUserId: Number(req.body.actorUserId),
    cedula: normalizeString(req.body.cedula),
    fullName: normalizeString(req.body.fullName),
    address: normalizeString(req.body.address),
    phone: normalizedPhones.phone,
    whatsappPhone: normalizedPhones.whatsappPhone,
    email: normalizeString(req.body.email).toLowerCase(),
    city: normalizeString(req.body.city),
    username: normalizeString(req.body.username),
    password: normalizeString(req.body.password),
  });

  if (result?.errorCode === 'DUPLICATE_RECORD') {
    return res.status(409).json({ message: result.message });
  }

  if (result?.errorCode === 'INVALID_REFERENCE') {
    return badRequest(res, result.message);
  }

  const emailDelivery = await sendProfileWelcomeEmail(req, {
    email: normalizeString(req.body.email).toLowerCase(),
    recipientName: normalizeString(req.body.fullName),
    roleLabel: 'ejecutivo',
    username: normalizeString(req.body.username),
    password: normalizeString(req.body.password),
  });

  return res.status(201).json(appendEmailDeliveryMetadata(result, emailDelivery));
}));

app.put('/api/admin/executives/:id', asyncHandler(async (req, res) => {
  const validationError = validateAdminExecutiveUpdatePayload(req.body);
  if (validationError) {
    return badRequest(res, validationError);
  }

  const normalizedPhones = normalizeAdminPhonePayload(req.body);

  const result = await req.app.locals.repository.updateExecutive(req.params.id, {
    actorUserId: Number(req.body.actorUserId),
    cedula: normalizeString(req.body.cedula),
    fullName: normalizeString(req.body.fullName),
    address: normalizeString(req.body.address),
    phone: normalizedPhones.phone,
    whatsappPhone: normalizedPhones.whatsappPhone,
    email: normalizeString(req.body.email).toLowerCase(),
    city: normalizeString(req.body.city),
    username: normalizeString(req.body.username),
  });

  if (result?.errorCode === 'NOT_FOUND') {
    return res.status(404).json({ message: 'Ejecutivo no encontrado' });
  }

  if (result?.errorCode === 'DUPLICATE_RECORD') {
    return res.status(409).json({ message: result.message });
  }

  if (result?.errorCode === 'INVALID_REFERENCE') {
    return badRequest(res, result.message);
  }

  return res.json({
    ...result,
    auditLogs: await req.app.locals.repository.getAuditLogsForEntity({ entityType: 'executive', entityId: result.id, limit: 10 }),
  });
}));

app.post('/api/admin/executives/:id/inactivate', asyncHandler(async (req, res) => {
  const validationError = validateAdminEntityInactivationPayload(req.body);
  if (validationError) {
    return badRequest(res, validationError);
  }

  const result = await req.app.locals.repository.inactivateExecutive(req.params.id, {
    actorUserId: Number(req.body.actorUserId),
  });

  if (result?.errorCode === 'NOT_FOUND') {
    return res.status(404).json({ message: 'Ejecutivo no encontrado' });
  }

  return res.json({
    ...result,
    auditLogs: await req.app.locals.repository.getAuditLogsForEntity({ entityType: 'executive', entityId: result.id, limit: 10 }),
  });
}));

app.post('/api/admin/clients', asyncHandler(async (req, res) => {
  const validationError = validateAdminClientPayload(req.body);
  if (validationError) {
    return badRequest(res, validationError);
  }

  const normalizedPhones = normalizeAdminPhonePayload(req.body);

  const result = await req.app.locals.repository.createClient({
    actorUserId: Number(req.body.actorUserId),
    username: normalizeString(req.body.username),
    password: normalizeString(req.body.password),
    razonSocial: normalizeString(req.body.razonSocial),
    nit: normalizeString(req.body.nit),
    contactFullName: normalizeString(req.body.contactFullName),
    contactRole: normalizeString(req.body.contactRole),
    phone: normalizedPhones.phone,
    whatsappPhone: normalizedPhones.whatsappPhone,
    email: normalizeString(req.body.email).toLowerCase(),
  });

  if (result?.errorCode === 'DUPLICATE_RECORD') {
    return res.status(409).json({ message: result.message });
  }

  const emailDelivery = await sendProfileWelcomeEmail(req, {
    email: normalizeString(req.body.email).toLowerCase(),
    recipientName: normalizeString(req.body.contactFullName),
    roleLabel: 'cliente',
    username: normalizeString(req.body.username),
    password: normalizeString(req.body.password),
  });

  return res.status(201).json(appendEmailDeliveryMetadata(result, emailDelivery));
}));

app.put('/api/admin/clients/:id', asyncHandler(async (req, res) => {
  const validationError = validateAdminClientUpdatePayload(req.body);
  if (validationError) {
    return badRequest(res, validationError);
  }

  const normalizedPhones = normalizeAdminPhonePayload(req.body);

  const result = await req.app.locals.repository.updateClient(req.params.id, {
    actorUserId: Number(req.body.actorUserId),
    username: normalizeString(req.body.username),
    razonSocial: normalizeString(req.body.razonSocial),
    nit: normalizeString(req.body.nit),
    contactFullName: normalizeString(req.body.contactFullName),
    contactRole: normalizeString(req.body.contactRole),
    phone: normalizedPhones.phone,
    whatsappPhone: normalizedPhones.whatsappPhone,
    email: normalizeString(req.body.email).toLowerCase(),
  });

  if (result?.errorCode === 'NOT_FOUND') {
    return res.status(404).json({ message: 'Cliente no encontrado' });
  }

  if (result?.errorCode === 'DUPLICATE_RECORD') {
    return res.status(409).json({ message: result.message });
  }

  return res.json({
    ...result,
    auditLogs: await req.app.locals.repository.getAuditLogsForEntity({ entityType: 'client', entityId: result.clientId, limit: 10 }),
  });
}));

app.post('/api/admin/clients/:id/inactivate', asyncHandler(async (req, res) => {
  const validationError = validateAdminEntityInactivationPayload(req.body);
  if (validationError) {
    return badRequest(res, validationError);
  }

  const result = await req.app.locals.repository.inactivateClient(req.params.id, {
    actorUserId: Number(req.body.actorUserId),
  });

  if (result?.errorCode === 'NOT_FOUND') {
    return res.status(404).json({ message: 'Cliente no encontrado' });
  }

  return res.json({
    ...result,
    auditLogs: await req.app.locals.repository.getAuditLogsForEntity({ entityType: 'client', entityId: result.clientId, limit: 10 }),
  });
}));

app.get('/api/staff', asyncHandler(async (req, res) => {
  const { city, category, startTime, endTime, eventStartDate, eventEndDate, selectedStaffIds, excludeEventId, excludeCityIndex, excludePointIndex } = req.query;
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
    excludePointOriginalRef: normalizePointOriginalRef({ excludeEventId, excludeCityIndex, excludePointIndex }),
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

app.get('/api/staff-categories', asyncHandler(async (req, res) => {
  return res.json(await req.app.locals.repository.getStaffCategories({ search: normalizeString(req.query?.q) }));
}));

app.get('/api/admin/coordinators', asyncHandler(async (req, res) => {
  return res.json(await req.app.locals.repository.getAdminCoordinators());
}));

app.get('/api/admin/coordinators/by-cedula', asyncHandler(async (req, res) => {
  const cedula = normalizeString(req.query?.cedula);
  if (!cedula) {
    return badRequest(res, 'La cédula es obligatoria');
  }

  const coordinator = await req.app.locals.repository.findAdminCoordinatorByCedula(cedula);
  return res.json({
    exists: Boolean(coordinator),
    coordinator: coordinator || null,
    auditLogs: coordinator ? await req.app.locals.repository.getAuditLogsForEntity({ entityType: 'coordinator', entityId: coordinator.id, limit: 10 }) : [],
  });
}));

app.post('/api/admin/coordinators', asyncHandler(async (req, res) => {
  const validationError = validateAdminCoordinatorPayload(req.body);
  if (validationError) {
    return badRequest(res, validationError);
  }

  const normalizedPhones = normalizeAdminPhonePayload(req.body);

  const result = await req.app.locals.repository.createCoordinator({
    actorUserId: Number(req.body.actorUserId),
    username: normalizeString(req.body.username),
    password: normalizeString(req.body.password),
    fullName: normalizeString(req.body.fullName),
    cedula: normalizeString(req.body.cedula),
    address: normalizeString(req.body.address),
    phone: normalizedPhones.phone,
    whatsappPhone: normalizedPhones.whatsappPhone,
    email: normalizeString(req.body.email).toLowerCase(),
    city: normalizeString(req.body.city),
    photo: normalizeAdminPhotoPayload(req.body.photo),
  });

  if (result?.errorCode === 'DUPLICATE_RECORD') {
    return res.status(409).json({ message: result.message });
  }

  if (result?.errorCode === 'INVALID_REFERENCE') {
    return badRequest(res, result.message);
  }

  const emailDelivery = await sendProfileWelcomeEmail(req, {
    email: normalizeString(req.body.email).toLowerCase(),
    recipientName: normalizeString(req.body.fullName),
    roleLabel: 'coordinador',
    username: normalizeString(req.body.username),
    password: normalizeString(req.body.password),
  });

  return res.status(201).json(appendEmailDeliveryMetadata(result, emailDelivery));
}));

app.put('/api/admin/coordinators/:id', asyncHandler(async (req, res) => {
  const validationError = validateAdminCoordinatorUpdatePayload(req.body);
  if (validationError) {
    return badRequest(res, validationError);
  }

  const normalizedPhones = normalizeAdminPhonePayload(req.body);

  const result = await req.app.locals.repository.updateCoordinator(req.params.id, {
    actorUserId: Number(req.body.actorUserId),
    username: normalizeString(req.body.username),
    fullName: normalizeString(req.body.fullName),
    cedula: normalizeString(req.body.cedula),
    address: normalizeString(req.body.address),
    phone: normalizedPhones.phone,
    whatsappPhone: normalizedPhones.whatsappPhone,
    email: normalizeString(req.body.email).toLowerCase(),
    city: normalizeString(req.body.city),
    photo: normalizeAdminPhotoPayload(req.body.photo),
  });

  if (result?.errorCode === 'NOT_FOUND') {
    return res.status(404).json({ message: 'Coordinador no encontrado' });
  }

  if (result?.errorCode === 'DUPLICATE_RECORD') {
    return res.status(409).json({ message: result.message });
  }

  if (result?.errorCode === 'INVALID_REFERENCE') {
    return badRequest(res, result.message);
  }

  return res.json({
    ...result,
    auditLogs: await req.app.locals.repository.getAuditLogsForEntity({ entityType: 'coordinator', entityId: result.id, limit: 10 }),
  });
}));

app.post('/api/admin/coordinators/:id/inactivate', asyncHandler(async (req, res) => {
  const validationError = validateAdminEntityInactivationPayload(req.body);
  if (validationError) {
    return badRequest(res, validationError);
  }

  const result = await req.app.locals.repository.inactivateCoordinator(req.params.id, {
    actorUserId: Number(req.body.actorUserId),
  });

  if (result?.errorCode === 'NOT_FOUND') {
    return res.status(404).json({ message: 'Coordinador no encontrado' });
  }

  return res.json({
    ...result,
    auditLogs: await req.app.locals.repository.getAuditLogsForEntity({ entityType: 'coordinator', entityId: result.id, limit: 10 }),
  });
}));

app.get('/api/admin/staff', asyncHandler(async (req, res) => {
  return res.json(await req.app.locals.repository.getAdminStaff());
}));

app.get('/api/admin/staff/by-cedula', asyncHandler(async (req, res) => {
  const cedula = normalizeString(req.query?.cedula);
  if (!cedula) {
    return badRequest(res, 'La cédula es obligatoria');
  }

  const staffMember = await req.app.locals.repository.findAdminStaffByCedula(cedula);
  return res.json({
    exists: Boolean(staffMember),
    staff: staffMember || null,
    auditLogs: staffMember ? await req.app.locals.repository.getAuditLogsForEntity({ entityType: 'staff', entityId: staffMember.id, limit: 10 }) : [],
  });
}));

app.get('/api/admin/staff-categories', asyncHandler(async (req, res) => {
  return res.json(await req.app.locals.repository.getStaffCategories({ search: normalizeString(req.query?.q) }));
}));

app.post('/api/admin/staff-categories', asyncHandler(async (req, res) => {
  const name = normalizeStaffCategoryName(req.body?.name);

  if (!name) {
    return badRequest(res, 'El nombre de la categoría es obligatorio');
  }

  const result = await req.app.locals.repository.createStaffCategory(name);

  if (result?.errorCode === 'DUPLICATE_RECORD') {
    return res.status(409).json({ message: result.message });
  }

  if (result?.errorCode === 'INVALID_PAYLOAD') {
    return badRequest(res, result.message);
  }

  return res.status(201).json(result);
}));

app.post('/api/admin/staff', asyncHandler(async (req, res) => {
  const validationError = validateAdminStaffPayload(req.body);
  if (validationError) {
    return badRequest(res, validationError);
  }

  const result = await req.app.locals.repository.createStaff({
    actorUserId: Number(req.body.actorUserId),
    fullName: normalizeString(req.body.fullName),
    cedula: normalizeString(req.body.cedula),
    city: normalizeString(req.body.city),
    category: normalizeStaffCategoryName(req.body.category),
    sexo: normalizeStaffSexo(req.body.sexo),
    shirtSize: normalizeString(req.body.shirtSize),
    pantsSize: normalizeString(req.body.pantsSize),
    clothingSize: normalizeString(req.body.clothingSize),
    shoeSize: normalizeString(req.body.shoeSize),
    altura: normalizeString(req.body.altura),
    busto: normalizeString(req.body.busto),
    cintura: normalizeString(req.body.cintura),
    cadera: normalizeString(req.body.cadera),
    measurements: normalizeString(req.body.measurements),
    photo: normalizeAdminPhotoPayload(req.body.photo),
  });

  if (result?.errorCode === 'DUPLICATE_RECORD') {
    return res.status(409).json({ message: result.message });
  }

  if (result?.errorCode === 'INVALID_REFERENCE') {
    return badRequest(res, result.message);
  }

  return res.status(201).json(result);
}));

app.put('/api/admin/staff/:id', asyncHandler(async (req, res) => {
  const validationError = validateAdminStaffUpdatePayload(req.body);
  if (validationError) {
    return badRequest(res, validationError);
  }

  const result = await req.app.locals.repository.updateStaff(req.params.id, {
    actorUserId: Number(req.body.actorUserId),
    fullName: normalizeString(req.body.fullName),
    cedula: normalizeString(req.body.cedula),
    city: normalizeString(req.body.city),
    category: normalizeStaffCategoryName(req.body.category),
    sexo: normalizeStaffSexo(req.body.sexo),
    shirtSize: normalizeString(req.body.shirtSize),
    pantsSize: normalizeString(req.body.pantsSize),
    clothingSize: normalizeString(req.body.clothingSize),
    shoeSize: normalizeString(req.body.shoeSize),
    altura: normalizeString(req.body.altura),
    busto: normalizeString(req.body.busto),
    cintura: normalizeString(req.body.cintura),
    cadera: normalizeString(req.body.cadera),
    measurements: normalizeString(req.body.measurements),
    photo: normalizeAdminPhotoPayload(req.body.photo),
  });

  if (result?.errorCode === 'NOT_FOUND') {
    return res.status(404).json({ message: 'Staff no encontrado' });
  }

  if (result?.errorCode === 'DUPLICATE_RECORD') {
    return res.status(409).json({ message: result.message });
  }

  if (result?.errorCode === 'INVALID_REFERENCE') {
    return badRequest(res, result.message);
  }

  return res.json({
    ...result,
    auditLogs: await req.app.locals.repository.getAuditLogsForEntity({ entityType: 'staff', entityId: result.id, limit: 10 }),
  });
}));

app.post('/api/admin/staff/:id/inactivate', asyncHandler(async (req, res) => {
  const validationError = validateAdminEntityInactivationPayload(req.body);
  if (validationError) {
    return badRequest(res, validationError);
  }

  const result = await req.app.locals.repository.inactivateStaff(req.params.id, {
    actorUserId: Number(req.body.actorUserId),
  });

  if (result?.errorCode === 'NOT_FOUND') {
    return res.status(404).json({ message: 'Staff no encontrado' });
  }

  return res.json({
    ...result,
    auditLogs: await req.app.locals.repository.getAuditLogsForEntity({ entityType: 'staff', entityId: result.id, limit: 10 }),
  });
}));

app.get('/api/export/coordinators', asyncHandler(async (req, res) => {
  const actor = await resolveAdminActor(req, res);
  if (!actor) {
    return null;
  }

  const coordinators = await req.app.locals.repository.getAdminCoordinators();
  const csvContent = buildCsv({
    headers: [
      { key: 'fullName', label: 'nombre' },
      { key: 'username', label: 'usuario' },
      { key: 'cedula', label: 'cedula' },
      { key: 'city', label: 'ciudad' },
      { key: 'email', label: 'email' },
      { key: 'phone', label: 'telefono' },
      { key: 'whatsappPhone', label: 'whatsapp' },
      { key: 'status', label: 'estado' },
      { key: 'createdAt', label: 'fecha_creacion' },
    ],
    rows: (Array.isArray(coordinators) ? coordinators : []).map((coordinator) => ({
      ...coordinator,
      status: coordinator?.isActive === false ? 'INACTIVO' : 'ACTIVO',
      createdAt: formatCsvDate(coordinator?.createdAt || coordinator?.created_at),
    })),
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="coordinadores_eventrix.csv"');
  return res.status(200).send(csvContent);
}));

app.get('/api/export/staff', asyncHandler(async (req, res) => {
  const actor = await resolveAdminActor(req, res);
  if (!actor) {
    return null;
  }

  const staff = await req.app.locals.repository.getAdminStaff();
  const csvContent = buildCsv({
    headers: [
      { key: 'fullName', label: 'nombre' },
      { key: 'cedula', label: 'cedula' },
      { key: 'city', label: 'ciudad' },
      { key: 'category', label: 'categoria' },
      { key: 'sexo', label: 'sexo' },
      { key: 'phone', label: 'telefono' },
      { key: 'email', label: 'email' },
      { key: 'status', label: 'estado' },
      { key: 'createdAt', label: 'fecha_creacion' },
    ],
    rows: (Array.isArray(staff) ? staff : []).map((staffMember) => ({
      ...staffMember,
      status: staffMember?.isActive === false ? 'INACTIVO' : 'ACTIVO',
      createdAt: formatCsvDate(staffMember?.createdAt || staffMember?.created_at),
    })),
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="staff_eventrix.csv"');
  return res.status(200).send(csvContent);
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
app.get('/api/client/events', asyncHandler(async (req, res) => {
  const userId = Number(req.query?.userId);

  if (!Number.isInteger(userId) || userId <= 0) {
    return badRequest(res, 'El userId del cliente es requerido');
  }

  return res.json(await req.app.locals.repository.getClientEvents({ userId }));
}));
app.post('/api/events', asyncHandler(async (req, res) => {
  const preparedEventPayload = normalizeEventSchedulePayload(stripDraftAssignmentMetadata({
    ...req.body,
    image: normalizeEventImagePayload(req.body.image),
  }));

  const validationError = validateEventPayload(preparedEventPayload);
  if (validationError) {
    return badRequest(res, validationError);
  }

  const assignmentConflict = validateDraftAssignments({
    draftEvent: preparedEventPayload,
    existingEvents: await req.app.locals.repository.getEvents(),
  });
  if (assignmentConflict) {
    return badRequest(res, assignmentConflict);
  }

  let newE;

  try {
    newE = await req.app.locals.repository.createEvent(preparedEventPayload);
  } catch (error) {
    error.operation = 'create-event';
    error.createEventSummary = summarizeCreateEventPayload(req.body);
    throw error;
  }

  return res.status(201).json(newE);
}));
app.put('/api/events/:id', asyncHandler(async (req, res) => {
  const existingEvent = await req.app.locals.repository.getEventById(req.params.id);
  if (!existingEvent) {
    return res.status(404).json({ message: 'Evento no encontrado' });
  }

  if (Number(existingEvent.createdByUserId) !== Number(req.body?.createdByUserId)) {
    return res.status(403).json({ message: 'No puedes editar un evento de otro ejecutivo' });
  }

  if (existingEvent.isInactive) {
    return badRequest(res, 'El evento está inactivo y no admite edición');
  }

  const preparedEventPayload = normalizeEventSchedulePayload(stripDraftAssignmentMetadata({
    ...req.body,
    image: normalizeEventImagePayload(req.body.image),
  }));

  const validationError = validateEventPayload(preparedEventPayload);
  if (validationError) {
    return badRequest(res, validationError);
  }

  const assignmentConflict = validateDraftAssignments({
    draftEvent: preparedEventPayload,
    existingEvents: await req.app.locals.repository.getEvents(),
  });
  if (assignmentConflict) {
    return badRequest(res, assignmentConflict);
  }

  const updatedEvent = await req.app.locals.repository.updateEvent(req.params.id, preparedEventPayload);
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
    return res.status(403).json({ message: 'No puedes inactivar un evento de otro ejecutivo' });
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
    directImpact: Number(req.body.directImpact || 0),
    indirectImpact: Number(req.body.indirectImpact || 0),
    hasRedemptions: Boolean(req.body.hasRedemptions),
    redemptionsCount: Number(req.body.redemptionsCount || 0),
    relevantAspects: normalizeString(req.body.relevantAspects),
  });

  if (updatedEvent === false) {
    return res.status(403).json({ message: 'El coordinador no está autorizado para cargar informes en este evento' });
  }

  if (updatedEvent?.errorCode === 'INVALID_REPORT_TIME_RANGE') {
    return badRequest(res, updatedEvent.message);
  }

  if (!updatedEvent) {
    return res.status(404).json({ message: 'Evento no encontrado' });
  }

  return res.json(updatedEvent);
}));

app.put('/api/events/:id/executive-report', asyncHandler(async (req, res) => {
  const validationError = validateExecutiveReportPayload(req.body);
  if (validationError) {
    return badRequest(res, validationError);
  }

  const updatedEvent = await req.app.locals.repository.saveExecutiveReport(req.params.id, {
    authorUserId: Number(req.body.authorUserId),
    title: normalizeString(req.body.title),
    executiveSummary: normalizeString(req.body.executiveSummary),
    objectivesCompliance: normalizeString(req.body.objectivesCompliance),
    resultsImpact: normalizeString(req.body.resultsImpact),
    redemptions: normalizeString(req.body.redemptions),
    highlights: normalizeString(req.body.highlights),
    incidents: normalizeString(req.body.incidents),
    recommendations: normalizeString(req.body.recommendations),
    selectedPhotoIds: Array.isArray(req.body.selectedPhotoIds) ? req.body.selectedPhotoIds : [],
    selectedReportIds: Array.isArray(req.body.selectedReportIds) ? req.body.selectedReportIds : [],
    status: normalizeString(req.body.status).toLowerCase(),
  });

  if (updatedEvent === false) {
    return res.status(403).json({ message: 'No puedes guardar el informe final de un evento de otro ejecutivo' });
  }

  if (updatedEvent?.errorCode === 'EXECUTIVE_REPORT_LOCKED') {
    return res.status(409).json({ message: 'El informe final ya fue publicado y quedó bloqueado' });
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
  console.error('❌ API error', {
    request: {
      method: req.method,
      path: req.originalUrl,
    },
    error: serializeErrorForLog(error),
    createEventSummary: error?.createEventSummary || null,
  });

  if (res.headersSent) {
    return next(error);
  }

  return res.status(500).json({
    message: 'Ocurrió un error interno',
  });
});

const bootstrap = async () => {
  const repository = createRepository();
  const welcomeEmailService = createWelcomeEmailService({ smtpConfig: config.smtp });
  app.locals.repository = repository;
  app.locals.welcomeEmailService = welcomeEmailService;

  if (typeof repository.ping === 'function') {
    await repository.ping();
  }

  app.listen(config.app.port, () => console.log(`🚀 API on ${config.app.port}`));
};

bootstrap().catch((error) => {
  console.error('❌ Error inicializando la API', error);
  process.exit(1);
});
