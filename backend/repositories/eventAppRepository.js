const fs = require('fs');
const { comparePassword } = require('../utils/passwords');
const { mapCoordinatorEvent, normalizeExecutiveContact } = require('../utils/coordinatorEvents');
const { buildCoordinatorPhoto, buildCoordinatorReport, normalizePhotoEntry, normalizeReportEntry, validateCoordinatorReportTimeRange } = require('../utils/eventAssets');
const { buildExecutiveReport, normalizeExecutiveReportEntry, sanitizeEventForClient } = require('../utils/executiveReports');
const { enrichEventLifecycle } = require('../utils/eventLifecycle');
const { matchesClientIdentityConflict, normalizeClientMutationPayload } = require('../utils/adminClientPayload');
const { cloneAuditPayload, sanitizeAuditLogRecord } = require('../utils/auditLogs');
const {
  DEFAULT_PROFILE_PHOTO,
  buildFallbackExecutiveCedula,
  isDocumentEquivalent,
  isNitEquivalent,
  normalizeComparableValue,
  normalizePhotoAssetField,
  normalizeProfilePhotoField,
  normalizePhoneValue,
  resolveStaffSizeFields,
  sanitizeClientRecord,
  sanitizeCoordinatorAdminRecord,
  sanitizeExecutiveAdminRecord,
  sanitizeStaffAdminRecord,
  sanitizeUserRecord,
} = require('../utils/adminRecords');
const {
  isStaffCategoryMatch,
  mergeStaffCategoryCatalog,
  normalizeStaffCategoryName,
  sanitizeStaffCategoryRecord,
} = require('../utils/staffCategories');
const { normalizeStaffSexo, serializeStaffMeasurements } = require('../utils/staffMeasurements');

const DEFAULT_EXECUTIVE_USER_ID = 2;
const DUPLICATE_USERNAME_MESSAGE = 'El nombre de usuario ya está en uso y debe ser único para iniciar sesión.';
const DUPLICATE_CLIENT_NIT_MESSAGE = 'Ya existe un cliente con ese NIT.';
const DUPLICATE_COORDINATOR_CEDULA_MESSAGE = 'Ya existe un coordinador con esa cédula.';
const DUPLICATE_EXECUTIVE_CEDULA_MESSAGE = 'Ya existe un ejecutivo con esa cédula.';
const DUPLICATE_STAFF_CEDULA_MESSAGE = 'Ya existe una persona de staff con esa cédula.';

const clone = (value) => JSON.parse(JSON.stringify(value));

const hasDuplicateUsername = ({ users, username, excludeUserId = null }) => {
  const normalizedUsername = normalizeComparableValue(username);
  if (!normalizedUsername) {
    return false;
  }

  return users.some((user) => Number(user.id) !== Number(excludeUserId)
    && normalizeComparableValue(user.username) === normalizedUsername);
};

const resolveClientUserId = ({ rawClientUserId, client, clients }) => {
  const normalizedRawClientUserId = Number(rawClientUserId);
  if (Number.isInteger(normalizedRawClientUserId) && normalizedRawClientUserId > 0) {
    const explicitClient = clients.find((candidate) => Number(candidate.userId || candidate.id) === normalizedRawClientUserId) || null;
    const comparableClient = normalizeComparableValue(client);

    if (explicitClient && normalizeComparableValue(explicitClient.username) === 'cliente') {
      const matchesDemoIdentity = [explicitClient.fullName, explicitClient.username, explicitClient.email]
        .some((value) => normalizeComparableValue(value) === comparableClient);

      return matchesDemoIdentity ? normalizedRawClientUserId : null;
    }

    return normalizedRawClientUserId;
  }

  const comparableClient = normalizeComparableValue(client);
  if (!comparableClient) {
    return null;
  }

  const matches = clients.filter((candidate) => [
    candidate.fullName,
    candidate.razonSocial,
    candidate.contactFullName,
    candidate.username,
    candidate.email,
  ].some((value) => normalizeComparableValue(value) === comparableClient));

  return matches.length === 1 ? Number(matches[0].userId || matches[0].id) : null;
};

const resolveClientId = ({ rawClientId, rawClientUserId, client, clients }) => {
  const normalizedRawClientId = Number(rawClientId);
  if (Number.isInteger(normalizedRawClientId) && normalizedRawClientId > 0) {
    return normalizedRawClientId;
  }

  const normalizedRawClientUserId = Number(rawClientUserId);
  if (Number.isInteger(normalizedRawClientUserId) && normalizedRawClientUserId > 0) {
    const explicitClient = clients.find((candidate) => Number(candidate.userId || candidate.id) === normalizedRawClientUserId) || null;
    return explicitClient ? Number(explicitClient.clientId || explicitClient.id) : null;
  }

  const comparableClient = normalizeComparableValue(client);
  if (!comparableClient) {
    return null;
  }

  const matches = clients.filter((candidate) => [
    candidate.fullName,
    candidate.razonSocial,
    candidate.contactFullName,
    candidate.username,
    candidate.email,
  ].some((value) => normalizeComparableValue(value) === comparableClient));

  return matches.length === 1 ? Number(matches[0].clientId || matches[0].id) : null;
};

const normalizeCity = (city) => ({
  id: city.id,
  name: city.name,
  isOther: Boolean(city.isOther || String(city.name || '').toUpperCase() === 'OTRO'),
});

const normalizeEvent = (event, clients = []) => {
  const normalizedImage = normalizePhotoAssetField(
    event.imageMetadata ? { uri: event.image, ...event.imageMetadata } : event.image,
    { defaultUri: null },
  );

  return {
    ...event,
    image: normalizedImage.uri,
    imageMetadata: normalizedImage.metadata,
    createdByUserId: Number(event.createdByUserId || event.created_by_user_id || DEFAULT_EXECUTIVE_USER_ID),
    clientId: resolveClientId({
      rawClientId: event.clientId || event.client_id,
      rawClientUserId: event.clientUserId || event.client_user_id,
      client: event.client,
      clients,
    }),
    clientUserId: resolveClientUserId({
      rawClientUserId: event.clientUserId || event.client_user_id,
      client: event.client,
      clients,
    }),
    cities: Array.isArray(event.cities)
      ? event.cities.map((city) => ({
        ...city,
        points: Array.isArray(city.points) ? city.points : [],
      }))
      : [],
    reports: Array.isArray(event.reports) ? event.reports.map(normalizeReportEntry).filter(Boolean) : [],
    photos: Array.isArray(event.photos) ? event.photos.map(normalizePhotoEntry).filter(Boolean) : [],
    executiveReport: normalizeExecutiveReportEntry(event.executiveReport || event.executive_report, {
      photos: Array.isArray(event.photos) ? event.photos.map(normalizePhotoEntry).filter(Boolean) : [],
    }),
    manualInactivatedAt: event.manualInactivatedAt || event.manual_inactivated_at || null,
    manualInactivationComment: event.manualInactivationComment || event.manual_inactivation_comment || null,
    manualInactivatedByUserId: Number(event.manualInactivatedByUserId || event.manual_inactivated_by_user_id || 0) || null,
  };
};

const normalizeCoordinator = (coordinator) => ({
  ...coordinator,
  userId: Number(coordinator.userId || coordinator.user_id || 0) || null,
  isActive: coordinator.isActive ?? coordinator.is_active ?? true,
  ...normalizeProfilePhotoField(coordinator.photoMetadata ? { uri: coordinator.photo, ...coordinator.photoMetadata } : coordinator.photo),
});

const normalizeExecutive = (executive) => ({
  ...executive,
  id: Number(executive.id),
  userId: Number(executive.userId || executive.user_id || 0) || null,
  cedula: executive.cedula || null,
  fullName: executive.fullName || executive.full_name || null,
  address: executive.address || null,
  phone: executive.phone || null,
  whatsappPhone: executive.whatsappPhone || executive.whatsapp_phone || null,
  email: executive.email || null,
  city: executive.city || executive.city_name || null,
  isActive: executive.isActive ?? executive.is_active ?? true,
});

const normalizeStaffMember = (staffMember) => ({
  ...staffMember,
  ...resolveStaffSizeFields(staffMember),
  sexo: normalizeStaffSexo(staffMember.sexo || staffMember.sex),
  isActive: staffMember.isActive ?? staffMember.is_active ?? true,
  ...normalizeProfilePhotoField(staffMember.photoMetadata ? { uri: staffMember.photo, ...staffMember.photoMetadata } : staffMember.photo),
});

const normalizeDb = (db, initialDb) => ({
  ...clone(initialDb),
  ...db,
  users: Array.isArray(db?.users) && db.users.length > 0 ? db.users : clone(initialDb.users),
  executives: buildExecutivesDb({ db, initialDb }),
  clients: buildClientsDb({ db, initialDb }),
  coordinators: Array.isArray(db?.coordinators) && db.coordinators.length > 0 ? db.coordinators.map(normalizeCoordinator) : clone(initialDb.coordinators).map(normalizeCoordinator),
  staff: Array.isArray(db?.staff) && db.staff.length > 0 ? db.staff.map(normalizeStaffMember) : clone(initialDb.staff).map(normalizeStaffMember),
  staffCategories: buildStaffCategoriesDb({ db, initialDb }),
  cities: Array.isArray(db?.cities) && db.cities.length > 0 ? db.cities.map(normalizeCity) : clone(initialDb.cities),
  auditLogs: Array.isArray(db?.auditLogs) ? db.auditLogs.map((auditLog) => sanitizeAuditLogRecord({ auditLog })) : [],
  events: Array.isArray(db?.events) ? db.events : [],
});

function buildExecutivesDb({ db, initialDb }) {
  const users = Array.isArray(db?.users) && db.users.length > 0 ? db.users : clone(initialDb.users);
  const sourceExecutives = Array.isArray(db?.executives) && db.executives.length > 0
    ? db.executives
    : (Array.isArray(initialDb?.executives) ? clone(initialDb.executives) : []);
  const executivesByUserId = new Map(
    sourceExecutives
      .map((executive) => ({
        ...normalizeExecutive(executive),
      }))
      .filter((executive) => Number.isInteger(executive.userId) && executive.userId > 0)
      .map((executive) => [executive.userId, executive]),
  );
  let nextId = sourceExecutives.reduce((max, executive) => Math.max(max, Number(executive.id) || 0), 0);

  return users
    .filter((user) => String(user.role || '').toUpperCase() === 'EJECUTIVO')
    .map((user) => {
      const existingExecutive = executivesByUserId.get(Number(user.id));
      if (existingExecutive) {
        return {
          ...existingExecutive,
          cedula: existingExecutive.cedula || buildFallbackExecutiveCedula(existingExecutive.userId || user.id),
          fullName: existingExecutive.fullName || user.fullName,
          address: existingExecutive.address || null,
          phone: existingExecutive.phone || user.phone || null,
          whatsappPhone: existingExecutive.whatsappPhone || user.whatsappPhone || user.whatsapp_phone || user.phone || null,
          email: existingExecutive.email || user.email || null,
          city: existingExecutive.city || null,
          isActive: (existingExecutive.isActive ?? true) !== false && user.isActive !== false,
        };
      }

      nextId += 1;
      return {
        id: nextId,
        userId: Number(user.id),
        cedula: buildFallbackExecutiveCedula(user.id),
        fullName: user.fullName,
        address: null,
        phone: user.phone || null,
        whatsappPhone: user.whatsappPhone || user.whatsapp_phone || user.phone || null,
        email: user.email || null,
        city: null,
        isActive: user.isActive !== false,
      };
    });
}

function buildClientsDb({ db, initialDb }) {
  const users = Array.isArray(db?.users) && db.users.length > 0 ? db.users : clone(initialDb.users);
  const sourceClients = Array.isArray(db?.clients) && db.clients.length > 0
    ? db.clients
    : (Array.isArray(initialDb?.clients) ? clone(initialDb.clients) : []);
  const clientsByUserId = new Map(
    sourceClients
      .map((client) => ({
        ...client,
        id: Number(client.id),
        userId: Number(client.userId || client.user_id || 0) || null,
        razonSocial: client.razonSocial || client.razon_social || null,
        nit: client.nit || null,
        contactFullName: client.contactFullName || client.contact_full_name || null,
        contactRole: client.contactRole || client.contact_role || null,
        phone: client.phone || null,
        whatsappPhone: client.whatsappPhone || client.whatsapp_phone || null,
        email: client.email || null,
        isActive: client.isActive ?? client.is_active ?? true,
      }))
      .filter((client) => Number.isInteger(client.userId) && client.userId > 0)
      .map((client) => [client.userId, client]),
  );
  let nextId = sourceClients.reduce((max, client) => Math.max(max, Number(client.id) || 0), 0);

  return users
    .filter((user) => String(user.role || '').toUpperCase() === 'CLIENTE')
    .map((user) => {
      const existingClient = clientsByUserId.get(Number(user.id));
      if (existingClient) {
        return {
          ...existingClient,
          razonSocial: existingClient.razonSocial || user.fullName,
          contactFullName: existingClient.contactFullName || user.fullName,
          phone: existingClient.phone || user.phone || null,
          whatsappPhone: existingClient.whatsappPhone || user.whatsappPhone || user.whatsapp_phone || user.phone || null,
          email: existingClient.email || user.email || null,
          isActive: (existingClient.isActive ?? true) !== false && user.isActive !== false,
        };
      }

      nextId += 1;
      return {
        id: nextId,
        userId: Number(user.id),
        razonSocial: user.fullName,
        nit: null,
        contactFullName: user.fullName,
        contactRole: null,
        phone: user.phone || null,
        whatsappPhone: user.whatsappPhone || user.whatsapp_phone || user.phone || null,
        email: user.email || null,
        isActive: user.isActive !== false,
      };
    });
}

function buildStaffCategoriesDb({ db, initialDb }) {
  return mergeStaffCategoryCatalog({
    categories: Array.isArray(db?.staffCategories) ? db.staffCategories : (Array.isArray(initialDb?.staffCategories) ? clone(initialDb.staffCategories) : []),
    staff: Array.isArray(db?.staff) ? db.staff : (Array.isArray(initialDb?.staff) ? clone(initialDb.staff) : []),
  });
}

class EventAppRepository {
  constructor({ dbFile, initialDb }) {
    this.dbFile = dbFile;
    this.initialDb = initialDb;
    this.db = normalizeDb(initialDb, initialDb);
    this.load();
  }

  load() {
    if (!fs.existsSync(this.dbFile)) {
      return;
    }

    try {
      const data = fs.readFileSync(this.dbFile, 'utf8');
      if (data) {
        this.db = normalizeDb(JSON.parse(data), this.initialDb);
        this.save();
      }
      console.log('✅ Disco cargado');
    } catch (error) {
      console.error('❌ Error lectura DB', error);
    }
  }

  save() {
    fs.writeFileSync(this.dbFile, JSON.stringify(this.db, null, 2));
  }

  async ping() {
    return true;
  }

  async authenticateUser({ username, password }) {
    const user = this.db.users.find((item) => item.username.toLowerCase() === username.toLowerCase());

    if (!user || user.isActive === false || !comparePassword(password, user.password)) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      phone: user.phone || null,
      whatsappPhone: user.whatsappPhone || user.whatsapp_phone || null,
      email: user.email || null,
      role: user.role,
    };
  }

  findUserById(id) {
    return this.db.users.find((user) => Number(user.id) === Number(id)) || null;
  }

  changeUserPassword({ userId, currentPassword, newPassword }) {
    const userIndex = this.db.users.findIndex((user) => Number(user.id) === Number(userId));

    if (userIndex === -1) {
      return { errorCode: 'USER_NOT_FOUND' };
    }

    if (!comparePassword(currentPassword, this.db.users[userIndex].password)) {
      return { errorCode: 'INVALID_CURRENT_PASSWORD' };
    }

    this.db.users[userIndex] = {
      ...this.db.users[userIndex],
      password: newPassword,
    };
    this.save();

    return {
      id: this.db.users[userIndex].id,
      username: this.db.users[userIndex].username,
    };
  }

  getClients({ search } = {}) {
    const normalizedSearch = String(search || '').trim().toLowerCase();
    const clients = this.db.clients
      .map((client) => sanitizeClientRecord({
        client,
        user: this.findUserById(client.userId),
      }))
      .filter((client) => client.userId && client.isActive !== false)
      .sort((left, right) => String(left.fullName || '').localeCompare(String(right.fullName || ''), 'es'));

    if (!normalizedSearch) {
      return clients;
    }

    return clients.filter((client) => [
      client.fullName,
      client.razonSocial,
      client.contactFullName,
      client.username,
      client.email,
      client.nit,
    ].some((value) => String(value || '').trim().toLowerCase().includes(normalizedSearch)));
  }

  getAdminClients({ search } = {}) {
    const normalizedSearch = String(search || '').trim().toLowerCase();
    const clients = this.db.clients
      .map((client) => sanitizeClientRecord({
        client,
        user: this.findUserById(client.userId),
      }))
      .filter((client) => client.userId)
      .sort((left, right) => String(left.fullName || '').localeCompare(String(right.fullName || ''), 'es'));

    if (!normalizedSearch) {
      return clients;
    }

    return clients.filter((client) => [
      client.fullName,
      client.razonSocial,
      client.contactFullName,
      client.username,
      client.email,
      client.nit,
    ].some((value) => String(value || '').trim().toLowerCase().includes(normalizedSearch)));
  }

  getAdminExecutives({ search } = {}) {
    const normalizedSearch = String(search || '').trim().toLowerCase();
    const executives = this.db.executives
      .map((executive) => sanitizeExecutiveAdminRecord(executive, this.findUserById(executive.userId)))
      .filter((executive) => executive.userId)
      .sort((left, right) => String(left.fullName || '').localeCompare(String(right.fullName || ''), 'es'));

    if (!normalizedSearch) {
      return executives;
    }

    return executives.filter((executive) => [
      executive.fullName,
      executive.username,
      executive.cedula,
      executive.email,
      executive.address,
      executive.city,
      executive.phone,
      executive.whatsappPhone,
    ].some((value) => String(value || '').trim().toLowerCase().includes(normalizedSearch)));
  }

  findAdminExecutiveByCedula(cedula) {
    const normalizedCedula = String(cedula || '').trim();
    if (!normalizedCedula) {
      return null;
    }

    return this.getAdminExecutives().find((executive) => isDocumentEquivalent(executive.cedula, normalizedCedula)) || null;
  }

  findAdminClientByNit(nit) {
    const normalizedNit = String(nit || '').trim();
    if (!normalizedNit) {
      return null;
    }

    return this.getAdminClients().find((client) => isNitEquivalent(client.nit, normalizedNit)) || null;
  }

  getAuditLogsForEntity({ entityType, entityId, limit = 10 }) {
    return this.db.auditLogs
      .filter((auditLog) => auditLog.entityType === entityType && Number(auditLog.entityId) === Number(entityId))
      .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
      .slice(0, limit)
      .map((auditLog) => sanitizeAuditLogRecord({
        auditLog,
        actor: auditLog.actorUserId ? this.findUserById(auditLog.actorUserId) : null,
      }));
  }

  findAdminCoordinatorByCedula(cedula) {
    const normalizedCedula = String(cedula || '').trim();
    if (!normalizedCedula) {
      return null;
    }

    return this.getAdminCoordinators().find((coordinator) => isDocumentEquivalent(coordinator.cedula, normalizedCedula)) || null;
  }

  findAdminStaffByCedula(cedula) {
    const normalizedCedula = String(cedula || '').trim();
    if (!normalizedCedula) {
      return null;
    }

    return this.getAdminStaff().find((staffMember) => isDocumentEquivalent(staffMember.cedula, normalizedCedula)) || null;
  }

  getAdminCoordinators() {
    return this.db.coordinators
      .map((coordinator) => sanitizeCoordinatorAdminRecord({
        coordinator,
        user: coordinator.userId ? this.findUserById(coordinator.userId) : null,
      }))
      .sort((left, right) => String(left.fullName || '').localeCompare(String(right.fullName || ''), 'es'));
  }

  getAdminStaff() {
    return this.db.staff
      .map(sanitizeStaffAdminRecord)
      .sort((left, right) => String(left.fullName || '').localeCompare(String(right.fullName || ''), 'es'));
  }

  findCoordinatorProfileByUserId(userId) {
    const normalizedUserId = Number(userId);

    if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
      return null;
    }

    return this.db.coordinators.find((coordinator) => Number(coordinator.userId) === normalizedUserId && coordinator.isActive !== false && (!coordinator.userId || this.findUserById(coordinator.userId)?.isActive !== false))
      || this.db.coordinators.find((coordinator) => Number(coordinator.id) === normalizedUserId && coordinator.isActive !== false && (!coordinator.userId || this.findUserById(coordinator.userId)?.isActive !== false))
      || null;
  }

  getCoordinators({ city } = {}) {
    let result = this.db.coordinators
      .map(normalizeCoordinator)
      .filter((coordinator) => coordinator.isActive !== false && (!coordinator.userId || this.findUserById(coordinator.userId)?.isActive !== false));

    if (!city) {
      return result;
    }

    return result.filter((coordinator) => coordinator.city.toLowerCase() === city.toLowerCase());
  }

  getCoordinatorEvents({ userId }) {
    const normalizedUserId = Number(userId);

    if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
      return [];
    }

    const coordinatorProfile = this.findCoordinatorProfileByUserId(normalizedUserId);

    if (!coordinatorProfile) {
      return [];
    }

    const events = this.getEvents();

    return events
      .map((event) => mapCoordinatorEvent({
        event,
        coordinatorProfile,
        executiveContact: normalizeExecutiveContact(this.db.users.find((user) => Number(user.id) === Number(event.createdByUserId)) || null),
      }))
      .filter(Boolean);
  }

  getStaff({ city, category } = {}) {
    let result = this.db.staff.map(normalizeStaffMember).filter((staffMember) => staffMember.isActive !== false);

    if (city) {
      result = result.filter((staffMember) => staffMember.city.toLowerCase() === city.toLowerCase());
    }

    if (category) {
      result = result.filter((staffMember) => staffMember.category.toUpperCase() === category.toUpperCase());
    }

    return result.map(sanitizeStaffAdminRecord);
  }

  getStaffCategories({ search } = {}) {
    return this.db.staffCategories.filter((category) => isStaffCategoryMatch(category, search));
  }

  findStaffCategoryByName(name) {
    const normalizedName = normalizeStaffCategoryName(name);
    if (!normalizedName) {
      return null;
    }

    const category = this.db.staffCategories.find((item) => normalizeStaffCategoryName(item.name) === normalizedName) || null;
    return category ? sanitizeStaffCategoryRecord(category) : null;
  }

  createStaffCategory(name) {
    const normalizedName = normalizeStaffCategoryName(name);
    if (!normalizedName) {
      return { errorCode: 'INVALID_PAYLOAD', message: 'El nombre de la categoría es obligatorio.' };
    }

    const existingCategory = this.findStaffCategoryByName(normalizedName);
    if (existingCategory) {
      return { errorCode: 'DUPLICATE_RECORD', message: 'La categoría de staff ya existe.' };
    }

    const newCategory = sanitizeStaffCategoryRecord({
      id: this.#nextId(this.db.staffCategories),
      name: normalizedName,
      createdAt: new Date().toISOString(),
    });

    this.db.staffCategories.push(newCategory);
    this.db.staffCategories.sort((left, right) => left.name.localeCompare(right.name, 'es'));
    this.save();

    return newCategory;
  }

  createClient(payload) {
    const normalizedPayload = normalizeClientMutationPayload(payload);

    const duplicateUser = this.db.users.find((user) => {
      return matchesClientIdentityConflict({ user, normalizedPayload });
    });
    const duplicateClient = this.db.clients.find((client) => {
      return matchesClientIdentityConflict({ client, normalizedPayload });
    });

    const duplicateNitClient = normalizedPayload.nit ? this.findAdminClientByNit(normalizedPayload.nit) : null;

    if (duplicateNitClient || duplicateClient) {
      return { errorCode: 'DUPLICATE_RECORD', message: DUPLICATE_CLIENT_NIT_MESSAGE };
    }

    if (duplicateUser) {
      return { errorCode: 'DUPLICATE_RECORD', message: DUPLICATE_USERNAME_MESSAGE };
    }

    const newUser = {
      id: this.#nextId(this.db.users),
      username: payload.username,
      password: payload.password,
      fullName: payload.contactFullName,
      phone: payload.phone,
      whatsappPhone: payload.whatsappPhone || payload.phone,
      email: payload.email || null,
      role: 'CLIENTE',
      isActive: true,
    };
    const newClient = {
      id: this.#nextId(this.db.clients),
      userId: newUser.id,
      razonSocial: payload.razonSocial,
      nit: payload.nit,
      contactFullName: payload.contactFullName,
      contactRole: payload.contactRole,
      phone: payload.phone,
      whatsappPhone: payload.whatsappPhone || payload.phone,
      email: payload.email || null,
      isActive: true,
    };

    this.db.users.push(newUser);
    this.db.clients.push(newClient);
    const createdRecord = sanitizeClientRecord({ client: newClient, user: newUser });
    this.#recordAuditLog({
      actorUserId: payload.actorUserId,
      entityType: 'client',
      entityId: newClient.id,
      action: 'create',
      previousValues: null,
      newValues: createdRecord,
    });
    this.save();
    return createdRecord;
  }

  createExecutive(payload) {
    const city = this.findCityByName(payload.city);
    if (!city) {
      return { errorCode: 'INVALID_REFERENCE', message: 'La ciudad seleccionada no existe.' };
    }

    const normalizedCedula = payload.cedula ? String(payload.cedula).trim() : '';
    const duplicateUser = hasDuplicateUsername({ users: this.db.users, username: payload.username });
    const duplicateExecutive = this.db.executives.find((executive) => normalizedCedula && isDocumentEquivalent(executive.cedula, normalizedCedula));

    if (duplicateExecutive) {
      return { errorCode: 'DUPLICATE_RECORD', message: DUPLICATE_EXECUTIVE_CEDULA_MESSAGE };
    }

    if (duplicateUser) {
      return { errorCode: 'DUPLICATE_RECORD', message: DUPLICATE_USERNAME_MESSAGE };
    }

    const newUser = {
      id: this.#nextId(this.db.users),
      username: payload.username,
      password: payload.password,
      fullName: payload.fullName,
      phone: payload.phone,
      whatsappPhone: payload.whatsappPhone || payload.phone,
      email: payload.email || null,
      role: 'EJECUTIVO',
      isActive: true,
    };
    const newExecutive = {
      id: this.#nextId(this.db.executives),
      userId: newUser.id,
      cedula: payload.cedula,
      fullName: payload.fullName,
      address: payload.address,
      phone: payload.phone,
      whatsappPhone: payload.whatsappPhone || payload.phone,
      email: payload.email || null,
      city: city.name,
      isActive: true,
    };

    this.db.users.push(newUser);
    this.db.executives.push(newExecutive);
    const createdRecord = sanitizeExecutiveAdminRecord(newExecutive, newUser);
    this.#recordAuditLog({
      actorUserId: payload.actorUserId,
      entityType: 'executive',
      entityId: newExecutive.id,
      action: 'create',
      previousValues: null,
      newValues: createdRecord,
    });
    this.save();

    return createdRecord;
  }

  updateExecutive(executiveId, payload) {
    const normalizedExecutiveId = Number(executiveId);
    const executiveIndex = this.db.executives.findIndex((executive) => Number(executive.id) === normalizedExecutiveId);
    if (executiveIndex === -1) {
      return { errorCode: 'NOT_FOUND' };
    }

    const city = this.findCityByName(payload.city);
    if (!city) {
      return { errorCode: 'INVALID_REFERENCE', message: 'La ciudad seleccionada no existe.' };
    }

    const currentExecutive = this.db.executives[executiveIndex];
    const userIndex = this.db.users.findIndex((user) => Number(user.id) === Number(currentExecutive.userId) && String(user.role || '').toUpperCase() === 'EJECUTIVO');
    if (userIndex === -1) {
      return { errorCode: 'NOT_FOUND' };
    }

    const normalizedCedula = payload.cedula ? String(payload.cedula).trim() : '';
    const duplicateUser = hasDuplicateUsername({ users: this.db.users, username: payload.username, excludeUserId: currentExecutive.userId });
    const duplicateExecutive = this.db.executives.find((executive) => {
      if (Number(executive.id) === normalizedExecutiveId) return false;
      return normalizedCedula && isDocumentEquivalent(executive.cedula, normalizedCedula);
    });

    if (duplicateExecutive) {
      return { errorCode: 'DUPLICATE_RECORD', message: DUPLICATE_EXECUTIVE_CEDULA_MESSAGE };
    }

    if (duplicateUser) {
      return { errorCode: 'DUPLICATE_RECORD', message: DUPLICATE_USERNAME_MESSAGE };
    }

    const previousRecord = sanitizeExecutiveAdminRecord(currentExecutive, this.db.users[userIndex]);
    this.db.users[userIndex] = {
      ...this.db.users[userIndex],
      username: payload.username,
      fullName: payload.fullName,
      phone: payload.phone,
      whatsappPhone: payload.whatsappPhone || payload.phone,
      email: payload.email || null,
    };
    this.db.executives[executiveIndex] = {
      ...this.db.executives[executiveIndex],
      cedula: payload.cedula,
      fullName: payload.fullName,
      address: payload.address,
      phone: payload.phone,
      whatsappPhone: payload.whatsappPhone || payload.phone,
      email: payload.email || null,
      city: city.name,
      isActive: currentExecutive.isActive !== false,
    };

    const updatedRecord = sanitizeExecutiveAdminRecord(this.db.executives[executiveIndex], this.db.users[userIndex]);
    this.#recordAuditLog({
      actorUserId: payload.actorUserId,
      entityType: 'executive',
      entityId: normalizedExecutiveId,
      action: 'update',
      previousValues: previousRecord,
      newValues: updatedRecord,
    });
    this.save();

    return updatedRecord;
  }

  updateClient(clientId, payload) {
    const normalizedClientId = Number(clientId);
    const clientIndex = this.db.clients.findIndex((client) => Number(client.id) === normalizedClientId);
    if (clientIndex === -1) {
      return { errorCode: 'NOT_FOUND' };
    }

    const currentClient = this.db.clients[clientIndex];
    const userIndex = this.db.users.findIndex((user) => Number(user.id) === Number(currentClient.userId));
    if (userIndex === -1) {
      return { errorCode: 'NOT_FOUND' };
    }

    const normalizedPayload = normalizeClientMutationPayload(payload);
    const duplicateUser = this.db.users.find((user) => matchesClientIdentityConflict({
      user,
      normalizedPayload,
      excludeUserId: currentClient.userId,
    }));
    const duplicateClient = this.db.clients.find((client) => matchesClientIdentityConflict({
      client,
      normalizedPayload,
      excludeClientId: normalizedClientId,
    }));
    const duplicateNitClient = normalizedPayload.nit
      ? this.getAdminClients().find((client) => Number(client.clientId) !== normalizedClientId && isNitEquivalent(client.nit, normalizedPayload.nit)) || null
      : null;

    if (duplicateNitClient || duplicateClient) {
      return { errorCode: 'DUPLICATE_RECORD', message: DUPLICATE_CLIENT_NIT_MESSAGE };
    }

    if (duplicateUser) {
      return { errorCode: 'DUPLICATE_RECORD', message: DUPLICATE_USERNAME_MESSAGE };
    }

    const previousRecord = sanitizeClientRecord({ client: currentClient, user: this.db.users[userIndex] });

    this.db.users[userIndex] = {
      ...this.db.users[userIndex],
      username: payload.username,
      fullName: payload.contactFullName,
      phone: payload.phone,
      whatsappPhone: payload.whatsappPhone || payload.phone,
      email: payload.email || null,
    };

    this.db.clients[clientIndex] = {
      ...this.db.clients[clientIndex],
      razonSocial: payload.razonSocial,
      nit: payload.nit,
      contactFullName: payload.contactFullName,
      contactRole: payload.contactRole,
      phone: payload.phone,
      whatsappPhone: payload.whatsappPhone || payload.phone,
      email: payload.email || null,
      isActive: currentClient.isActive !== false,
    };

    const updatedRecord = sanitizeClientRecord({ client: this.db.clients[clientIndex], user: this.db.users[userIndex] });
    this.#recordAuditLog({
      actorUserId: payload.actorUserId,
      entityType: 'client',
      entityId: this.db.clients[clientIndex].id,
      action: 'update',
      previousValues: previousRecord,
      newValues: updatedRecord,
    });
    this.save();

    return updatedRecord;
  }

  createCoordinator(payload) {
    const city = this.findCityByName(payload.city);
    if (!city) {
      return { errorCode: 'INVALID_REFERENCE', message: 'La ciudad seleccionada no existe.' };
    }

    const cedula = String(payload.cedula || '').trim();

    const duplicateUser = hasDuplicateUsername({ users: this.db.users, username: payload.username });
    const duplicateCedulaCoordinator = cedula ? this.findAdminCoordinatorByCedula(cedula) : null;

    if (duplicateCedulaCoordinator) {
      return { errorCode: 'DUPLICATE_RECORD', message: DUPLICATE_COORDINATOR_CEDULA_MESSAGE };
    }

    if (duplicateUser) {
      return { errorCode: 'DUPLICATE_RECORD', message: DUPLICATE_USERNAME_MESSAGE };
    }

    const newUser = {
      id: this.#nextId(this.db.users),
      username: payload.username,
      password: payload.password,
      fullName: payload.fullName,
      phone: payload.phone,
      whatsappPhone: payload.whatsappPhone || payload.phone,
      email: payload.email || null,
      role: 'COORDINADOR',
      isActive: true,
    };
    const newCoordinator = normalizeCoordinator({
      id: this.#nextId(this.db.coordinators),
      userId: newUser.id,
      name: payload.fullName,
      cedula: payload.cedula,
      address: payload.address,
      phone: payload.phone,
      rating: 5,
      photo: payload.photo || DEFAULT_PROFILE_PHOTO,
      isActive: true,
      city: city.name,
    });

    this.db.users.push(newUser);
    this.db.coordinators.push(newCoordinator);
    const createdRecord = sanitizeCoordinatorAdminRecord({ coordinator: newCoordinator, user: newUser });
    this.#recordAuditLog({
      actorUserId: payload.actorUserId,
      entityType: 'coordinator',
      entityId: newCoordinator.id,
      action: 'create',
      previousValues: null,
      newValues: createdRecord,
    });
    this.save();

    return createdRecord;
  }

  updateCoordinator(coordinatorId, payload) {
    const normalizedCoordinatorId = Number(coordinatorId);
    const coordinatorIndex = this.db.coordinators.findIndex((coordinator) => Number(coordinator.id) === normalizedCoordinatorId);
    if (coordinatorIndex === -1) {
      return { errorCode: 'NOT_FOUND' };
    }

    const currentCoordinator = this.db.coordinators[coordinatorIndex];
    const city = this.findCityByName(payload.city);
    if (!city) {
      return { errorCode: 'INVALID_REFERENCE', message: 'La ciudad seleccionada no existe.' };
    }

    const linkedUser = currentCoordinator.userId ? this.findUserById(currentCoordinator.userId) : null;
    const normalizedCedula = String(payload.cedula || '').trim();

    const duplicateUser = linkedUser ? hasDuplicateUsername({
      users: this.db.users,
      username: payload.username || linkedUser.username,
      excludeUserId: linkedUser.id,
    }) : null;
    const duplicateCoordinator = this.db.coordinators.find((coordinator) => {
      if (Number(coordinator.id) === normalizedCoordinatorId) return false;
      return isDocumentEquivalent(coordinator.cedula, normalizedCedula);
    });

    if (duplicateCoordinator) {
      return { errorCode: 'DUPLICATE_RECORD', message: DUPLICATE_COORDINATOR_CEDULA_MESSAGE };
    }

    if (duplicateUser) {
      return { errorCode: 'DUPLICATE_RECORD', message: DUPLICATE_USERNAME_MESSAGE };
    }

    const previousRecord = sanitizeCoordinatorAdminRecord({ coordinator: currentCoordinator, user: linkedUser });

    if (linkedUser) {
      const userIndex = this.db.users.findIndex((user) => Number(user.id) === Number(linkedUser.id));
      if (userIndex !== -1) {
        this.db.users[userIndex] = {
          ...this.db.users[userIndex],
          username: payload.username || this.db.users[userIndex].username,
          fullName: payload.fullName,
          phone: payload.phone,
          whatsappPhone: payload.whatsappPhone || payload.phone,
          email: payload.email || null,
        };
      }
    }

    this.db.coordinators[coordinatorIndex] = normalizeCoordinator(payload.photo
      ? {
        ...currentCoordinator,
        name: payload.fullName,
        cedula: payload.cedula,
        address: payload.address,
        phone: payload.phone,
        photo: payload.photo,
        photoMetadata: null,
        isActive: currentCoordinator.isActive !== false,
        city: city.name,
      }
      : {
        ...currentCoordinator,
        name: payload.fullName,
        cedula: payload.cedula,
        address: payload.address,
        phone: payload.phone,
        isActive: currentCoordinator.isActive !== false,
        city: city.name,
      });

    const updatedRecord = sanitizeCoordinatorAdminRecord({
      coordinator: this.db.coordinators[coordinatorIndex],
      user: currentCoordinator.userId ? this.findUserById(currentCoordinator.userId) : null,
    });
    this.#recordAuditLog({
      actorUserId: payload.actorUserId,
      entityType: 'coordinator',
      entityId: normalizedCoordinatorId,
      action: 'update',
      previousValues: previousRecord,
      newValues: updatedRecord,
    });
    this.save();

    return updatedRecord;
  }

  createStaff(payload) {
    const city = this.findCityByName(payload.city);
    if (!city) {
      return { errorCode: 'INVALID_REFERENCE', message: 'La ciudad seleccionada no existe.' };
    }

    const cedula = String(payload.cedula || '').trim();
    const duplicateCedulaStaff = cedula ? this.findAdminStaffByCedula(cedula) : null;

    if (duplicateCedulaStaff) {
      return { errorCode: 'DUPLICATE_RECORD', message: DUPLICATE_STAFF_CEDULA_MESSAGE };
    }

    const categoryRecord = this.#ensureStaffCategory(payload.category);
    const sizes = resolveStaffSizeFields(payload);
    const newStaffMember = normalizeStaffMember({
      id: this.#nextId(this.db.staff),
      name: payload.fullName,
      cedula: payload.cedula,
      city: city.name,
      category: categoryRecord.name,
      sexo: payload.sexo,
      photo: payload.photo || DEFAULT_PROFILE_PHOTO,
      isActive: true,
      shirtSize: sizes.shirtSize,
      pantsSize: sizes.pantsSize,
      clothingSize: sizes.clothingSize,
      shoeSize: payload.shoeSize || null,
      altura: payload.altura || null,
      measurements: serializeStaffMeasurements(payload),
    });

    this.db.staff.push(newStaffMember);
    const createdRecord = sanitizeStaffAdminRecord(newStaffMember);
    this.#recordAuditLog({
      actorUserId: payload.actorUserId,
      entityType: 'staff',
      entityId: newStaffMember.id,
      action: 'create',
      previousValues: null,
      newValues: createdRecord,
    });
    this.save();
    return createdRecord;
  }

  updateStaff(staffId, payload) {
    const normalizedStaffId = Number(staffId);
    const staffIndex = this.db.staff.findIndex((staffMember) => Number(staffMember.id) === normalizedStaffId);
    if (staffIndex === -1) {
      return { errorCode: 'NOT_FOUND' };
    }

    const city = this.findCityByName(payload.city);
    if (!city) {
      return { errorCode: 'INVALID_REFERENCE', message: 'La ciudad seleccionada no existe.' };
    }

    const normalizedCedula = String(payload.cedula || '').trim();
    const duplicateStaff = this.db.staff.find((staffMember) => {
      if (Number(staffMember.id) === normalizedStaffId) return false;
      return isDocumentEquivalent(staffMember.cedula, normalizedCedula);
    });

    if (duplicateStaff) {
      return { errorCode: 'DUPLICATE_RECORD', message: DUPLICATE_STAFF_CEDULA_MESSAGE };
    }

    const previousRecord = sanitizeStaffAdminRecord(this.db.staff[staffIndex]);
    const categoryRecord = this.#ensureStaffCategory(payload.category);
    const sizes = resolveStaffSizeFields(payload);
    this.db.staff[staffIndex] = normalizeStaffMember(payload.photo
      ? {
        ...this.db.staff[staffIndex],
        name: payload.fullName,
        cedula: payload.cedula,
        city: city.name,
        category: categoryRecord.name,
        sexo: payload.sexo,
        photo: payload.photo,
        photoMetadata: null,
        isActive: this.db.staff[staffIndex].isActive !== false,
        shirtSize: sizes.shirtSize,
        pantsSize: sizes.pantsSize,
        clothingSize: sizes.clothingSize,
        shoeSize: payload.shoeSize || null,
        altura: payload.altura || null,
        measurements: serializeStaffMeasurements(payload),
      }
      : {
        ...this.db.staff[staffIndex],
        name: payload.fullName,
        cedula: payload.cedula,
        city: city.name,
        category: categoryRecord.name,
        sexo: payload.sexo,
        isActive: this.db.staff[staffIndex].isActive !== false,
        shirtSize: sizes.shirtSize,
        pantsSize: sizes.pantsSize,
        clothingSize: sizes.clothingSize,
        shoeSize: payload.shoeSize || null,
        altura: payload.altura || null,
        measurements: serializeStaffMeasurements(payload),
      });

    const updatedRecord = sanitizeStaffAdminRecord(this.db.staff[staffIndex]);
    this.#recordAuditLog({
      actorUserId: payload.actorUserId,
      entityType: 'staff',
      entityId: normalizedStaffId,
      action: 'update',
      previousValues: previousRecord,
      newValues: updatedRecord,
    });
    this.save();

    return updatedRecord;
  }

  getCities() {
    return this.db.cities
      .map(normalizeCity)
      .sort((left, right) => Number(left.isOther) - Number(right.isOther) || left.name.localeCompare(right.name, 'es'));
  }

  findCityByName(name) {
    const city = this.db.cities.find((item) => item.name.toLowerCase() === name.toLowerCase()) || null;

    return city ? normalizeCity(city) : null;
  }

  createCity(name) {
    const newCity = normalizeCity({ id: Date.now(), name, isOther: false });
    const otherCityIndex = this.db.cities.findIndex((city) => normalizeCity(city).isOther);

    if (otherCityIndex === -1) {
      this.db.cities.push(newCity);
    } else {
      this.db.cities.splice(otherCityIndex, 0, newCity);
    }

    this.save();
    return newCity;
  }

  getEvents({ createdByUserId } = {}) {
    const normalizedUserId = Number(createdByUserId);
    const clients = this.getClients();
    const events = this.db.events.map((event) => normalizeEvent(event, clients)).map(enrichEventLifecycle);

    if (Number.isInteger(normalizedUserId) && normalizedUserId > 0) {
      return events.filter((event) => Number(event.createdByUserId) === normalizedUserId);
    }

    return events;
  }

  getClientEvents({ userId }) {
    const normalizedUserId = Number(userId);

    if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
      return [];
    }

    const clientProfile = this.db.clients.find((client) => Number(client.userId) === normalizedUserId && client.isActive !== false) || null;

    return this.getEvents()
      .filter((event) => Number(event.clientUserId) === normalizedUserId || (clientProfile && Number(event.clientId) === Number(clientProfile.id)))
      .map((event) => sanitizeEventForClient({
        event,
        executiveContact: normalizeExecutiveContact(this.findUserById(event.createdByUserId)),
      }));
  }

  createEvent(eventData) {
    const clients = this.getClients();
    const matchedClient = clients.find((client) => Number(client.userId || client.id) === Number(eventData.clientUserId))
      || clients.find((client) => Number(client.clientId) === Number(eventData.clientId))
      || null;
    const newEvent = normalizeEvent({
      id: Date.now(),
      ...eventData,
      clientId: Number(eventData.clientId) || matchedClient?.clientId || null,
      clientUserId: Number(eventData.clientUserId) || matchedClient?.userId || null,
      status: 'Pendiente',
      reports: [],
      photos: [],
      executiveReport: null,
    }, clients);

    this.db.events.push(newEvent);
    this.save();
    return enrichEventLifecycle(newEvent);
  }

  updateEvent(id, eventData) {
    const eventIndex = this.db.events.findIndex((event) => event.id == id);
    if (eventIndex === -1) {
      return null;
    }

    this.db.events[eventIndex] = normalizeEvent(typeof eventData.image === 'object' && eventData.image
      ? {
        ...this.db.events[eventIndex],
        ...eventData,
        imageMetadata: null,
        manualInactivatedAt: null,
        manualInactivationComment: null,
        manualInactivatedByUserId: null,
      }
      : {
        ...this.db.events[eventIndex],
        ...eventData,
        manualInactivatedAt: null,
        manualInactivationComment: null,
        manualInactivatedByUserId: null,
      }, this.getClients());
    this.save();
    return enrichEventLifecycle(this.db.events[eventIndex]);
  }

  getEventById(id) {
    const event = this.db.events.find((item) => Number(item.id) === Number(id));
    return event ? enrichEventLifecycle(normalizeEvent(event, this.getClients())) : null;
  }

  inactivateEvent(id, { createdByUserId, comment }) {
    const eventIndex = this.db.events.findIndex((event) => event.id == id);
    if (eventIndex === -1) {
      return null;
    }

    this.db.events[eventIndex] = normalizeEvent({
      ...this.db.events[eventIndex],
      manualInactivatedAt: new Date().toISOString(),
      manualInactivationComment: comment,
      manualInactivatedByUserId: createdByUserId,
    }, this.getClients());

    this.save();
    return enrichEventLifecycle(normalizeEvent(this.db.events[eventIndex], this.getClients()));
  }

  inactivateClient(clientId, { actorUserId }) {
    const normalizedClientId = Number(clientId);
    const clientIndex = this.db.clients.findIndex((client) => Number(client.id) === normalizedClientId);
    if (clientIndex === -1) {
      return { errorCode: 'NOT_FOUND' };
    }

    const currentClient = this.db.clients[clientIndex];
    const userIndex = this.db.users.findIndex((user) => Number(user.id) === Number(currentClient.userId));
    if (userIndex === -1) {
      return { errorCode: 'NOT_FOUND' };
    }

    const previousRecord = sanitizeClientRecord({ client: currentClient, user: this.db.users[userIndex] });

    this.db.users[userIndex] = {
      ...this.db.users[userIndex],
      isActive: false,
    };
    this.db.clients[clientIndex] = {
      ...this.db.clients[clientIndex],
      isActive: false,
    };

    const updatedRecord = sanitizeClientRecord({ client: this.db.clients[clientIndex], user: this.db.users[userIndex] });
    this.#recordAuditLog({
      actorUserId,
      entityType: 'client',
      entityId: normalizedClientId,
      action: 'inactivate',
      previousValues: previousRecord,
      newValues: updatedRecord,
    });
    this.save();

    return updatedRecord;
  }

  inactivateExecutive(executiveId, { actorUserId }) {
    const normalizedExecutiveId = Number(executiveId);
    const executiveIndex = this.db.executives.findIndex((executive) => Number(executive.id) === normalizedExecutiveId);
    if (executiveIndex === -1) {
      return { errorCode: 'NOT_FOUND' };
    }

    const currentExecutive = this.db.executives[executiveIndex];
    const userIndex = this.db.users.findIndex((user) => Number(user.id) === Number(currentExecutive.userId) && String(user.role || '').toUpperCase() === 'EJECUTIVO');
    if (userIndex === -1) {
      return { errorCode: 'NOT_FOUND' };
    }

    const previousRecord = sanitizeExecutiveAdminRecord(currentExecutive, this.db.users[userIndex]);
    this.db.users[userIndex] = {
      ...this.db.users[userIndex],
      isActive: false,
    };
    this.db.executives[executiveIndex] = {
      ...this.db.executives[executiveIndex],
      isActive: false,
    };

    const updatedRecord = sanitizeExecutiveAdminRecord(this.db.executives[executiveIndex], this.db.users[userIndex]);
    this.#recordAuditLog({
      actorUserId,
      entityType: 'executive',
      entityId: normalizedExecutiveId,
      action: 'inactivate',
      previousValues: previousRecord,
      newValues: updatedRecord,
    });
    this.save();

    return updatedRecord;
  }

  inactivateCoordinator(coordinatorId, { actorUserId }) {
    const normalizedCoordinatorId = Number(coordinatorId);
    const coordinatorIndex = this.db.coordinators.findIndex((coordinator) => Number(coordinator.id) === normalizedCoordinatorId);
    if (coordinatorIndex === -1) {
      return { errorCode: 'NOT_FOUND' };
    }

    const currentCoordinator = this.db.coordinators[coordinatorIndex];
    const linkedUser = currentCoordinator.userId ? this.findUserById(currentCoordinator.userId) : null;
    const previousRecord = sanitizeCoordinatorAdminRecord({ coordinator: currentCoordinator, user: linkedUser });

    if (linkedUser) {
      const userIndex = this.db.users.findIndex((user) => Number(user.id) === Number(linkedUser.id));
      if (userIndex !== -1) {
        this.db.users[userIndex] = {
          ...this.db.users[userIndex],
          isActive: false,
        };
      }
    }

    this.db.coordinators[coordinatorIndex] = normalizeCoordinator({
      ...this.db.coordinators[coordinatorIndex],
      isActive: false,
    });

    const updatedRecord = sanitizeCoordinatorAdminRecord({
      coordinator: this.db.coordinators[coordinatorIndex],
      user: currentCoordinator.userId ? this.findUserById(currentCoordinator.userId) : null,
    });
    this.#recordAuditLog({
      actorUserId,
      entityType: 'coordinator',
      entityId: normalizedCoordinatorId,
      action: 'inactivate',
      previousValues: previousRecord,
      newValues: updatedRecord,
    });
    this.save();

    return updatedRecord;
  }

  inactivateStaff(staffId, { actorUserId }) {
    const normalizedStaffId = Number(staffId);
    const staffIndex = this.db.staff.findIndex((staffMember) => Number(staffMember.id) === normalizedStaffId);
    if (staffIndex === -1) {
      return { errorCode: 'NOT_FOUND' };
    }

    const previousRecord = sanitizeStaffAdminRecord(this.db.staff[staffIndex]);
    this.db.staff[staffIndex] = normalizeStaffMember({
      ...this.db.staff[staffIndex],
      isActive: false,
    });

    const updatedRecord = sanitizeStaffAdminRecord(this.db.staff[staffIndex]);
    this.#recordAuditLog({
      actorUserId,
      entityType: 'staff',
      entityId: normalizedStaffId,
      action: 'inactivate',
      previousValues: previousRecord,
      newValues: updatedRecord,
    });
    this.save();

    return updatedRecord;
  }

  addCoordinatorPhoto(id, { authorUserId, uri, mimeType, fileSize, fileName }) {
    const eventIndex = this.db.events.findIndex((event) => Number(event.id) === Number(id));
    if (eventIndex === -1) {
      return null;
    }

    const coordinatorProfile = this.findCoordinatorProfileByUserId(authorUserId);
    if (!coordinatorProfile) {
      return false;
    }

    const event = normalizeEvent(this.db.events[eventIndex], this.getClients());
    const isAssigned = mapCoordinatorEvent({
      event,
      coordinatorProfile,
      executiveContact: normalizeExecutiveContact(this.findUserById(event.createdByUserId)),
    });

    if (!isAssigned) {
      return false;
    }

    const photo = buildCoordinatorPhoto({
      uri,
      mimeType,
      fileSize,
      fileName,
      coordinatorProfile,
      user: this.findUserById(authorUserId),
    });

    this.db.events[eventIndex] = normalizeEvent({
      ...event,
      photos: [...event.photos.map(normalizePhotoEntry).filter(Boolean), photo],
    }, this.getClients());

    this.save();
    return mapCoordinatorEvent({
      event: enrichEventLifecycle(normalizeEvent(this.db.events[eventIndex], this.getClients())),
      coordinatorProfile,
      executiveContact: normalizeExecutiveContact(this.findUserById(event.createdByUserId)),
    });
  }

  addCoordinatorReport(id, payload) {
    const eventIndex = this.db.events.findIndex((event) => Number(event.id) === Number(id));
    if (eventIndex === -1) {
      return null;
    }

    const coordinatorProfile = this.findCoordinatorProfileByUserId(payload.authorUserId);
    if (!coordinatorProfile) {
      return false;
    }

    const event = normalizeEvent(this.db.events[eventIndex], this.getClients());
    const coordinatorEvent = mapCoordinatorEvent({
      event,
      coordinatorProfile,
      executiveContact: normalizeExecutiveContact(this.findUserById(event.createdByUserId)),
    });

    if (!coordinatorEvent) {
      return false;
    }

    const reportTimeError = validateCoordinatorReportTimeRange({ event: coordinatorEvent, startTime: payload.startTime, endTime: payload.endTime });
    if (reportTimeError) {
      return { errorCode: 'INVALID_REPORT_TIME_RANGE', message: reportTimeError };
    }

    const report = buildCoordinatorReport({
      payload,
      coordinatorProfile,
      user: this.findUserById(payload.authorUserId),
    });

    this.db.events[eventIndex] = normalizeEvent({
      ...event,
      reports: [...event.reports.map(normalizeReportEntry).filter(Boolean), report],
    }, this.getClients());

    this.save();
    return mapCoordinatorEvent({
      event: enrichEventLifecycle(normalizeEvent(this.db.events[eventIndex], this.getClients())),
      coordinatorProfile,
      executiveContact: normalizeExecutiveContact(this.findUserById(event.createdByUserId)),
    });
  }

  saveExecutiveReport(id, payload) {
    const eventIndex = this.db.events.findIndex((event) => Number(event.id) === Number(id));
    if (eventIndex === -1) {
      return null;
    }

    const event = normalizeEvent(this.db.events[eventIndex], this.getClients());
    if (Number(event.createdByUserId) !== Number(payload.authorUserId)) {
      return false;
    }

    if (event.executiveReport?.status === 'published') {
      return { errorCode: 'EXECUTIVE_REPORT_LOCKED' };
    }

    const user = this.findUserById(payload.authorUserId);
    const executiveReport = buildExecutiveReport({
      payload,
      user,
      existingReport: event.executiveReport,
      event,
    });

    this.db.events[eventIndex] = normalizeEvent({
      ...event,
      executiveReport,
    }, this.getClients());

    this.save();
    return enrichEventLifecycle(normalizeEvent(this.db.events[eventIndex], this.getClients()));
  }

  #nextId(collection) {
    return collection.reduce((maxValue, item) => Math.max(maxValue, Number(item.id) || 0), 0) + 1;
  }

  #recordAuditLog({ actorUserId, entityType, entityId, action, previousValues, newValues }) {
    this.db.auditLogs.unshift(sanitizeAuditLogRecord({
      auditLog: {
        id: this.#nextId(this.db.auditLogs),
        actorUserId: Number(actorUserId) || null,
        entityType,
        entityId,
        action,
        previousValues: cloneAuditPayload(previousValues),
        newValues: cloneAuditPayload(newValues),
        timestamp: new Date().toISOString(),
      },
      actor: actorUserId ? this.findUserById(actorUserId) : null,
    }));
  }

  #ensureStaffCategory(name) {
    const normalizedName = normalizeStaffCategoryName(name);
    const existingCategory = this.findStaffCategoryByName(normalizedName);

    if (existingCategory) {
      return existingCategory;
    }

    const newCategory = sanitizeStaffCategoryRecord({
      id: this.#nextId(this.db.staffCategories),
      name: normalizedName,
      createdAt: new Date().toISOString(),
    });

    this.db.staffCategories.push(newCategory);
    this.db.staffCategories.sort((left, right) => left.name.localeCompare(right.name, 'es'));

    return newCategory;
  }
}

module.exports = { EventAppRepository };
