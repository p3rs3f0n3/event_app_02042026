const { pool, query } = require('../db/postgres/pool');
const { mapCoordinatorEvent, normalizeExecutiveContact } = require('../utils/coordinatorEvents');
const { buildCoordinatorPhoto, buildCoordinatorReport, normalizePhotoEntry, normalizeReportEntry } = require('../utils/eventAssets');
const { buildExecutiveReport, normalizeExecutiveReportEntry, sanitizeEventForClient } = require('../utils/executiveReports');
const { enrichEventLifecycle } = require('../utils/eventLifecycle');
const { normalizeString } = require('../utils/validation');
const { verifyPassword } = require('../utils/passwords');

const DEFAULT_CLIENT_USER_ID = 4;

const mapEventRow = (row) => ({
  id: row.id,
  name: row.name,
  client: row.client,
  clientUserId: Number(row.client_user_id || DEFAULT_CLIENT_USER_ID),
  image: row.image,
  startDate: row.start_date instanceof Date ? row.start_date.toISOString() : row.start_date,
  endDate: row.end_date instanceof Date ? row.end_date.toISOString() : row.end_date,
  createdByUserId: row.created_by_user_id,
  status: row.status,
  reports: Array.isArray(row.reports) ? row.reports.map(normalizeReportEntry).filter(Boolean) : [],
  photos: Array.isArray(row.photos) ? row.photos.map(normalizePhotoEntry).filter(Boolean) : [],
  executiveReport: normalizeExecutiveReportEntry(row.executive_report),
  cities: Array.isArray(row.cities) ? row.cities : [],
  manualInactivatedAt: row.manual_inactivated_at instanceof Date ? row.manual_inactivated_at.toISOString() : row.manual_inactivated_at,
  manualInactivationComment: row.manual_inactivation_comment,
  manualInactivatedByUserId: row.manual_inactivated_by_user_id,
});

class PostgresEventAppRepository {
  async ping() {
    await query('SELECT 1');
  }

  async authenticateUser({ username, password }) {
    const result = await query(
      `
        SELECT u.id, u.username, u.full_name, u.phone, u.whatsapp_phone, u.email, u.password_hash, r.code AS role
        FROM users u
        INNER JOIN roles r ON r.id = u.role_id
        WHERE LOWER(u.username) = LOWER($1) AND u.is_active = TRUE
        LIMIT 1
      `,
      [username],
    );

    const user = result.rows[0];
    if (!user || !verifyPassword(password, user.password_hash)) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      phone: user.phone || null,
      whatsappPhone: user.whatsapp_phone || null,
      email: user.email || null,
      role: user.role,
    };
  }

  async findUserById(id) {
    const result = await query(
      `
        SELECT id, username, full_name AS "fullName", phone, whatsapp_phone AS "whatsappPhone", email
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [Number(id)],
    );

    return result.rows[0] || null;
  }

  async findCoordinatorProfileByUserId(userId) {
    const normalizedUserId = Number(userId);

    if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
      return null;
    }

    const coordinatorResult = await query(
      `
        SELECT c.id, c.user_id AS "userId", c.full_name AS name, c.cedula, c.address, c.phone, c.rating, c.photo, ci.name AS city
        FROM coordinators c
        INNER JOIN cities ci ON ci.id = c.city_id
        WHERE c.user_id = $1 OR c.id = $1
        ORDER BY CASE WHEN c.user_id = $1 THEN 0 ELSE 1 END, c.id ASC
        LIMIT 1
      `,
      [normalizedUserId],
    );

    return coordinatorResult.rows[0] || null;
  }

  async getCoordinators({ city } = {}) {
    const result = await query(
      `
        SELECT c.id, c.full_name AS name, c.cedula, c.address, c.phone, c.rating, c.photo, ci.name AS city
        FROM coordinators c
        INNER JOIN cities ci ON ci.id = c.city_id
        WHERE ($1::text IS NULL OR LOWER(ci.name) = LOWER($1))
        ORDER BY c.full_name ASC
      `,
      [normalizeString(city) || null],
    );

    return result.rows;
  }

  async getCoordinatorEvents({ userId }) {
    const normalizedUserId = Number(userId);

    if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
      return [];
    }

    const coordinatorProfile = await this.findCoordinatorProfileByUserId(normalizedUserId);
    if (!coordinatorProfile) {
      return [];
    }

    const events = await this.getEvents();
    const executiveIds = [...new Set(events.map((event) => Number(event.createdByUserId)).filter((id) => Number.isInteger(id) && id > 0))];
    const executiveContactsById = new Map();

    if (executiveIds.length > 0) {
        const usersResult = await query(
          `
          SELECT id, username, full_name AS "fullName", phone, whatsapp_phone AS "whatsappPhone", email
          FROM users
          WHERE id = ANY($1::bigint[])
        `,
        [executiveIds],
      );

      usersResult.rows.forEach((row) => {
        executiveContactsById.set(Number(row.id), normalizeExecutiveContact(row));
      });
    }

    return events
      .map((event) => mapCoordinatorEvent({
        event,
        coordinatorProfile,
        executiveContact: executiveContactsById.get(Number(event.createdByUserId)) || null,
      }))
      .filter(Boolean);
  }

  async getStaff({ city, category } = {}) {
    const result = await query(
      `
        SELECT s.id, s.full_name AS name, s.cedula, ci.name AS city, s.category, s.photo,
               s.clothing_size AS "clothingSize", s.shoe_size AS "shoeSize", s.measurements
        FROM staff s
        INNER JOIN cities ci ON ci.id = s.city_id
        WHERE ($1::text IS NULL OR LOWER(ci.name) = LOWER($1))
          AND ($2::text IS NULL OR UPPER(s.category) = UPPER($2))
        ORDER BY s.full_name ASC
      `,
      [normalizeString(city) || null, normalizeString(category) || null],
    );

    return result.rows;
  }

  async getCities() {
    const result = await query(
      `
        SELECT id, name, is_other AS "isOther"
        FROM cities
        ORDER BY is_other ASC, name ASC
      `,
    );

    return result.rows;
  }

  async findCityByName(name) {
    const result = await query(
      'SELECT id, name, is_other AS "isOther" FROM cities WHERE LOWER(name) = LOWER($1) LIMIT 1',
      [name],
    );

    return result.rows[0] || null;
  }

  async createCity(name) {
    const result = await query(
      `
        INSERT INTO cities (name)
        VALUES ($1)
        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id, name, is_other AS "isOther"
      `,
      [name],
    );

    return result.rows[0];
  }

  async getEvents({ createdByUserId } = {}) {
    const result = await query(
      `
        SELECT e.id, e.name, e.client, e.client_user_id, e.image, e.start_date, e.end_date, e.status, e.reports, e.photos, e.executive_report, e.created_by_user_id,
               e.manual_inactivated_at, e.manual_inactivation_comment, e.manual_inactivated_by_user_id,
               COALESCE(
                  json_agg(
                    json_build_object(
                      'name', COALESCE(ci.name, ec.city_name),
                      'isOther', COALESCE(ci.is_other, FALSE),
                      'points', ec.points
                    )
                    ORDER BY ec.id
                 ) FILTER (WHERE ec.id IS NOT NULL),
                 '[]'::json
               ) AS cities
        FROM events e
        LEFT JOIN event_cities ec ON ec.event_id = e.id
        LEFT JOIN cities ci ON ci.id = ec.city_id
        WHERE ($1::bigint IS NULL OR e.created_by_user_id = $1)
        GROUP BY e.id
        ORDER BY e.start_date DESC, e.id DESC
      `,
      [Number.isInteger(Number(createdByUserId)) && Number(createdByUserId) > 0 ? Number(createdByUserId) : null],
    );

    return result.rows.map(mapEventRow).map(enrichEventLifecycle);
  }

  async getClientEvents({ userId }) {
    const normalizedUserId = Number(userId);

    if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
      return [];
    }

    const events = await this.getEvents();
    const executiveIds = [...new Set(events.map((event) => Number(event.createdByUserId)).filter((id) => Number.isInteger(id) && id > 0))];
    const executiveContactsById = new Map();

    if (executiveIds.length > 0) {
      const usersResult = await query(
        `
          SELECT id, username, full_name AS "fullName", phone, whatsapp_phone AS "whatsappPhone", email
          FROM users
          WHERE id = ANY($1::bigint[])
        `,
        [executiveIds],
      );

      usersResult.rows.forEach((row) => {
        executiveContactsById.set(Number(row.id), normalizeExecutiveContact(row));
      });
    }

    return events
      .filter((event) => Number(event.clientUserId) === normalizedUserId)
      .map((event) => sanitizeEventForClient({
        event,
        executiveContact: executiveContactsById.get(Number(event.createdByUserId)) || null,
      }));
  }

  async createEvent(eventData) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

        const eventResult = await client.query(
          `
          INSERT INTO events (name, client, client_user_id, image, start_date, end_date, status, reports, photos, executive_report, created_by_user_id)
          VALUES ($1, $2, $3, $4, $5, $6, 'Pendiente', '[]'::jsonb, '[]'::jsonb, NULL, $7)
          RETURNING id
        `,
        [eventData.name, eventData.client, Number(eventData.clientUserId || DEFAULT_CLIENT_USER_ID), eventData.image, eventData.startDate, eventData.endDate, eventData.createdByUserId],
      );

      const event = eventResult.rows[0];
      await this.#replaceEventCities(client, event.id, eventData.cities);

      await client.query('COMMIT');

      return this.#getEventById(event.id);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateEvent(id, eventData) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const eventResult = await client.query(
        `
          UPDATE events
          SET name = $2,
              client = $3,
              client_user_id = $4,
              image = $5,
              start_date = $6,
              end_date = $7,
              created_by_user_id = COALESCE(created_by_user_id, $8),
              manual_inactivated_at = NULL,
              manual_inactivation_comment = NULL,
              manual_inactivated_by_user_id = NULL,
              updated_at = NOW()
          WHERE id = $1
          RETURNING id
        `,
        [id, eventData.name, eventData.client, Number(eventData.clientUserId || DEFAULT_CLIENT_USER_ID), eventData.image, eventData.startDate, eventData.endDate, eventData.createdByUserId],
      );

      if (eventResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      await this.#replaceEventCities(client, Number(id), eventData.cities);
      await client.query('COMMIT');

      return this.#getEventById(Number(id));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getEventById(id) {
    return this.#getEventById(Number(id));
  }

  async inactivateEvent(id, { createdByUserId, comment }) {
    const result = await query(
      `
        UPDATE events
        SET manual_inactivated_at = NOW(),
            manual_inactivation_comment = $2,
            manual_inactivated_by_user_id = $3,
            updated_at = NOW()
        WHERE id = $1
        RETURNING id
      `,
      [Number(id), comment, createdByUserId],
    );

    if (result.rowCount === 0) {
      return null;
    }

    return this.#getEventById(Number(id));
  }

  async #getEventById(id) {
    const result = await query(
      `
        SELECT e.id, e.name, e.client, e.client_user_id, e.image, e.start_date, e.end_date, e.status, e.reports, e.photos, e.executive_report, e.created_by_user_id,
               e.manual_inactivated_at, e.manual_inactivation_comment, e.manual_inactivated_by_user_id,
               COALESCE(
                  json_agg(
                    json_build_object(
                      'name', COALESCE(ci.name, ec.city_name),
                      'isOther', COALESCE(ci.is_other, FALSE),
                      'points', ec.points
                    )
                    ORDER BY ec.id
                 ) FILTER (WHERE ec.id IS NOT NULL),
                 '[]'::json
               ) AS cities
        FROM events e
        LEFT JOIN event_cities ec ON ec.event_id = e.id
        LEFT JOIN cities ci ON ci.id = ec.city_id
        WHERE e.id = $1
        GROUP BY e.id
      `,
      [id],
    );

    return result.rows[0] ? enrichEventLifecycle(mapEventRow(result.rows[0])) : null;
  }

  async addCoordinatorPhoto(id, { authorUserId, uri, mimeType, fileSize, fileName }) {
    const event = await this.#getEventById(Number(id));
    if (!event) {
      return null;
    }

    const coordinatorProfile = await this.findCoordinatorProfileByUserId(authorUserId);
    if (!coordinatorProfile) {
      return false;
    }

    const executiveContact = normalizeExecutiveContact(await this.findUserById(event.createdByUserId));
    if (!mapCoordinatorEvent({ event, coordinatorProfile, executiveContact })) {
      return false;
    }

    const photo = buildCoordinatorPhoto({
      uri,
      mimeType,
      fileSize,
      fileName,
      coordinatorProfile,
      user: await this.findUserById(authorUserId),
    });

    await query(
      `
        UPDATE events
        SET photos = $2::jsonb,
            updated_at = NOW()
        WHERE id = $1
      `,
      [Number(id), JSON.stringify([...event.photos.map(normalizePhotoEntry).filter(Boolean), photo])],
    );

    return this.#getEventById(Number(id));
  }

  async saveExecutiveReport(id, payload) {
    const event = await this.#getEventById(Number(id));
    if (!event) {
      return null;
    }

    if (Number(event.createdByUserId) !== Number(payload.authorUserId)) {
      return false;
    }

    const user = await this.findUserById(payload.authorUserId);
    const executiveReport = buildExecutiveReport({
      payload,
      user,
      existingReport: event.executiveReport,
    });

    await query(
      `
        UPDATE events
        SET executive_report = $2::jsonb,
            updated_at = NOW()
        WHERE id = $1
      `,
      [Number(id), JSON.stringify(executiveReport)],
    );

    return this.#getEventById(Number(id));
  }

  async addCoordinatorReport(id, payload) {
    const event = await this.#getEventById(Number(id));
    if (!event) {
      return null;
    }

    const coordinatorProfile = await this.findCoordinatorProfileByUserId(payload.authorUserId);
    if (!coordinatorProfile) {
      return false;
    }

    const executiveContact = normalizeExecutiveContact(await this.findUserById(event.createdByUserId));
    if (!mapCoordinatorEvent({ event, coordinatorProfile, executiveContact })) {
      return false;
    }

    const report = buildCoordinatorReport({
      payload,
      coordinatorProfile,
      user: await this.findUserById(payload.authorUserId),
    });

    await query(
      `
        UPDATE events
        SET reports = $2::jsonb,
            updated_at = NOW()
        WHERE id = $1
      `,
      [Number(id), JSON.stringify([...event.reports.map(normalizeReportEntry).filter(Boolean), report])],
    );

    return this.#getEventById(Number(id));
  }

  async #replaceEventCities(client, eventId, cities) {
    await client.query('DELETE FROM event_cities WHERE event_id = $1', [eventId]);

    for (const city of cities) {
      const cityName = normalizeString(city.name);
      const cityLookup = cityName ? await client.query('SELECT id, name FROM cities WHERE LOWER(name) = LOWER($1) LIMIT 1', [cityName]) : { rows: [] };
      const cityRow = cityLookup.rows[0] || null;

      await client.query(
        `
          INSERT INTO event_cities (event_id, city_id, city_name, points)
          VALUES ($1, $2, $3, $4::jsonb)
        `,
        [eventId, cityRow?.id || null, cityRow?.name || cityName, JSON.stringify(city.points || [])],
      );
    }
  }
}

module.exports = { PostgresEventAppRepository };
