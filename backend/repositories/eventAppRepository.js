const fs = require('fs');
const { mapCoordinatorEvent, normalizeExecutiveContact } = require('../utils/coordinatorEvents');
const { buildCoordinatorPhoto, buildCoordinatorReport, normalizePhotoEntry, normalizeReportEntry } = require('../utils/eventAssets');
const { buildExecutiveReport, normalizeExecutiveReportEntry, sanitizeEventForClient } = require('../utils/executiveReports');
const { enrichEventLifecycle } = require('../utils/eventLifecycle');

const DEFAULT_EXECUTIVE_USER_ID = 2;

const clone = (value) => JSON.parse(JSON.stringify(value));

const normalizeComparableValue = (value) => String(value || '').trim().toLowerCase();

const resolveClientUserId = ({ rawClientUserId, client, clients }) => {
  const normalizedRawClientUserId = Number(rawClientUserId);
  if (Number.isInteger(normalizedRawClientUserId) && normalizedRawClientUserId > 0) {
    const explicitClient = clients.find((candidate) => Number(candidate.id) === normalizedRawClientUserId) || null;
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
    candidate.username,
    candidate.email,
  ].some((value) => normalizeComparableValue(value) === comparableClient));

  return matches.length === 1 ? Number(matches[0].id) : null;
};

const normalizeCity = (city) => ({
  id: city.id,
  name: city.name,
  isOther: Boolean(city.isOther || String(city.name || '').toUpperCase() === 'OTRO'),
});

const normalizeEvent = (event, clients = []) => ({
  ...event,
  createdByUserId: Number(event.createdByUserId || event.created_by_user_id || DEFAULT_EXECUTIVE_USER_ID),
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
});

const normalizeCoordinator = (coordinator) => ({
  ...coordinator,
  userId: Number(coordinator.userId || coordinator.user_id || 0) || null,
});

const normalizeDb = (db, initialDb) => ({
  ...clone(initialDb),
  ...db,
  users: Array.isArray(db?.users) && db.users.length > 0 ? db.users : clone(initialDb.users),
  coordinators: Array.isArray(db?.coordinators) && db.coordinators.length > 0 ? db.coordinators.map(normalizeCoordinator) : clone(initialDb.coordinators).map(normalizeCoordinator),
  cities: Array.isArray(db?.cities) && db.cities.length > 0 ? db.cities.map(normalizeCity) : clone(initialDb.cities),
  events: Array.isArray(db?.events) ? db.events : [],
});

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

    if (!user || user.password !== password) {
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

  getClients() {
    return this.db.users
      .filter((user) => String(user.role || '').toUpperCase() === 'CLIENTE' && user.isActive !== false)
      .map((user) => ({
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        phone: user.phone || null,
        whatsappPhone: user.whatsappPhone || user.whatsapp_phone || null,
        email: user.email || null,
        role: user.role,
      }))
      .sort((left, right) => String(left.fullName || '').localeCompare(String(right.fullName || ''), 'es'));
  }

  findCoordinatorProfileByUserId(userId) {
    const normalizedUserId = Number(userId);

    if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
      return null;
    }

    return this.db.coordinators.find((coordinator) => Number(coordinator.userId) === normalizedUserId)
      || this.db.coordinators.find((coordinator) => Number(coordinator.id) === normalizedUserId)
      || null;
  }

  getCoordinators({ city } = {}) {
    if (!city) {
      return this.db.coordinators;
    }

    return this.db.coordinators.filter((coordinator) => coordinator.city.toLowerCase() === city.toLowerCase());
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
    let result = this.db.staff;

    if (city) {
      result = result.filter((staffMember) => staffMember.city.toLowerCase() === city.toLowerCase());
    }

    if (category) {
      result = result.filter((staffMember) => staffMember.category.toUpperCase() === category.toUpperCase());
    }

    return result;
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

    return this.getEvents()
      .filter((event) => Number(event.clientUserId) === normalizedUserId)
      .map((event) => sanitizeEventForClient({
        event,
        executiveContact: normalizeExecutiveContact(this.findUserById(event.createdByUserId)),
      }));
  }

  createEvent(eventData) {
    const clients = this.getClients();
    const newEvent = normalizeEvent({
      id: Date.now(),
      ...eventData,
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

    this.db.events[eventIndex] = normalizeEvent({
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
    const isAssigned = mapCoordinatorEvent({
      event,
      coordinatorProfile,
      executiveContact: normalizeExecutiveContact(this.findUserById(event.createdByUserId)),
    });

    if (!isAssigned) {
      return false;
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
}

module.exports = { EventAppRepository };
