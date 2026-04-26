const { pool, query } = require('../db/postgres/pool');
const { mapCoordinatorEvent, normalizeExecutiveContact } = require('../utils/coordinatorEvents');
const { buildCoordinatorPhoto, buildCoordinatorReport, buildEventMilestonePhoto, normalizePhotoEntry, normalizeReportEntry, validateCoordinatorReportTimeRange } = require('../utils/eventAssets');
const { buildExecutiveReport, normalizeExecutiveReportEntry, sanitizeEventForClient } = require('../utils/executiveReports');
const { buildEventResponse } = require('../utils/eventResponse');
const { enrichEventLifecycle, getEventStatus, toLocalCalendarKey } = require('../utils/eventLifecycle');
const { cloneAuditPayload, sanitizeAuditLogRecord } = require('../utils/auditLogs');
const { normalizeString } = require('../utils/validation');
const { comparePassword, createPasswordHash } = require('../utils/passwords');
const { storeEventUploadFromBuffer } = require('../utils/eventUploads');
const {
  DEFAULT_PROFILE_PHOTO,
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
  serializePhotoAssetField,
  serializeProfilePhotoField,
  sanitizeUserRecord,
} = require('../utils/adminRecords');
const {
  isStaffCategoryMatch,
  normalizeStaffCategoryCode,
  normalizeStaffCategoryName,
  sanitizeStaffCategoryRecord,
} = require('../utils/staffCategories');
const { serializeStaffMeasurements } = require('../utils/staffMeasurements');

const DUPLICATE_USERNAME_MESSAGE = 'El nombre de usuario ya está en uso y debe ser único para iniciar sesión.';
const DUPLICATE_CLIENT_NIT_MESSAGE = 'Ya existe un cliente con ese NIT.';
const DUPLICATE_COORDINATOR_CEDULA_MESSAGE = 'Ya existe un coordinador con esa cédula.';
const DUPLICATE_EXECUTIVE_CEDULA_MESSAGE = 'Ya existe un ejecutivo con esa cédula.';
const DUPLICATE_STAFF_CEDULA_MESSAGE = 'Ya existe una persona de staff con esa cédula.';

const EVENT_SELECT_COLUMNS = `
  e.id, e.name, e.client, e.client_id, e.client_user_id, e.image,
  e.start_date, e.end_date, e.event_status, e.start_real_at, e.end_real_at,
  e.start_lat, e.start_lon, e.end_lat, e.end_lon, e.start_photo_url, e.end_photo_url,
  e.status, e.reports, e.photos, e.executive_report, e.created_by_user_id,
  e.manual_inactivated_at, e.manual_inactivation_comment, e.manual_inactivated_by_user_id
`;

const isPostgresUniqueViolation = (error) => error?.code === '23505';

const mapAdminUniqueViolation = (error) => {
  const constraint = String(error?.constraint || '').toLowerCase();

  if (constraint === 'users_username_key') {
    return { errorCode: 'DUPLICATE_RECORD', message: DUPLICATE_USERNAME_MESSAGE };
  }

  if (['clients_nit_key', 'idx_clients_nit_unique'].includes(constraint)) {
    return { errorCode: 'DUPLICATE_RECORD', message: DUPLICATE_CLIENT_NIT_MESSAGE };
  }

  if (['executives_cedula_key', 'idx_executives_cedula_unique'].includes(constraint)) {
    return { errorCode: 'DUPLICATE_RECORD', message: DUPLICATE_EXECUTIVE_CEDULA_MESSAGE };
  }

  if (constraint === 'coordinators_cedula_key') {
    return { errorCode: 'DUPLICATE_RECORD', message: DUPLICATE_COORDINATOR_CEDULA_MESSAGE };
  }

  if (constraint === 'staff_cedula_key') {
    return { errorCode: 'DUPLICATE_RECORD', message: DUPLICATE_STAFF_CEDULA_MESSAGE };
  }

  return null;
};

const hasDuplicateUsername = async ({ username, excludeUserId = null }) => {
  const normalizedUsername = String(username || '').trim();
  if (!normalizedUsername) {
    return false;
  }

  const result = await query(
    `
      SELECT id
      FROM users
      WHERE LOWER(username) = LOWER($1)
        AND ($2::bigint IS NULL OR id <> $2)
      LIMIT 1
    `,
    [normalizedUsername, excludeUserId ? Number(excludeUserId) : null],
  );

  return result.rowCount > 0;
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

const mapEventRow = (row, clients = []) => {
  const normalizedImage = normalizePhotoAssetField(row.image, { defaultUri: null });

  return {
    id: row.id,
    name: row.name,
    client: row.client,
    clientId: resolveClientId({ rawClientId: row.client_id, rawClientUserId: row.client_user_id, client: row.client, clients }),
    clientUserId: resolveClientUserId({ rawClientUserId: row.client_user_id, client: row.client, clients }),
    image: normalizedImage.uri,
    imageMetadata: normalizedImage.metadata,
    startDate: row.start_date instanceof Date ? row.start_date.toISOString() : row.start_date,
    endDate: row.end_date instanceof Date ? row.end_date.toISOString() : row.end_date,
    executiveId: row.created_by_user_id,
    createdByUserId: row.created_by_user_id,
    status: row.status,
    eventStatus: row.event_status,
    startRealAt: row.start_real_at instanceof Date ? row.start_real_at.toISOString() : row.start_real_at,
    endRealAt: row.end_real_at instanceof Date ? row.end_real_at.toISOString() : row.end_real_at,
    startLat: row.start_lat,
    startLon: row.start_lon,
    endLat: row.end_lat,
    endLon: row.end_lon,
    startPhotoUrl: row.start_photo_url || null,
    endPhotoUrl: row.end_photo_url || null,
    reports: Array.isArray(row.reports) ? row.reports.map(normalizeReportEntry).filter(Boolean) : [],
    photos: Array.isArray(row.photos) ? row.photos.map(normalizePhotoEntry).filter(Boolean) : [],
    executiveReport: normalizeExecutiveReportEntry(row.executive_report, {
      photos: Array.isArray(row.photos) ? row.photos.map(normalizePhotoEntry).filter(Boolean) : [],
    }),
    cities: Array.isArray(row.cities) ? row.cities : [],
    manualInactivatedAt: row.manual_inactivated_at instanceof Date ? row.manual_inactivated_at.toISOString() : row.manual_inactivated_at,
    manualInactivationComment: row.manual_inactivation_comment,
    manualInactivatedByUserId: row.manual_inactivated_by_user_id,
  };
};

const mergeEventPhotos = (legacyPhotos = [], dbPhotos = []) => {
  const merged = new Map();

  [...legacyPhotos, ...dbPhotos].forEach((photo) => {
    const normalized = normalizePhotoEntry(photo);
    if (!normalized?.uri) {
      return;
    }

    const key = normalized.uri;
    if (!merged.has(key)) {
      merged.set(key, normalized);
    }
  });

  return Array.from(merged.values());
};

const executeQuery = (client, text, params = []) => (client ? client.query(text, params) : query(text, params));

const mapProfilePhotoRow = (row) => ({
  ...row,
  ...normalizeProfilePhotoField(row.photo),
});

class PostgresEventAppRepository {
  async #syncStaffCategories(client = null) {
    const staffResult = await executeQuery(
      client,
      `
        SELECT DISTINCT category
        FROM staff
        WHERE TRIM(COALESCE(category, '')) <> ''
      `,
    );

    for (const row of staffResult.rows) {
      await this.#ensureStaffCategory(row.category, client);
    }
  }

  async #findStaffCategoryByName(name, client = null) {
    const normalizedName = normalizeStaffCategoryName(name);
    if (!normalizedName) {
      return null;
    }

    const result = await executeQuery(
      client,
      `
        SELECT id, name, code, is_active AS "isActive", created_at AS "createdAt"
        FROM staff_categories
        WHERE LOWER(name) = LOWER($1)
           OR LOWER(code) = LOWER($2)
        LIMIT 1
      `,
      [normalizedName, normalizeStaffCategoryCode(normalizedName)],
    );

    return result.rows[0] ? sanitizeStaffCategoryRecord(result.rows[0]) : null;
  }

  async #ensureStaffCategory(name, client = null) {
    const normalizedName = normalizeStaffCategoryName(name);
    const existingCategory = await this.#findStaffCategoryByName(normalizedName, client);
    if (existingCategory) {
      return existingCategory;
    }

    const createdCategory = await executeQuery(
      client,
      `
        INSERT INTO staff_categories (name, code, is_active)
        VALUES ($1, $2, TRUE)
        ON CONFLICT DO NOTHING
        RETURNING id, name, code, is_active AS "isActive", created_at AS "createdAt"
      `,
      [normalizedName, normalizeStaffCategoryCode(normalizedName)],
    );

    if (createdCategory.rowCount === 0) {
      return this.#findStaffCategoryByName(normalizedName, client);
    }

    return sanitizeStaffCategoryRecord(createdCategory.rows[0]);
  }

  async ping() {
    await query('SELECT 1');
  }

  async authenticateUser({ username, password }) {
    const result = await query(
      `
        SELECT u.id, u.username, u.full_name, u.phone, u.whatsapp_phone, u.email, u.expo_push_token, u.password_hash, u.terms_accepted, u.terms_accepted_at, r.code AS role
        FROM users u
        INNER JOIN roles r ON r.id = u.role_id
        WHERE LOWER(u.username) = LOWER($1) AND u.is_active = TRUE
        LIMIT 1
      `,
      [username],
    );

    const user = result.rows[0];
    if (!user || !comparePassword(password, user.password_hash)) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      phone: user.phone || null,
      whatsappPhone: user.whatsapp_phone || null,
      email: user.email || null,
      expoPushToken: user.expo_push_token || null,
      role: user.role,
      termsAccepted: user.terms_accepted ?? false,
      termsAcceptedAt: user.terms_accepted_at instanceof Date ? user.terms_accepted_at.toISOString() : user.terms_accepted_at,
    };
  }

  async findUserById(id) {
    const result = await query(
      `
        SELECT u.id, u.username, u.full_name AS "fullName", u.phone, u.whatsapp_phone AS "whatsappPhone", u.email, u.expo_push_token AS "expoPushToken",
               r.code AS role, u.is_active AS "isActive", u.terms_accepted AS "termsAccepted", u.terms_accepted_at AS "termsAcceptedAt"
        FROM users u
        INNER JOIN roles r ON r.id = u.role_id
        WHERE u.id = $1
        LIMIT 1
      `,
      [Number(id)],
    );

    return result.rows[0] ? sanitizeUserRecord(result.rows[0]) : null;
  }

  async acceptUserTerms({ userId }) {
    const result = await query(
      `
        UPDATE users
        SET terms_accepted = TRUE,
            terms_accepted_at = COALESCE(terms_accepted_at, NOW()),
            updated_at = NOW()
        WHERE id = $1
          AND is_active = TRUE
        RETURNING id, username, full_name AS "fullName", phone, whatsapp_phone AS "whatsappPhone", email,
                  expo_push_token AS "expoPushToken",
                  is_active AS "isActive", terms_accepted AS "termsAccepted", terms_accepted_at AS "termsAcceptedAt",
                  (SELECT code FROM roles WHERE id = users.role_id) AS role
      `,
      [Number(userId)],
    );

    if (result.rowCount > 0) {
      return sanitizeUserRecord(result.rows[0]);
    }

    const existingUser = await query(
      `
        SELECT id, is_active AS "isActive"
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [Number(userId)],
    );

    if (existingUser.rowCount === 0) {
      return { errorCode: 'USER_NOT_FOUND' };
    }

    return { errorCode: 'USER_INACTIVE' };
  }

  async changeUserPassword({ userId, currentPassword, newPassword }) {
    const result = await query(
      `
        SELECT id, username, password_hash
        FROM users
        WHERE id = $1 AND is_active = TRUE
        LIMIT 1
      `,
      [Number(userId)],
    );

    const user = result.rows[0];

    if (!user) {
      return { errorCode: 'USER_NOT_FOUND' };
    }

    if (!comparePassword(currentPassword, user.password_hash)) {
      return { errorCode: 'INVALID_CURRENT_PASSWORD' };
    }

    await query(
      `
        UPDATE users
        SET password_hash = $2,
            updated_at = NOW()
        WHERE id = $1
      `,
      [user.id, createPasswordHash(newPassword)],
    );

    return {
      id: user.id,
      username: user.username,
    };
  }

  async saveExpoPushToken({ userId, expoPushToken }) {
    const result = await query(
      `
        UPDATE users
        SET expo_push_token = $2,
            updated_at = NOW()
        WHERE id = $1 AND is_active = TRUE
        RETURNING id, username, full_name AS "fullName", phone, whatsapp_phone AS "whatsappPhone", email, expo_push_token AS "expoPushToken",
                  is_active AS "isActive", terms_accepted AS "termsAccepted", terms_accepted_at AS "termsAcceptedAt",
                  (SELECT code FROM roles WHERE id = users.role_id) AS role
      `,
      [Number(userId), expoPushToken || null],
    );

    if (result.rowCount === 0) {
      const existing = await query('SELECT id, is_active AS "isActive" FROM users WHERE id = $1 LIMIT 1', [Number(userId)]);
      if (existing.rowCount === 0) {
        return { errorCode: 'USER_NOT_FOUND' };
      }
      return { errorCode: 'USER_INACTIVE' };
    }

    return sanitizeUserRecord(result.rows[0]);
  }

  async getClients({ search, includeInactive = false } = {}) {
    const normalizedSearch = normalizeString(search);
    const searchPattern = normalizedSearch ? `%${normalizedSearch.toLowerCase()}%` : null;
    const result = await query(
      `
        SELECT c.id AS "clientId", u.id AS "userId", COALESCE(c.razon_social, u.full_name) AS "razonSocial", c.nit,
               COALESCE(c.contact_full_name, u.full_name) AS "contactFullName", c.contact_role AS "contactRole",
               COALESCE(c.phone, u.phone) AS phone,
               COALESCE(c.whatsapp_phone, u.whatsapp_phone, u.phone) AS "whatsappPhone",
               COALESCE(c.email, u.email) AS email,
               COALESCE(c.is_active, u.is_active) AS "isActive",
               u.id, u.username, u.full_name AS "userFullName", u.phone AS "userPhone",
               u.whatsapp_phone AS "userWhatsappPhone", u.email AS "userEmail", u.is_active AS "userIsActive"
         FROM users u
         INNER JOIN roles r ON r.id = u.role_id
         LEFT JOIN clients c ON c.user_id = u.id
          WHERE r.code = 'CLIENTE'
            AND ($1::boolean = TRUE OR (u.is_active = TRUE AND COALESCE(c.is_active, TRUE) = TRUE))
            AND (
              $2::text IS NULL
              OR LOWER(COALESCE(c.razon_social, u.full_name)) LIKE $3
              OR LOWER(COALESCE(c.contact_full_name, u.full_name)) LIKE $3
              OR LOWER(COALESCE(u.username, '')) LIKE $3
              OR LOWER(COALESCE(c.email, u.email, '')) LIKE $3
              OR LOWER(COALESCE(c.nit, '')) LIKE $3
            )
          ORDER BY COALESCE(c.razon_social, u.full_name) ASC, COALESCE(c.id, u.id) ASC
       `,
      [includeInactive, normalizedSearch || null, searchPattern],
    );

    return result.rows.map((row) => sanitizeClientRecord({
      client: {
        id: row.clientId,
        userId: row.userId,
        razonSocial: row.razonSocial,
        nit: row.nit,
        contactFullName: row.contactFullName,
        contactRole: row.contactRole,
        phone: row.phone,
        whatsappPhone: row.whatsappPhone,
        email: row.email,
        isActive: row.isActive,
      },
      user: {
        id: row.id,
        username: row.username,
        fullName: row.userFullName,
        phone: row.userPhone,
        whatsappPhone: row.userWhatsappPhone,
        email: row.userEmail,
        isActive: row.userIsActive,
      },
    }));
  }

  async getAdminClients({ search } = {}) {
    return this.getClients({ search, includeInactive: true });
  }

  async getAdminExecutives({ search } = {}) {
    const normalizedSearch = normalizeString(search);
    const searchPattern = normalizedSearch ? `%${normalizedSearch.toLowerCase()}%` : null;
    const phonePattern = normalizedSearch ? `%${normalizedSearch}%` : null;
    const result = await query(
      `
        SELECT e.id, e.user_id AS "userId", e.full_name AS "fullName", e.cedula, e.phone, e.whatsapp_phone AS "whatsappPhone", e.email,
               e.address, ci.name AS city, e.is_active AS "isActive", u.username, u.email AS "userEmail", u.is_active AS "userIsActive"
        FROM executives e
        INNER JOIN users u ON u.id = e.user_id
        INNER JOIN roles r ON r.id = u.role_id
        LEFT JOIN cities ci ON ci.id = e.city_id
        WHERE r.code = 'EJECUTIVO'
          AND (
            $1::text IS NULL
            OR LOWER(e.full_name) LIKE $2
            OR LOWER(COALESCE(e.cedula, '')) LIKE $2
            OR LOWER(u.username) LIKE $2
            OR LOWER(COALESCE(e.email, '')) LIKE $2
            OR LOWER(COALESCE(e.address, '')) LIKE $2
            OR LOWER(COALESCE(ci.name, '')) LIKE $2
            OR COALESCE(e.phone, '') LIKE $3
            OR COALESCE(e.whatsapp_phone, '') LIKE $3
          )
        ORDER BY e.full_name ASC, e.id ASC
      `,
      [normalizedSearch || null, searchPattern, phonePattern],
    );

    return result.rows.map(sanitizeExecutiveAdminRecord);
  }

  async findAdminExecutiveByCedula(cedula) {
    const normalizedCedula = String(cedula || '').trim();
    if (!normalizedCedula) {
      return null;
    }

    const executives = await this.getAdminExecutives();
    return executives.find((executive) => isDocumentEquivalent(executive.cedula, normalizedCedula)) || null;
  }

  async findAdminClientByNit(nit) {
    const normalizedNit = String(nit || '').trim();
    if (!normalizedNit) {
      return null;
    }

    const clients = await this.getAdminClients();
    return clients.find((client) => isNitEquivalent(client.nit, normalizedNit)) || null;
  }

  async getAuditLogsForEntity({ entityType, entityId, limit = 10 }) {
    const result = await query(
      `
        SELECT a.id, a.entity_type AS "entityType", a.entity_id AS "entityId", a.action,
               a.actor_user_id AS "actorUserId", a.previous_values AS "previousValues", a.new_values AS "newValues",
               a.created_at AS timestamp,
               u.username AS "actorUsername", u.full_name AS "actorFullName"
        FROM audit_logs a
        LEFT JOIN users u ON u.id = a.actor_user_id
        WHERE a.entity_type = $1 AND a.entity_id = $2
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT $3
      `,
      [entityType, Number(entityId), Number(limit)],
    );

    return result.rows.map((row) => sanitizeAuditLogRecord({ auditLog: row }));
  }

  async findAdminCoordinatorByCedula(cedula) {
    const normalizedCedula = String(cedula || '').trim();
    if (!normalizedCedula) {
      return null;
    }

    const coordinators = await this.getAdminCoordinators();
    return coordinators.find((coordinator) => isDocumentEquivalent(coordinator.cedula, normalizedCedula)) || null;
  }

  async findAdminStaffByCedula(cedula) {
    const normalizedCedula = String(cedula || '').trim();
    if (!normalizedCedula) {
      return null;
    }

    const staff = await this.getAdminStaff();
    return staff.find((staffMember) => isDocumentEquivalent(staffMember.cedula, normalizedCedula)) || null;
  }

  async getAdminCoordinators() {
    const result = await query(
      `
        SELECT c.id, c.user_id AS "userId", c.full_name AS name, c.cedula, c.address, c.phone, c.rating, c.photo, c.is_active AS "isActive", ci.name AS city,
               u.id AS user_id_ref, u.username, u.whatsapp_phone AS "whatsappPhone", u.email, u.is_active AS "userIsActive"
        FROM coordinators c
        INNER JOIN cities ci ON ci.id = c.city_id
        LEFT JOIN users u ON u.id = c.user_id
        ORDER BY c.full_name ASC, c.id ASC
      `,
    );

    return result.rows.map((row) => sanitizeCoordinatorAdminRecord({
      coordinator: row,
        user: row.username ? {
          id: row.user_id_ref,
          username: row.username,
          whatsappPhone: row.whatsappPhone,
          email: row.email,
          isActive: row.userIsActive,
        } : null,
      }));
  }

  async getAdminStaff() {
    const result = await query(
      `
        SELECT s.id, s.full_name AS name, s.cedula, ci.name AS city, s.category, s.photo, s.is_active AS "isActive",
               s.sex AS sexo, s.shirt_size AS "shirtSize", s.pants_size AS "pantsSize", s.clothing_size AS "clothingSize", s.shoe_size AS "shoeSize", s.height AS altura, s.measurements
        FROM staff s
        INNER JOIN cities ci ON ci.id = s.city_id
        ORDER BY s.full_name ASC, s.id ASC
      `,
    );

    return result.rows.map(sanitizeStaffAdminRecord);
  }

  async findCoordinatorProfileByUserId(userId) {
    const normalizedUserId = Number(userId);

    if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
      return null;
    }

    const coordinatorResult = await query(
      `
        SELECT c.id, c.user_id AS "userId", c.full_name AS name, c.cedula, c.address, c.phone, c.rating, c.photo, c.is_active AS "isActive", ci.name AS city
        FROM coordinators c
        INNER JOIN cities ci ON ci.id = c.city_id
        LEFT JOIN users u ON u.id = c.user_id
        WHERE (c.user_id = $1 OR c.id = $1)
          AND c.is_active = TRUE
          AND COALESCE(u.is_active, TRUE) = TRUE
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
        SELECT c.id, c.full_name AS name, c.cedula, c.address, c.phone, c.rating, c.photo, c.is_active AS "isActive", ci.name AS city
        FROM coordinators c
        INNER JOIN cities ci ON ci.id = c.city_id
        LEFT JOIN users u ON u.id = c.user_id
        WHERE ($1::text IS NULL OR LOWER(ci.name) = LOWER($1))
          AND c.is_active = TRUE
          AND COALESCE(u.is_active, TRUE) = TRUE
        ORDER BY c.full_name ASC
      `,
      [normalizeString(city) || null],
    );

    return result.rows.map((row) => sanitizeCoordinatorAdminRecord({ coordinator: row }));
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

    return events
      .map((event) => mapCoordinatorEvent({
        event,
        coordinatorProfile,
        executiveContact: event.executiveContact || null,
      }))
      .filter(Boolean);
  }

  async getStaff({ city, category } = {}) {
    await this.#syncStaffCategories();

    const result = await query(
      `
        SELECT s.id, s.full_name AS name, s.cedula, ci.name AS city, s.category, s.photo, s.is_active AS "isActive",
               s.sex AS sexo, s.shirt_size AS "shirtSize", s.pants_size AS "pantsSize", s.clothing_size AS "clothingSize", s.shoe_size AS "shoeSize", s.height AS altura, s.measurements
        FROM staff s
        INNER JOIN cities ci ON ci.id = s.city_id
        WHERE ($1::text IS NULL OR LOWER(ci.name) = LOWER($1))
          AND ($2::text IS NULL OR UPPER(s.category) = UPPER($2))
          AND s.is_active = TRUE
        ORDER BY s.full_name ASC
      `,
      [normalizeString(city) || null, normalizeString(category) || null],
    );

    return result.rows.map(sanitizeStaffAdminRecord);
  }

  async getStaffCategories({ search } = {}) {
    await this.#syncStaffCategories();

    const result = await query(
      `
        SELECT id, name, code, is_active AS "isActive", created_at AS "createdAt"
        FROM staff_categories
        WHERE ($1::text IS NULL OR LOWER(name) LIKE LOWER($2) OR LOWER(code) LIKE LOWER($2))
        ORDER BY name ASC
      `,
      [normalizeString(search) || null, `%${normalizeString(search || '').toLowerCase()}%`],
    );

    return result.rows.filter((category) => isStaffCategoryMatch(category, search)).map(sanitizeStaffCategoryRecord);
  }

  async findStaffCategoryByName(name) {
    await this.#syncStaffCategories();
    return this.#findStaffCategoryByName(name);
  }

  async createStaffCategory(name) {
    await this.#syncStaffCategories();

    const normalizedName = normalizeStaffCategoryName(name);
    if (!normalizedName) {
      return { errorCode: 'INVALID_PAYLOAD', message: 'El nombre de la categoría es obligatorio.' };
    }

    const existingCategory = await this.#findStaffCategoryByName(normalizedName);
    if (existingCategory) {
      return { errorCode: 'DUPLICATE_RECORD', message: 'La categoría de staff ya existe.' };
    }

    return this.#ensureStaffCategory(normalizedName);
  }

  async createClient(payload) {
    const duplicateNitClient = payload.nit ? await this.findAdminClientByNit(payload.nit) : null;
    if (duplicateNitClient) {
      return { errorCode: 'DUPLICATE_RECORD', message: DUPLICATE_CLIENT_NIT_MESSAGE };
    }

    if (await hasDuplicateUsername({ username: payload.username })) {
      return { errorCode: 'DUPLICATE_RECORD', message: DUPLICATE_USERNAME_MESSAGE };
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const userResult = await client.query(
        `
          INSERT INTO users (username, full_name, phone, whatsapp_phone, email, password_hash, role_id, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, (SELECT id FROM roles WHERE code = 'CLIENTE'), TRUE)
          RETURNING id, username, full_name AS "fullName", phone, whatsapp_phone AS "whatsappPhone", email, TRUE AS "isActive"
        `,
        [payload.username, payload.contactFullName, payload.phone, payload.whatsappPhone || payload.phone, payload.email || null, createPasswordHash(payload.password)],
      );

      const clientResult = await client.query(
        `
          INSERT INTO clients (user_id, razon_social, nit, contact_full_name, contact_role, phone, whatsapp_phone, email, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
          RETURNING id, user_id AS "userId", razon_social AS "razonSocial", nit,
                    contact_full_name AS "contactFullName", contact_role AS "contactRole",
                    phone, whatsapp_phone AS "whatsappPhone", email, is_active AS "isActive"
        `,
        [userResult.rows[0].id, payload.razonSocial, payload.nit, payload.contactFullName, payload.contactRole, payload.phone, payload.whatsappPhone || payload.phone, payload.email || null],
      );

      const createdRecord = sanitizeClientRecord({ client: clientResult.rows[0], user: userResult.rows[0] });
      await this.#insertAuditLog(client, {
        actorUserId: payload.actorUserId,
        entityType: 'client',
        entityId: clientResult.rows[0].id,
        action: 'create',
        previousValues: null,
        newValues: createdRecord,
      });

      await client.query('COMMIT');
      return createdRecord;
    } catch (error) {
      await client.query('ROLLBACK');
      if (isPostgresUniqueViolation(error)) {
        return mapAdminUniqueViolation(error) || { errorCode: 'DUPLICATE_RECORD', message: DUPLICATE_CLIENT_NIT_MESSAGE };
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async createExecutive(payload) {
    const cityResult = await query('SELECT id, name FROM cities WHERE LOWER(name) = LOWER($1) LIMIT 1', [payload.city]);
    if (cityResult.rowCount === 0) {
      return { errorCode: 'INVALID_REFERENCE', message: 'La ciudad seleccionada no existe.' };
    }

    const duplicateExecutiveByCedula = payload.cedula ? await this.findAdminExecutiveByCedula(payload.cedula) : null;
    if (duplicateExecutiveByCedula) {
      return { errorCode: 'DUPLICATE_RECORD', message: DUPLICATE_EXECUTIVE_CEDULA_MESSAGE };
    }

    if (await hasDuplicateUsername({ username: payload.username })) {
      return { errorCode: 'DUPLICATE_RECORD', message: DUPLICATE_USERNAME_MESSAGE };
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const userResult = await client.query(
        `
          INSERT INTO users (username, full_name, phone, whatsapp_phone, email, password_hash, role_id, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, (SELECT id FROM roles WHERE code = 'EJECUTIVO'), TRUE)
          RETURNING id, username, full_name AS "fullName", phone, whatsapp_phone AS "whatsappPhone", email, is_active AS "isActive"
        `,
        [payload.username, payload.fullName, payload.phone, payload.whatsappPhone || payload.phone, payload.email || null, createPasswordHash(payload.password)],
      );

      const executiveResult = await client.query(
        `
          INSERT INTO executives (user_id, full_name, cedula, address, phone, whatsapp_phone, email, city_id, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
          RETURNING id, user_id AS "userId", full_name AS "fullName", cedula, address, phone, whatsapp_phone AS "whatsappPhone", email, is_active AS "isActive"
        `,
        [userResult.rows[0].id, payload.fullName, payload.cedula, payload.address, payload.phone, payload.whatsappPhone || payload.phone, payload.email || null, cityResult.rows[0].id],
      );

      const createdRecord = sanitizeExecutiveAdminRecord({ ...executiveResult.rows[0], city: cityResult.rows[0].name }, userResult.rows[0]);
      await this.#insertAuditLog(client, {
        actorUserId: payload.actorUserId,
        entityType: 'executive',
        entityId: executiveResult.rows[0].id,
        action: 'create',
        previousValues: null,
        newValues: createdRecord,
      });

      await client.query('COMMIT');
      return createdRecord;
    } catch (error) {
      await client.query('ROLLBACK');
      if (isPostgresUniqueViolation(error)) {
        return mapAdminUniqueViolation(error) || { errorCode: 'DUPLICATE_RECORD', message: DUPLICATE_EXECUTIVE_CEDULA_MESSAGE };
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async updateClient(clientId, payload) {
    const normalizedClientId = Number(clientId);
    const currentClientResult = await query(
      `
        SELECT c.id AS "clientId", c.user_id AS "userId", c.razon_social AS "razonSocial", c.nit,
               c.contact_full_name AS "contactFullName", c.contact_role AS "contactRole",
               c.phone, c.whatsapp_phone AS "whatsappPhone", c.email, c.is_active AS "isActive",
               u.id, u.username, u.full_name AS "fullName", u.phone AS "userPhone",
               u.whatsapp_phone AS "userWhatsappPhone", u.email AS "userEmail", u.is_active AS "userIsActive"
        FROM clients c
        INNER JOIN users u ON u.id = c.user_id
        WHERE c.id = $1
        LIMIT 1
      `,
      [normalizedClientId],
    );

    if (currentClientResult.rowCount === 0) {
      return { errorCode: 'NOT_FOUND' };
    }

    const currentRow = currentClientResult.rows[0];
    const duplicateNitClient = payload.nit ? await this.findAdminClientByNit(payload.nit) : null;
    if (duplicateNitClient && Number(duplicateNitClient.clientId) !== normalizedClientId) {
      return { errorCode: 'DUPLICATE_RECORD', message: DUPLICATE_CLIENT_NIT_MESSAGE };
    }

    if (await hasDuplicateUsername({ username: payload.username, excludeUserId: currentRow.userId })) {
      return { errorCode: 'DUPLICATE_RECORD', message: DUPLICATE_USERNAME_MESSAGE };
    }

    const previousRecord = sanitizeClientRecord({
      client: {
        id: currentRow.clientId,
        userId: currentRow.userId,
        razonSocial: currentRow.razonSocial,
        nit: currentRow.nit,
        contactFullName: currentRow.contactFullName,
        contactRole: currentRow.contactRole,
        phone: currentRow.phone,
        whatsappPhone: currentRow.whatsappPhone,
        email: currentRow.email,
        isActive: currentRow.isActive,
      },
      user: {
        id: currentRow.id,
        username: currentRow.username,
        fullName: currentRow.fullName,
        phone: currentRow.userPhone,
        whatsappPhone: currentRow.userWhatsappPhone,
        email: currentRow.userEmail,
        isActive: currentRow.userIsActive,
      },
    });

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const userResult = await client.query(
        `
          UPDATE users
          SET username = $2,
              full_name = $3,
              phone = $4,
              whatsapp_phone = $5,
              email = $6,
              updated_at = NOW()
          WHERE id = $1
          RETURNING id, username, full_name AS "fullName", phone, whatsapp_phone AS "whatsappPhone", email, is_active AS "isActive"
        `,
        [currentRow.userId, payload.username, payload.contactFullName, payload.phone, payload.whatsappPhone || payload.phone, payload.email || null],
      );

      const clientResult = await client.query(
        `
          UPDATE clients
          SET razon_social = $2,
              nit = $3,
              contact_full_name = $4,
              contact_role = $5,
              phone = $6,
              whatsapp_phone = $7,
              email = $8,
              is_active = $9,
              updated_at = NOW()
          WHERE id = $1
          RETURNING id, user_id AS "userId", razon_social AS "razonSocial", nit,
                    contact_full_name AS "contactFullName", contact_role AS "contactRole",
                    phone, whatsapp_phone AS "whatsappPhone", email, is_active AS "isActive"
        `,
        [normalizedClientId, payload.razonSocial, payload.nit, payload.contactFullName, payload.contactRole, payload.phone, payload.whatsappPhone || payload.phone, payload.email || null, currentRow.isActive !== false],
      );

      const updatedRecord = sanitizeClientRecord({ client: clientResult.rows[0], user: userResult.rows[0] });
      await this.#insertAuditLog(client, {
        actorUserId: payload.actorUserId,
        entityType: 'client',
        entityId: normalizedClientId,
        action: 'update',
        previousValues: previousRecord,
        newValues: updatedRecord,
      });

      await client.query('COMMIT');
      return updatedRecord;
    } catch (error) {
      await client.query('ROLLBACK');
      if (isPostgresUniqueViolation(error)) {
        return mapAdminUniqueViolation(error) || { errorCode: 'DUPLICATE_RECORD', message: DUPLICATE_CLIENT_NIT_MESSAGE };
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async updateExecutive(executiveId, payload) {
    const normalizedExecutiveId = Number(executiveId);
    const currentExecutiveResult = await query(
      `
        SELECT e.id, e.user_id AS "userId", e.full_name AS "fullName", e.cedula, e.address, e.phone, e.whatsapp_phone AS "whatsappPhone", e.email,
               ci.id AS "cityId", ci.name AS city, e.is_active AS "isActive", u.username, u.email AS "userEmail", u.is_active AS "userIsActive"
        FROM executives e
        INNER JOIN users u ON u.id = e.user_id
        INNER JOIN roles r ON r.id = u.role_id
        LEFT JOIN cities ci ON ci.id = e.city_id
        WHERE r.code = 'EJECUTIVO'
          AND e.id = $1
        LIMIT 1
      `,
      [normalizedExecutiveId],
    );

    if (currentExecutiveResult.rowCount === 0) {
      return { errorCode: 'NOT_FOUND' };
    }

    const duplicateExecutiveByCedula = payload.cedula ? await this.findAdminExecutiveByCedula(payload.cedula) : null;
    if (duplicateExecutiveByCedula && Number(duplicateExecutiveByCedula.id) !== normalizedExecutiveId) {
      return { errorCode: 'DUPLICATE_RECORD', message: DUPLICATE_EXECUTIVE_CEDULA_MESSAGE };
    }

    const cityResult = await query('SELECT id, name FROM cities WHERE LOWER(name) = LOWER($1) LIMIT 1', [payload.city]);
    if (cityResult.rowCount === 0) {
      return { errorCode: 'INVALID_REFERENCE', message: 'La ciudad seleccionada no existe.' };
    }

    if (await hasDuplicateUsername({ username: payload.username, excludeUserId: currentExecutiveResult.rows[0].userId })) {
      return { errorCode: 'DUPLICATE_RECORD', message: DUPLICATE_USERNAME_MESSAGE };
    }

    const previousRecord = sanitizeExecutiveAdminRecord(currentExecutiveResult.rows[0]);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const userResult = await client.query(
        `
          UPDATE users
          SET username = $2,
              full_name = $3,
              phone = $4,
              whatsapp_phone = $5,
              email = $6,
              updated_at = NOW()
          WHERE id = $1
          RETURNING id, username, full_name AS "fullName", phone, whatsapp_phone AS "whatsappPhone", email, is_active AS "isActive"
        `,
        [currentExecutiveResult.rows[0].userId, payload.username, payload.fullName, payload.phone, payload.whatsappPhone || payload.phone, payload.email || null],
      );

      const executiveResult = await client.query(
        `
          UPDATE executives
          SET full_name = $2,
              cedula = $3,
              address = $4,
              phone = $5,
              whatsapp_phone = $6,
              email = $7,
              city_id = $8,
              is_active = $9,
              updated_at = NOW()
          WHERE id = $1
          RETURNING id, user_id AS "userId", full_name AS "fullName", cedula, address, phone, whatsapp_phone AS "whatsappPhone", email, is_active AS "isActive"
        `,
        [normalizedExecutiveId, payload.fullName, payload.cedula, payload.address, payload.phone, payload.whatsappPhone || payload.phone, payload.email || null, cityResult.rows[0].id, currentExecutiveResult.rows[0].isActive !== false],
      );

      const updatedRecord = sanitizeExecutiveAdminRecord({ ...executiveResult.rows[0], city: cityResult.rows[0].name }, userResult.rows[0]);
      await this.#insertAuditLog(client, {
        actorUserId: payload.actorUserId,
        entityType: 'executive',
        entityId: normalizedExecutiveId,
        action: 'update',
        previousValues: previousRecord,
        newValues: updatedRecord,
      });

      await client.query('COMMIT');
      return updatedRecord;
    } catch (error) {
      await client.query('ROLLBACK');
      if (isPostgresUniqueViolation(error)) {
        return mapAdminUniqueViolation(error) || { errorCode: 'DUPLICATE_RECORD', message: DUPLICATE_EXECUTIVE_CEDULA_MESSAGE };
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async createCoordinator(payload) {
    const cityResult = await query('SELECT id, name FROM cities WHERE LOWER(name) = LOWER($1) LIMIT 1', [payload.city]);
    if (cityResult.rowCount === 0) {
      return { errorCode: 'INVALID_REFERENCE', message: 'La ciudad seleccionada no existe.' };
    }

    const duplicateCedulaCoordinator = payload.cedula ? await this.findAdminCoordinatorByCedula(payload.cedula) : null;

    if (duplicateCedulaCoordinator) {
      return { errorCode: 'DUPLICATE_RECORD', message: DUPLICATE_COORDINATOR_CEDULA_MESSAGE };
    }

    if (await hasDuplicateUsername({ username: payload.username })) {
      return { errorCode: 'DUPLICATE_RECORD', message: DUPLICATE_USERNAME_MESSAGE };
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const userResult = await client.query(
        `
          INSERT INTO users (username, full_name, phone, whatsapp_phone, email, password_hash, role_id, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, (SELECT id FROM roles WHERE code = 'COORDINADOR'), TRUE)
          RETURNING id, username, full_name AS "fullName", phone, whatsapp_phone AS "whatsappPhone", email, is_active AS "isActive"
        `,
        [payload.username, payload.fullName, payload.phone, payload.whatsappPhone || payload.phone, payload.email || null, createPasswordHash(payload.password)],
      );

      const coordinatorResult = await client.query(
        `
          INSERT INTO coordinators (user_id, full_name, cedula, address, phone, rating, photo, is_active, city_id)
          VALUES ($1, $2, $3, $4, $5, 5, $6, TRUE, $7)
          RETURNING id, user_id AS "userId", full_name AS name, cedula, address, phone, rating, photo, is_active AS "isActive"
        `,
        [userResult.rows[0].id, payload.fullName, payload.cedula, payload.address, payload.phone, payload.photo ? serializeProfilePhotoField(payload.photo) : DEFAULT_PROFILE_PHOTO, cityResult.rows[0].id],
      );

      const createdRecord = sanitizeCoordinatorAdminRecord({
        coordinator: { ...coordinatorResult.rows[0], city: cityResult.rows[0].name },
        user: userResult.rows[0],
      });
      await this.#insertAuditLog(client, {
        actorUserId: payload.actorUserId,
        entityType: 'coordinator',
        entityId: coordinatorResult.rows[0].id,
        action: 'create',
        previousValues: null,
        newValues: createdRecord,
      });

      await client.query('COMMIT');
      return createdRecord;
    } catch (error) {
      await client.query('ROLLBACK');
      if (isPostgresUniqueViolation(error)) {
        return mapAdminUniqueViolation(error) || { errorCode: 'DUPLICATE_RECORD', message: DUPLICATE_COORDINATOR_CEDULA_MESSAGE };
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async updateCoordinator(coordinatorId, payload) {
    const normalizedCoordinatorId = Number(coordinatorId);
    const currentCoordinatorResult = await query(
      `
         SELECT c.id, c.user_id AS "userId", c.full_name AS name, c.cedula, c.address, c.phone, c.rating, c.photo, c.is_active AS "isActive", ci.id AS "cityId", ci.name AS city,
                u.id AS "linkedUserId", u.username, u.full_name AS "userFullName", u.phone AS "userPhone",
                u.whatsapp_phone AS "userWhatsappPhone", u.email AS "userEmail", u.is_active AS "userIsActive"
        FROM coordinators c
        INNER JOIN cities ci ON ci.id = c.city_id
        LEFT JOIN users u ON u.id = c.user_id
        WHERE c.id = $1
        LIMIT 1
      `,
      [normalizedCoordinatorId],
    );

    if (currentCoordinatorResult.rowCount === 0) {
      return { errorCode: 'NOT_FOUND' };
    }

    const currentRow = currentCoordinatorResult.rows[0];
    const cityResult = await query('SELECT id, name FROM cities WHERE LOWER(name) = LOWER($1) LIMIT 1', [payload.city]);
    if (cityResult.rowCount === 0) {
      return { errorCode: 'INVALID_REFERENCE', message: 'La ciudad seleccionada no existe.' };
    }

    const duplicateCoordinatorByCedula = payload.cedula ? await this.findAdminCoordinatorByCedula(payload.cedula) : null;
    if (duplicateCoordinatorByCedula && Number(duplicateCoordinatorByCedula.id) !== normalizedCoordinatorId) {
      return { errorCode: 'DUPLICATE_RECORD', message: DUPLICATE_COORDINATOR_CEDULA_MESSAGE };
    }

    if (currentRow.linkedUserId && await hasDuplicateUsername({
      username: payload.username || currentRow.username,
      excludeUserId: currentRow.linkedUserId,
    })) {
      return { errorCode: 'DUPLICATE_RECORD', message: DUPLICATE_USERNAME_MESSAGE };
    }

    const previousRecord = sanitizeCoordinatorAdminRecord({
      coordinator: currentRow,
        user: currentRow.linkedUserId ? {
          id: currentRow.linkedUserId,
          username: currentRow.username,
          fullName: currentRow.userFullName,
          phone: currentRow.userPhone,
          whatsappPhone: currentRow.userWhatsappPhone,
          email: currentRow.userEmail,
          isActive: currentRow.userIsActive,
        } : null,
      });

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      let updatedUser = null;
      if (currentRow.linkedUserId) {
        const userResult = await client.query(
          `
            UPDATE users
            SET username = $2,
                full_name = $3,
                phone = $4,
                whatsapp_phone = $5,
                email = $6,
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, username, full_name AS "fullName", phone, whatsapp_phone AS "whatsappPhone", email, is_active AS "isActive"
          `,
          [currentRow.linkedUserId, payload.username || currentRow.username, payload.fullName, payload.phone, payload.whatsappPhone || payload.phone, payload.email || null],
        );
        updatedUser = userResult.rows[0] || null;
      }

      const coordinatorResult = await client.query(
        `
          UPDATE coordinators
          SET full_name = $2,
              cedula = $3,
              address = $4,
              phone = $5,
              city_id = $6,
              is_active = $7,
              photo = $8,
              updated_at = NOW()
            WHERE id = $1
            RETURNING id, user_id AS "userId", full_name AS name, cedula, address, phone, rating, photo, is_active AS "isActive"
        `,
        [normalizedCoordinatorId, payload.fullName, payload.cedula, payload.address, payload.phone, cityResult.rows[0].id, currentRow.isActive !== false, payload.photo ? serializeProfilePhotoField(payload.photo) : currentRow.photo || DEFAULT_PROFILE_PHOTO],
      );

      const updatedRecord = sanitizeCoordinatorAdminRecord({
        coordinator: { ...coordinatorResult.rows[0], city: cityResult.rows[0].name },
        user: updatedUser,
      });
      await this.#insertAuditLog(client, {
        actorUserId: payload.actorUserId,
        entityType: 'coordinator',
        entityId: normalizedCoordinatorId,
        action: 'update',
        previousValues: previousRecord,
        newValues: updatedRecord,
      });

      await client.query('COMMIT');
      return updatedRecord;
    } catch (error) {
      await client.query('ROLLBACK');
      if (isPostgresUniqueViolation(error)) {
        return mapAdminUniqueViolation(error) || { errorCode: 'DUPLICATE_RECORD', message: DUPLICATE_COORDINATOR_CEDULA_MESSAGE };
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async createStaff(payload) {
    const cityResult = await query('SELECT id, name FROM cities WHERE LOWER(name) = LOWER($1) LIMIT 1', [payload.city]);
    if (cityResult.rowCount === 0) {
      return { errorCode: 'INVALID_REFERENCE', message: 'La ciudad seleccionada no existe.' };
    }

    const duplicateCedulaStaff = payload.cedula ? await this.findAdminStaffByCedula(payload.cedula) : null;

    if (duplicateCedulaStaff) {
      return { errorCode: 'DUPLICATE_RECORD', message: DUPLICATE_STAFF_CEDULA_MESSAGE };
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const categoryRecord = await this.#ensureStaffCategory(payload.category, client);
      const sizes = resolveStaffSizeFields(payload);

      const result = await client.query(
        `
          INSERT INTO staff (full_name, cedula, city_id, category, photo, is_active, sex, shirt_size, pants_size, clothing_size, shoe_size, height, measurements)
          VALUES ($1, $2, $3, $4, $5, TRUE, $6, $7, $8, $9, $10, $11, $12)
          RETURNING id, full_name AS name, cedula, category, photo, is_active AS "isActive", sex AS sexo, shirt_size AS "shirtSize", pants_size AS "pantsSize", clothing_size AS "clothingSize", shoe_size AS "shoeSize", height AS altura, measurements
        `,
        [payload.fullName, payload.cedula, cityResult.rows[0].id, categoryRecord.name, payload.photo ? serializeProfilePhotoField(payload.photo) : DEFAULT_PROFILE_PHOTO, payload.sexo, sizes.shirtSize, sizes.pantsSize, sizes.clothingSize, payload.shoeSize || null, payload.altura || null, serializeStaffMeasurements(payload)],
      );

      const createdRecord = sanitizeStaffAdminRecord({ ...result.rows[0], city: cityResult.rows[0].name });
      await this.#insertAuditLog(client, {
        actorUserId: payload.actorUserId,
        entityType: 'staff',
        entityId: result.rows[0].id,
        action: 'create',
        previousValues: null,
        newValues: createdRecord,
      });

      await client.query('COMMIT');
      return createdRecord;
    } catch (error) {
      await client.query('ROLLBACK');
      if (isPostgresUniqueViolation(error)) {
        return mapAdminUniqueViolation(error) || { errorCode: 'DUPLICATE_RECORD', message: DUPLICATE_STAFF_CEDULA_MESSAGE };
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async updateStaff(staffId, payload) {
    const normalizedStaffId = Number(staffId);
    const currentStaffResult = await query(
      `
        SELECT s.id, s.full_name AS name, s.cedula, ci.id AS "cityId", ci.name AS city, s.category, s.photo, s.is_active AS "isActive",
               s.sex AS sexo, s.shirt_size AS "shirtSize", s.pants_size AS "pantsSize", s.clothing_size AS "clothingSize", s.shoe_size AS "shoeSize", s.height AS altura, s.measurements
        FROM staff s
        INNER JOIN cities ci ON ci.id = s.city_id
        WHERE s.id = $1
        LIMIT 1
      `,
      [normalizedStaffId],
    );

    if (currentStaffResult.rowCount === 0) {
      return { errorCode: 'NOT_FOUND' };
    }

    const currentRow = currentStaffResult.rows[0];
    const cityResult = await query('SELECT id, name FROM cities WHERE LOWER(name) = LOWER($1) LIMIT 1', [payload.city]);
    if (cityResult.rowCount === 0) {
      return { errorCode: 'INVALID_REFERENCE', message: 'La ciudad seleccionada no existe.' };
    }

    const duplicateStaffByCedula = payload.cedula ? await this.findAdminStaffByCedula(payload.cedula) : null;
    if (duplicateStaffByCedula && Number(duplicateStaffByCedula.id) !== normalizedStaffId) {
      return { errorCode: 'DUPLICATE_RECORD', message: DUPLICATE_STAFF_CEDULA_MESSAGE };
    }

    const previousRecord = sanitizeStaffAdminRecord(currentRow);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const categoryRecord = await this.#ensureStaffCategory(payload.category, client);
      const sizes = resolveStaffSizeFields(payload);

      const result = await client.query(
        `
          UPDATE staff
          SET full_name = $2,
              cedula = $3,
              city_id = $4,
              category = $5,
              is_active = $6,
              sex = $7,
              shirt_size = $8,
              pants_size = $9,
              clothing_size = $10,
              shoe_size = $11,
              height = $12,
              measurements = $13,
              photo = $14,
              updated_at = NOW()
          WHERE id = $1
          RETURNING id, full_name AS name, cedula, category, photo, is_active AS "isActive", sex AS sexo, shirt_size AS "shirtSize", pants_size AS "pantsSize", clothing_size AS "clothingSize", shoe_size AS "shoeSize", height AS altura, measurements
        `,
        [normalizedStaffId, payload.fullName, payload.cedula, cityResult.rows[0].id, categoryRecord.name, currentRow.isActive !== false, payload.sexo, sizes.shirtSize, sizes.pantsSize, sizes.clothingSize, payload.shoeSize || null, payload.altura || null, serializeStaffMeasurements(payload), payload.photo ? serializeProfilePhotoField(payload.photo) : currentRow.photo || DEFAULT_PROFILE_PHOTO],
      );

      const updatedRecord = sanitizeStaffAdminRecord({ ...result.rows[0], city: cityResult.rows[0].name });
      await this.#insertAuditLog(client, {
        actorUserId: payload.actorUserId,
        entityType: 'staff',
        entityId: normalizedStaffId,
        action: 'update',
        previousValues: previousRecord,
        newValues: updatedRecord,
      });

      await client.query('COMMIT');
      return updatedRecord;
    } catch (error) {
      await client.query('ROLLBACK');
      if (isPostgresUniqueViolation(error)) {
        return mapAdminUniqueViolation(error) || { errorCode: 'DUPLICATE_RECORD', message: DUPLICATE_STAFF_CEDULA_MESSAGE };
      }
      throw error;
    } finally {
      client.release();
    }
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
    const clients = await this.getClients();
    const result = await query(
      `
        SELECT ${EVENT_SELECT_COLUMNS},
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

    const events = result.rows.map((row) => mapEventRow(row, clients));
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
    const eventIds = events.map((event) => Number(event.id)).filter((id) => Number.isInteger(id) && id > 0);

    if (eventIds.length === 0) {
      return events.map((event) => buildEventResponse(event, {
        executiveContact: executiveContactsById.get(Number(event.createdByUserId)) || null,
      }));
    }

    const galleryResult = await query(
      `
        SELECT event_id, milestone_type, photo_url AS uri, photo_path, mime_type AS "mimeType", file_name AS "fileName", file_size AS "fileSize",
               latitude AS lat, longitude AS lon, created_by_user_id AS "createdByUserId", created_at AS "createdAt"
        FROM event_photos
        WHERE event_id = ANY($1::bigint[])
        ORDER BY created_at ASC, id ASC
      `,
      [eventIds],
    );

    const galleryByEventId = new Map();
    galleryResult.rows.forEach((row) => {
      const eventPhotos = galleryByEventId.get(Number(row.event_id)) || [];
      eventPhotos.push({
        id: `${row.milestone_type || 'photo'}-${row.event_id}-${row.createdAt || Date.now()}`,
        uri: row.uri,
        createdAt: row.createdAt,
        source: row.milestone_type || 'gallery',
        mimeType: row.mimeType,
        fileName: row.fileName,
        fileSize: row.fileSize,
        lat: row.lat,
        lon: row.lon,
        author: null,
        eventId: Number(row.event_id),
      });
      galleryByEventId.set(Number(row.event_id), eventPhotos);
    });

    return events.map((event) => buildEventResponse({
      ...event,
      photos: mergeEventPhotos(event.photos, galleryByEventId.get(Number(event.id)) || []),
    }, {
      executiveContact: executiveContactsById.get(Number(event.createdByUserId)) || null,
    }));
  }

  async getClientEvents({ userId }) {
    const normalizedUserId = Number(userId);

    if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
      return [];
    }

    const events = await this.getEvents();
    const clientProfile = await this.findClientByUserId(normalizedUserId);

    return events
      .filter((event) => Number(event.clientUserId) === normalizedUserId || (clientProfile && Number(event.clientId) === Number(clientProfile.clientId)))
      .map((event) => sanitizeEventForClient({
        event,
        executiveContact: event.executiveContact || null,
      }));
  }

  async createEvent(eventData) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const matchedClient = await this.findClientByIdentifiers({ clientId: eventData.clientId, clientUserId: eventData.clientUserId });

        const eventResult = await client.query(
          `
          INSERT INTO events (name, client, client_id, client_user_id, image, start_date, end_date, event_status, status, reports, photos, executive_report, created_by_user_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'not_started', 'Pendiente', '[]'::jsonb, '[]'::jsonb, NULL, $8)
          RETURNING id
        `,
        [eventData.name, eventData.client, matchedClient?.clientId || null, matchedClient?.userId || null, serializePhotoAssetField(eventData.image, { fallbackUri: null }), eventData.startDate, eventData.endDate, eventData.createdByUserId],
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
      const matchedClient = await this.findClientByIdentifiers({ clientId: eventData.clientId, clientUserId: eventData.clientUserId });

      const eventResult = await client.query(
        `
          UPDATE events
          SET name = $2,
              client = $3,
              client_id = $4,
              client_user_id = $5,
              image = $6,
              start_date = $7,
              end_date = $8,
              created_by_user_id = COALESCE(created_by_user_id, $9),
              event_status = COALESCE(event_status, 'not_started'),
              manual_inactivated_at = NULL,
              manual_inactivation_comment = NULL,
              manual_inactivated_by_user_id = NULL,
              updated_at = NOW()
          WHERE id = $1
          RETURNING id
        `,
        [id, eventData.name, eventData.client, matchedClient?.clientId || null, matchedClient?.userId || null, serializePhotoAssetField(eventData.image, { fallbackUri: null }), eventData.startDate, eventData.endDate, eventData.createdByUserId],
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
            start_real_at = COALESCE(start_real_at, start_date, NOW()),
            end_real_at = COALESCE(end_real_at, NOW()),
            event_status = 'finalized',
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
        SELECT ${EVENT_SELECT_COLUMNS},
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

    if (!result.rows[0]) {
      return null;
    }

    const event = mapEventRow(result.rows[0], await this.getClients());
    const galleryResult = await query(
      `
        SELECT id, event_id, milestone_type, photo_url AS uri, photo_path, mime_type AS "mimeType", file_name AS "fileName", file_size AS "fileSize",
               latitude AS lat, longitude AS lon, created_by_user_id AS "createdByUserId", created_at AS "createdAt"
        FROM event_photos
        WHERE event_id = $1
        ORDER BY created_at ASC, id ASC
      `,
      [id],
    );

    const galleryPhotos = galleryResult.rows.map((row) => ({
      id: `${row.milestone_type || 'photo'}-${row.id}`,
      uri: row.uri,
      createdAt: row.createdAt,
      source: row.milestone_type || 'gallery',
      mimeType: row.mimeType,
      fileName: row.fileName,
      fileSize: row.fileSize,
      lat: row.lat,
      lon: row.lon,
      author: null,
      eventId: Number(row.event_id),
    }));

    const executiveContactResult = await query(
      `
        SELECT id, username, full_name AS "fullName", phone, whatsapp_phone AS "whatsappPhone", email
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [Number(event.createdByUserId) || null],
    );

    return buildEventResponse({
      ...event,
      photos: mergeEventPhotos(event.photos, galleryPhotos),
    }, {
      executiveContact: normalizeExecutiveContact(executiveContactResult.rows[0] || null),
    });
  }

  async findClientByUserId(userId) {
    const normalizedUserId = Number(userId);
    if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
      return null;
    }

    const result = await query(
      `
        SELECT c.id AS "clientId", c.user_id AS "userId"
        FROM clients c
        INNER JOIN users u ON u.id = c.user_id
        WHERE c.user_id = $1 AND c.is_active = TRUE AND u.is_active = TRUE
        LIMIT 1
      `,
      [normalizedUserId],
    );

    return result.rows[0] || null;
  }

  async findClientByIdentifiers({ clientId, clientUserId }) {
    const normalizedClientId = Number(clientId);
    if (Number.isInteger(normalizedClientId) && normalizedClientId > 0) {
      const result = await query(
        'SELECT c.id AS "clientId", c.user_id AS "userId" FROM clients c INNER JOIN users u ON u.id = c.user_id WHERE c.id = $1 AND c.is_active = TRUE AND u.is_active = TRUE LIMIT 1',
        [normalizedClientId],
      );
      if (result.rows[0]) {
        return result.rows[0];
      }
    }

    return this.findClientByUserId(clientUserId);
  }

  async inactivateClient(clientId, { actorUserId }) {
    const normalizedClientId = Number(clientId);
    const currentClientResult = await query(
      `
        SELECT c.id AS "clientId", c.user_id AS "userId", c.razon_social AS "razonSocial", c.nit,
               c.contact_full_name AS "contactFullName", c.contact_role AS "contactRole",
               c.phone, c.whatsapp_phone AS "whatsappPhone", c.email, c.is_active AS "isActive",
               u.id, u.username, u.full_name AS "fullName", u.phone AS "userPhone",
               u.whatsapp_phone AS "userWhatsappPhone", u.email AS "userEmail", u.is_active AS "userIsActive"
        FROM clients c
        INNER JOIN users u ON u.id = c.user_id
        WHERE c.id = $1
        LIMIT 1
      `,
      [normalizedClientId],
    );

    if (currentClientResult.rowCount === 0) {
      return { errorCode: 'NOT_FOUND' };
    }

    const currentRow = currentClientResult.rows[0];
    const previousRecord = sanitizeClientRecord({
      client: {
        id: currentRow.clientId,
        userId: currentRow.userId,
        razonSocial: currentRow.razonSocial,
        nit: currentRow.nit,
        contactFullName: currentRow.contactFullName,
        contactRole: currentRow.contactRole,
        phone: currentRow.phone,
        whatsappPhone: currentRow.whatsappPhone,
        email: currentRow.email,
        isActive: currentRow.isActive,
      },
      user: {
        id: currentRow.id,
        username: currentRow.username,
        fullName: currentRow.fullName,
        phone: currentRow.userPhone,
        whatsappPhone: currentRow.userWhatsappPhone,
        email: currentRow.userEmail,
        isActive: currentRow.userIsActive,
      },
    });

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const userResult = await client.query(
        `
          UPDATE users
          SET is_active = FALSE,
              updated_at = NOW()
          WHERE id = $1
          RETURNING id, username, full_name AS "fullName", phone, whatsapp_phone AS "whatsappPhone", email, is_active AS "isActive"
        `,
        [currentRow.userId],
      );

      const clientResult = await client.query(
        `
          UPDATE clients
          SET is_active = FALSE,
              updated_at = NOW()
          WHERE id = $1
          RETURNING id, user_id AS "userId", razon_social AS "razonSocial", nit,
                    contact_full_name AS "contactFullName", contact_role AS "contactRole",
                    phone, whatsapp_phone AS "whatsappPhone", email, is_active AS "isActive"
        `,
        [normalizedClientId],
      );

      const updatedRecord = sanitizeClientRecord({ client: clientResult.rows[0], user: userResult.rows[0] });
      await this.#insertAuditLog(client, {
        actorUserId,
        entityType: 'client',
        entityId: normalizedClientId,
        action: 'inactivate',
        previousValues: previousRecord,
        newValues: updatedRecord,
      });

      await client.query('COMMIT');
      return updatedRecord;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async inactivateExecutive(executiveId, { actorUserId }) {
    const normalizedExecutiveId = Number(executiveId);
    const currentExecutiveResult = await query(
      `
        SELECT e.id, e.user_id AS "userId", e.full_name AS "fullName", e.cedula, e.phone, e.whatsapp_phone AS "whatsappPhone", e.email,
               e.address, ci.name AS city, e.is_active AS "isActive", u.username, u.email AS "userEmail", u.is_active AS "userIsActive"
        FROM executives e
        INNER JOIN users u ON u.id = e.user_id
        INNER JOIN roles r ON r.id = u.role_id
        LEFT JOIN cities ci ON ci.id = e.city_id
        WHERE r.code = 'EJECUTIVO'
          AND e.id = $1
        LIMIT 1
      `,
      [normalizedExecutiveId],
    );

    if (currentExecutiveResult.rowCount === 0) {
      return { errorCode: 'NOT_FOUND' };
    }

    const previousRecord = sanitizeExecutiveAdminRecord(currentExecutiveResult.rows[0]);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const userResult = await client.query(
        `
          UPDATE users
          SET is_active = FALSE,
              updated_at = NOW()
          WHERE id = $1
          RETURNING id, username, full_name AS "fullName", phone, whatsapp_phone AS "whatsappPhone", email, is_active AS "isActive"
        `,
        [currentExecutiveResult.rows[0].userId],
      );

      const executiveResult = await client.query(
        `
          UPDATE executives
          SET is_active = FALSE,
              updated_at = NOW()
          WHERE id = $1
          RETURNING id, user_id AS "userId", full_name AS "fullName", cedula, address, phone, whatsapp_phone AS "whatsappPhone", email, is_active AS "isActive"
        `,
        [normalizedExecutiveId],
      );

      const updatedRecord = sanitizeExecutiveAdminRecord({ ...executiveResult.rows[0], city: currentExecutiveResult.rows[0].city }, userResult.rows[0]);
      await this.#insertAuditLog(client, {
        actorUserId,
        entityType: 'executive',
        entityId: normalizedExecutiveId,
        action: 'inactivate',
        previousValues: previousRecord,
        newValues: updatedRecord,
      });

      await client.query('COMMIT');
      return updatedRecord;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async inactivateCoordinator(coordinatorId, { actorUserId }) {
    const normalizedCoordinatorId = Number(coordinatorId);
    const currentCoordinatorResult = await query(
      `
        SELECT c.id, c.user_id AS "userId", c.full_name AS name, c.cedula, c.address, c.phone, c.rating, c.photo, c.is_active AS "isActive", ci.name AS city,
               u.id AS "linkedUserId", u.username, u.whatsapp_phone AS "whatsappPhone", u.email, u.is_active AS "userIsActive"
        FROM coordinators c
        INNER JOIN cities ci ON ci.id = c.city_id
        LEFT JOIN users u ON u.id = c.user_id
        WHERE c.id = $1
        LIMIT 1
      `,
      [normalizedCoordinatorId],
    );

    if (currentCoordinatorResult.rowCount === 0) {
      return { errorCode: 'NOT_FOUND' };
    }

    const currentRow = currentCoordinatorResult.rows[0];
    const previousRecord = sanitizeCoordinatorAdminRecord({
      coordinator: currentRow,
      user: currentRow.linkedUserId ? {
        id: currentRow.linkedUserId,
        username: currentRow.username,
        whatsappPhone: currentRow.whatsappPhone,
        email: currentRow.email,
        isActive: currentRow.userIsActive,
      } : null,
    });

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      let updatedUser = null;
      if (currentRow.linkedUserId) {
        const userResult = await client.query(
          `
            UPDATE users
            SET is_active = FALSE,
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, username, whatsapp_phone AS "whatsappPhone", email, is_active AS "isActive"
          `,
          [currentRow.linkedUserId],
        );
        updatedUser = userResult.rows[0] || null;
      }

      const coordinatorResult = await client.query(
        `
          UPDATE coordinators
          SET is_active = FALSE,
              updated_at = NOW()
          WHERE id = $1
          RETURNING id, user_id AS "userId", full_name AS name, cedula, address, phone, rating, photo, is_active AS "isActive"
        `,
        [normalizedCoordinatorId],
      );

      const updatedRecord = sanitizeCoordinatorAdminRecord({
        coordinator: { ...coordinatorResult.rows[0], city: currentRow.city },
        user: updatedUser,
      });
      await this.#insertAuditLog(client, {
        actorUserId,
        entityType: 'coordinator',
        entityId: normalizedCoordinatorId,
        action: 'inactivate',
        previousValues: previousRecord,
        newValues: updatedRecord,
      });

      await client.query('COMMIT');
      return updatedRecord;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async inactivateStaff(staffId, { actorUserId }) {
    const normalizedStaffId = Number(staffId);
    const currentStaffResult = await query(
      `
        SELECT s.id, s.full_name AS name, s.cedula, ci.name AS city, s.category, s.photo, s.is_active AS "isActive",
               s.sex AS sexo, s.shirt_size AS "shirtSize", s.pants_size AS "pantsSize", s.clothing_size AS "clothingSize", s.shoe_size AS "shoeSize", s.measurements
        FROM staff s
        INNER JOIN cities ci ON ci.id = s.city_id
        WHERE s.id = $1
        LIMIT 1
      `,
      [normalizedStaffId],
    );

    if (currentStaffResult.rowCount === 0) {
      return { errorCode: 'NOT_FOUND' };
    }

    const previousRecord = sanitizeStaffAdminRecord(currentStaffResult.rows[0]);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const staffResult = await client.query(
        `
          UPDATE staff
          SET is_active = FALSE,
              updated_at = NOW()
          WHERE id = $1
          RETURNING id, full_name AS name, cedula, category, photo, is_active AS "isActive", sex AS sexo, shirt_size AS "shirtSize", pants_size AS "pantsSize", clothing_size AS "clothingSize", shoe_size AS "shoeSize", measurements
        `,
        [normalizedStaffId],
      );

      const updatedRecord = sanitizeStaffAdminRecord({ ...staffResult.rows[0], city: currentStaffResult.rows[0].city });
      await this.#insertAuditLog(client, {
        actorUserId,
        entityType: 'staff',
        entityId: normalizedStaffId,
        action: 'inactivate',
        previousValues: previousRecord,
        newValues: updatedRecord,
      });

      await client.query('COMMIT');
      return updatedRecord;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
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

    const eventStatus = getEventStatus(event);
    if (eventStatus !== 'active') {
      return { errorCode: eventStatus === 'not_started' ? 'EVENT_NOT_STARTED' : 'EVENT_FINALIZED' };
    }

    if (Number(event.createdByUserId) !== Number(payload.authorUserId)) {
      return false;
    }

    if (event.executiveReport?.status === 'published') {
      return { errorCode: 'EXECUTIVE_REPORT_LOCKED' };
    }

    const user = await this.findUserById(payload.authorUserId);
    const executiveReport = buildExecutiveReport({
      payload,
      user,
      existingReport: event.executiveReport,
      event,
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

    const eventStatus = getEventStatus(event);
    if (eventStatus !== 'active') {
      return { errorCode: eventStatus === 'not_started' ? 'EVENT_NOT_STARTED' : 'EVENT_FINALIZED' };
    }

    const coordinatorProfile = await this.findCoordinatorProfileByUserId(payload.authorUserId);
    if (!coordinatorProfile) {
      return false;
    }

    const executiveContact = normalizeExecutiveContact(await this.findUserById(event.createdByUserId));
    const coordinatorEvent = mapCoordinatorEvent({ event, coordinatorProfile, executiveContact });
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

  async startEvent(id, payload) {
    const event = await this.#getEventById(Number(id));
    if (!event) {
      return null;
    }

    const eventStatus = getEventStatus(event);
    if (eventStatus === 'active') {
      return { errorCode: 'EVENT_ALREADY_STARTED' };
    }

    if (eventStatus === 'finalized') {
      return { errorCode: 'EVENT_FINALIZED' };
    }

    const coordinatorProfile = await this.findCoordinatorProfileByUserId(payload.userId);
    if (!coordinatorProfile) {
      return false;
    }

    const executiveContact = normalizeExecutiveContact(await this.findUserById(event.createdByUserId));
    if (!mapCoordinatorEvent({ event, coordinatorProfile, executiveContact })) {
      return false;
    }

    const todayKey = toLocalCalendarKey(new Date());
    const startKey = toLocalCalendarKey(event.startDate);
    const endKey = toLocalCalendarKey(event.endDate);
    if (!todayKey || !startKey || !endKey || todayKey < startKey || todayKey > endKey) {
      return { errorCode: 'EVENT_OUT_OF_RANGE' };
    }

    const timestampDate = new Date(payload.timestamp || Date.now());
    if (Number.isNaN(timestampDate.getTime()) || Math.abs(Date.now() - timestampDate.getTime()) > 5 * 60 * 1000) {
      return { errorCode: 'STALE_TIMESTAMP' };
    }

    const storedPhoto = await storeEventUploadFromBuffer({
      buffer: payload.photoFile?.buffer,
      mimeType: payload.photoFile?.mimetype || payload.mimeType,
      fileName: payload.photoFile?.originalname || payload.fileName,
    });

    const milestonePhoto = buildEventMilestonePhoto({
      uri: storedPhoto.publicUrl,
      mimeType: storedPhoto.mimeType,
      fileSize: payload.fileSize,
      fileName: storedPhoto.fileName,
      user: await this.findUserById(payload.userId),
      event,
      milestoneType: 'start_photo',
      lat: payload.lat,
      lon: payload.lon,
      timestamp: payload.timestamp || new Date().toISOString(),
    });

    const photos = [...event.photos.map(normalizePhotoEntry).filter(Boolean), milestonePhoto];

    await query(
      `
        INSERT INTO event_photos (
          event_id, milestone_type, photo_url, photo_path, mime_type, file_name, file_size, latitude, longitude, created_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (event_id, milestone_type) DO UPDATE SET
          photo_url = EXCLUDED.photo_url,
          photo_path = EXCLUDED.photo_path,
          mime_type = EXCLUDED.mime_type,
          file_name = EXCLUDED.file_name,
          file_size = EXCLUDED.file_size,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          created_by_user_id = EXCLUDED.created_by_user_id,
          updated_at = NOW()
      `,
      [Number(id), 'start_photo', storedPhoto.publicUrl, storedPhoto.absolutePath, storedPhoto.mimeType, storedPhoto.fileName, storedPhoto.size, payload.lat ?? null, payload.lon ?? null, Number(payload.userId)],
    );

    await query(
      `
        UPDATE events
        SET event_status = 'active',
            start_real_at = COALESCE(start_real_at, $2::timestamptz, start_date),
            start_lat = COALESCE(start_lat, $3::numeric),
            start_lon = COALESCE(start_lon, $4::numeric),
            start_photo_url = COALESCE(start_photo_url, $5),
            photos = $6::jsonb,
            updated_at = NOW()
        WHERE id = $1
      `,
        [Number(id), milestonePhoto.createdAt, payload.lat ?? null, payload.lon ?? null, storedPhoto.publicUrl, JSON.stringify(photos)],
      );

    return this.#getEventById(Number(id));
  }

  async endEvent(id, payload) {
    const event = await this.#getEventById(Number(id));
    if (!event) {
      return null;
    }

    const eventStatus = getEventStatus(event);
    if (eventStatus === 'finalized') {
      return { errorCode: 'EVENT_FINALIZED' };
    }

    if (eventStatus !== 'active') {
      return { errorCode: 'EVENT_NOT_STARTED' };
    }

    const coordinatorProfile = await this.findCoordinatorProfileByUserId(payload.userId);
    if (!coordinatorProfile) {
      return false;
    }

    const executiveContact = normalizeExecutiveContact(await this.findUserById(event.createdByUserId));
    if (!mapCoordinatorEvent({ event, coordinatorProfile, executiveContact })) {
      return false;
    }

    const timestampDate = new Date(payload.timestamp || Date.now());
    if (Number.isNaN(timestampDate.getTime()) || Math.abs(Date.now() - timestampDate.getTime()) > 5 * 60 * 1000) {
      return { errorCode: 'STALE_TIMESTAMP' };
    }

    const storedPhoto = await storeEventUploadFromBuffer({
      buffer: payload.photoFile?.buffer,
      mimeType: payload.photoFile?.mimetype || payload.mimeType,
      fileName: payload.photoFile?.originalname || payload.fileName,
    });

    const milestonePhoto = buildEventMilestonePhoto({
      uri: storedPhoto.publicUrl,
      mimeType: storedPhoto.mimeType,
      fileSize: payload.fileSize,
      fileName: storedPhoto.fileName,
      user: await this.findUserById(payload.userId),
      event,
      milestoneType: 'end_photo',
      lat: payload.lat,
      lon: payload.lon,
      timestamp: payload.timestamp || new Date().toISOString(),
    });

    const photos = [...event.photos.map(normalizePhotoEntry).filter(Boolean), milestonePhoto];

    await query(
      `
        INSERT INTO event_photos (
          event_id, milestone_type, photo_url, photo_path, mime_type, file_name, file_size, latitude, longitude, created_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (event_id, milestone_type) DO UPDATE SET
          photo_url = EXCLUDED.photo_url,
          photo_path = EXCLUDED.photo_path,
          mime_type = EXCLUDED.mime_type,
          file_name = EXCLUDED.file_name,
          file_size = EXCLUDED.file_size,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          created_by_user_id = EXCLUDED.created_by_user_id,
          updated_at = NOW()
      `,
      [Number(id), 'end_photo', storedPhoto.publicUrl, storedPhoto.absolutePath, storedPhoto.mimeType, storedPhoto.fileName, storedPhoto.size, payload.lat ?? null, payload.lon ?? null, Number(payload.userId)],
    );

    await query(
      `
        UPDATE events
        SET event_status = 'finalized',
            start_real_at = COALESCE(start_real_at, start_date, $2::timestamptz),
            end_real_at = COALESCE(end_real_at, $2::timestamptz, end_date),
            end_lat = COALESCE(end_lat, $3::numeric),
            end_lon = COALESCE(end_lon, $4::numeric),
            end_photo_url = COALESCE(end_photo_url, $5),
            photos = $6::jsonb,
            updated_at = NOW()
        WHERE id = $1
      `,
        [Number(id), milestonePhoto.createdAt, payload.lat ?? null, payload.lon ?? null, storedPhoto.publicUrl, JSON.stringify(photos)],
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

  async #insertAuditLog(client, { actorUserId, entityType, entityId, action, previousValues, newValues }) {
    await client.query(
      `
        INSERT INTO audit_logs (actor_user_id, entity_type, entity_id, action, previous_values, new_values)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
      `,
      [Number(actorUserId) || null, entityType, Number(entityId), action, JSON.stringify(cloneAuditPayload(previousValues)), JSON.stringify(cloneAuditPayload(newValues))],
    );
  }
}

module.exports = { PostgresEventAppRepository };
