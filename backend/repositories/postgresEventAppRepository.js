const { pool, query } = require('../db/postgres/pool');
const { enrichEventLifecycle } = require('../utils/eventLifecycle');
const { normalizeString } = require('../utils/validation');
const { verifyPassword } = require('../utils/passwords');

const mapEventRow = (row) => ({
  id: row.id,
  name: row.name,
  client: row.client,
  image: row.image,
  startDate: row.start_date instanceof Date ? row.start_date.toISOString() : row.start_date,
  endDate: row.end_date instanceof Date ? row.end_date.toISOString() : row.end_date,
  createdByUserId: row.created_by_user_id,
  status: row.status,
  reports: Array.isArray(row.reports) ? row.reports : [],
  photos: Array.isArray(row.photos) ? row.photos : [],
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
        SELECT u.id, u.username, u.full_name, u.password_hash, r.code AS role
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
      role: user.role,
    };
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
        SELECT e.id, e.name, e.client, e.image, e.start_date, e.end_date, e.status, e.reports, e.photos, e.created_by_user_id,
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

  async createEvent(eventData) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

        const eventResult = await client.query(
          `
          INSERT INTO events (name, client, image, start_date, end_date, status, reports, photos, created_by_user_id)
          VALUES ($1, $2, $3, $4, $5, 'Pendiente', '[]'::jsonb, '[]'::jsonb, $6)
          RETURNING id
        `,
        [eventData.name, eventData.client, eventData.image, eventData.startDate, eventData.endDate, eventData.createdByUserId],
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
              image = $4,
              start_date = $5,
              end_date = $6,
              created_by_user_id = COALESCE(created_by_user_id, $7),
              manual_inactivated_at = NULL,
              manual_inactivation_comment = NULL,
              manual_inactivated_by_user_id = NULL,
              updated_at = NOW()
          WHERE id = $1
          RETURNING id
        `,
        [id, eventData.name, eventData.client, eventData.image, eventData.startDate, eventData.endDate, eventData.createdByUserId],
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
        SELECT e.id, e.name, e.client, e.image, e.start_date, e.end_date, e.status, e.reports, e.photos, e.created_by_user_id,
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
