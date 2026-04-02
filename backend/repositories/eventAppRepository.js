const fs = require('fs');
const { enrichEventLifecycle } = require('../utils/eventLifecycle');

const DEFAULT_EXECUTIVE_USER_ID = 2;

const clone = (value) => JSON.parse(JSON.stringify(value));

const normalizeCity = (city) => ({
  id: city.id,
  name: city.name,
  isOther: Boolean(city.isOther || String(city.name || '').toUpperCase() === 'OTRO'),
});

const normalizeEvent = (event) => ({
  ...event,
  createdByUserId: Number(event.createdByUserId || event.created_by_user_id || DEFAULT_EXECUTIVE_USER_ID),
  cities: Array.isArray(event.cities)
    ? event.cities.map((city) => ({
      ...city,
      points: Array.isArray(city.points) ? city.points : [],
    }))
    : [],
  reports: Array.isArray(event.reports) ? event.reports : [],
  photos: Array.isArray(event.photos) ? event.photos : [],
  manualInactivatedAt: event.manualInactivatedAt || event.manual_inactivated_at || null,
  manualInactivationComment: event.manualInactivationComment || event.manual_inactivation_comment || null,
  manualInactivatedByUserId: Number(event.manualInactivatedByUserId || event.manual_inactivated_by_user_id || 0) || null,
});

const normalizeDb = (db, initialDb) => ({
  ...clone(initialDb),
  ...db,
  users: Array.isArray(db?.users) && db.users.length > 0 ? db.users : clone(initialDb.users),
  cities: Array.isArray(db?.cities) && db.cities.length > 0 ? db.cities.map(normalizeCity) : clone(initialDb.cities),
  events: Array.isArray(db?.events) ? db.events.map(normalizeEvent) : [],
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
      role: user.role,
    };
  }

  getCoordinators({ city } = {}) {
    if (!city) {
      return this.db.coordinators;
    }

    return this.db.coordinators.filter((coordinator) => coordinator.city.toLowerCase() === city.toLowerCase());
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
    const events = this.db.events.map(normalizeEvent).map(enrichEventLifecycle);

    if (Number.isInteger(normalizedUserId) && normalizedUserId > 0) {
      return events.filter((event) => Number(event.createdByUserId) === normalizedUserId);
    }

    return events;
  }

  createEvent(eventData) {
    const newEvent = normalizeEvent({
      id: Date.now(),
      ...eventData,
      status: 'Pendiente',
      reports: [],
      photos: [],
    });

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
    });
    this.save();
    return enrichEventLifecycle(this.db.events[eventIndex]);
  }

  getEventById(id) {
    const event = this.db.events.find((item) => Number(item.id) === Number(id));
    return event ? enrichEventLifecycle(normalizeEvent(event)) : null;
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
    });

    this.save();
    return enrichEventLifecycle(this.db.events[eventIndex]);
  }
}

module.exports = { EventAppRepository };
