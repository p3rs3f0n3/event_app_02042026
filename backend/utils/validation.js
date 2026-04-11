const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');
const normalizeEmail = (value) => normalizeString(value).toLowerCase();
const normalizePhoneDigits = (value) => String(value || '').replace(/\D/g, '');
const isValidDateValue = (value) => !Number.isNaN(new Date(value).getTime());
const isValidIdValue = (value) => Number.isInteger(Number(value)) && Number(value) > 0;
const isValidEmail = (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const STAFF_MEASUREMENT_PATTERN = /^\d{1,3}([.,]\d{1,2})?$/;
const STAFF_SIZE_PATTERN = /^[A-Za-z0-9./\-\s]{1,10}$/;
const MAX_COORDINATOR_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_COORDINATOR_PHOTO_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const validateLoginPayload = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return 'Payload de login inválido';
  }

  if (!isNonEmptyString(payload.username) || !isNonEmptyString(payload.password)) {
    return 'Usuario y contraseña son requeridos';
  }

  return null;
};

const validateChangePasswordPayload = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return 'Payload de cambio de contraseña inválido';
  }

  if (!isValidIdValue(payload.userId)) {
    return 'El usuario es requerido';
  }

  if (!isNonEmptyString(payload.currentPassword)) {
    return 'La contraseña actual es obligatoria';
  }

  if (!isNonEmptyString(payload.newPassword)) {
    return 'La nueva contraseña es obligatoria';
  }

  return null;
};

const validateEventPayload = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return 'Payload de evento inválido';
  }

  const { name, client, clientUserId, startDate, endDate, image, cities, createdByUserId } = payload;

  if (!isNonEmptyString(name)) return 'El nombre del evento es requerido';
  if (!isNonEmptyString(client)) return 'El cliente es requerido';
  if (!isValidIdValue(clientUserId)) return 'Debes seleccionar un cliente válido';
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
      const normalizedPointPhone = normalizePhoneDigits(point.phone);
      if (normalizedPointPhone !== String(point.phone).trim()) return 'El teléfono del punto solo puede contener números';
      if (normalizedPointPhone.length > 10) return 'El teléfono del punto no puede superar 10 dígitos';
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

const validateCoordinatorPhotoPayload = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return 'Payload de foto inválido';
  }

  if (!isValidIdValue(payload.authorUserId)) {
    return 'El autor de la foto es requerido';
  }

  if (!isNonEmptyString(payload.uri)) {
    return 'La foto del evento es requerida';
  }

  const normalizedUri = normalizeString(payload.uri);
  const isAllowedUri = normalizedUri.startsWith('http://')
    || normalizedUri.startsWith('https://')
    || normalizedUri.startsWith('data:image/');

  if (!isAllowedUri) {
    return 'La foto debe ser una URL válida o una imagen en base64';
  }

   const normalizedMimeType = normalizeString(payload.mimeType).toLowerCase();
   if (normalizedMimeType && !ALLOWED_COORDINATOR_PHOTO_MIME_TYPES.has(normalizedMimeType)) {
    return 'Formato de foto no soportado. Usa JPG, PNG, WEBP o HEIC';
   }

   if (payload.fileSize != null) {
    const fileSize = Number(payload.fileSize);
    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      return 'El tamaño de la foto es inválido';
    }

    if (fileSize > MAX_COORDINATOR_PHOTO_SIZE_BYTES) {
      return 'La foto supera el límite de 10 MB';
    }
   }

  return null;
};

const validateOptionalAdminPhotoPayload = (payload) => {
  if (payload == null) {
    return null;
  }

  if (typeof payload !== 'object' || Array.isArray(payload)) {
    return 'La foto debe enviarse como objeto válido';
  }

  if (!isNonEmptyString(payload.uri)) {
    return 'La foto debe incluir una uri válida';
  }

  const normalizedUri = normalizeString(payload.uri);
  const isAllowedUri = normalizedUri.startsWith('http://')
    || normalizedUri.startsWith('https://')
    || normalizedUri.startsWith('data:image/');

  if (!isAllowedUri) {
    return 'La foto debe ser una URL válida o una imagen en base64';
  }

  const normalizedMimeType = normalizeString(payload.mimeType).toLowerCase();
  if (normalizedMimeType && !ALLOWED_COORDINATOR_PHOTO_MIME_TYPES.has(normalizedMimeType)) {
    return 'Formato de foto no soportado. Usa JPG, PNG, WEBP o HEIC';
  }

  if (payload.fileSize != null) {
    const fileSize = Number(payload.fileSize);
    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      return 'El tamaño de la foto es inválido';
    }

    if (fileSize > MAX_COORDINATOR_PHOTO_SIZE_BYTES) {
      return 'La foto supera el límite de 10 MB';
    }
  }

  return null;
};

const validateCoordinatorReportPayload = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return 'Payload de informe inválido';
  }

  if (!isValidIdValue(payload.authorUserId)) {
    return 'El autor del informe es requerido';
  }

  if (!isNonEmptyString(payload.startTime) || !isNonEmptyString(payload.endTime)) {
    return 'La hora de inicio y finalización son obligatorias';
  }

  if (!isNonEmptyString(payload.initialInventory) || !isNonEmptyString(payload.finalInventory)) {
    return 'El inventario inicial y final son obligatorios';
  }

  if (!isNonEmptyString(payload.observations)) {
    return 'Las observaciones del evento son obligatorias';
  }

  if (payload.hasRedemptions && (!Number.isInteger(Number(payload.redemptionsCount)) || Number(payload.redemptionsCount) < 0)) {
    return 'La cantidad de redenciones debe ser un número igual o mayor a cero';
  }

  return null;
};

const validateExecutiveReportPayload = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return 'Payload de informe final inválido';
  }

  if (!isValidIdValue(payload.authorUserId)) {
    return 'El autor del informe final es requerido';
  }

  const status = normalizeString(payload.status).toLowerCase();
  if (!['draft', 'published'].includes(status)) {
    return 'El estado del informe final debe ser draft o published';
  }

  if (payload.selectedPhotoIds != null && !Array.isArray(payload.selectedPhotoIds)) {
    return 'Las fotos seleccionadas deben enviarse como lista';
  }

  if (payload.selectedReportIds != null && !Array.isArray(payload.selectedReportIds)) {
    return 'Los reportes seleccionados deben enviarse como lista';
  }

  if (status === 'published') {
    const requiredFields = [
      ['title', 'El título del informe final es obligatorio'],
      ['executiveSummary', 'El resumen ejecutivo es obligatorio'],
      ['objectivesCompliance', 'El cumplimiento de objetivos es obligatorio'],
      ['resultsImpact', 'Los resultados / impacto son obligatorios'],
      ['redemptions', 'Las redenciones o la aclaración correspondiente son obligatorias'],
      ['highlights', 'Los hallazgos o highlights son obligatorios'],
      ['incidents', 'Los incidentes son obligatorios'],
      ['recommendations', 'Las recomendaciones son obligatorias'],
    ];

    for (const [fieldName, message] of requiredFields) {
      if (!isNonEmptyString(payload[fieldName])) {
        return message;
      }
    }
  }

  return null;
};

const validateAdminPhoneField = ({ value, label, required = false }) => {
  const normalizedValue = normalizeString(value);
  const normalizedDigits = normalizePhoneDigits(normalizedValue);

  if (!normalizedValue) {
    return required ? `El ${label} es obligatorio` : null;
  }

  if (normalizedDigits !== normalizedValue) {
    return `El ${label} solo puede contener números`;
  }

  if (normalizedDigits.length > 10) {
    return `El ${label} no puede superar 10 dígitos`;
  }

  return null;
};

const validateAdminClientBasePayload = (payload, { requirePassword }) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return 'Payload de cliente inválido';
  }

  if (!isNonEmptyString(payload.username)) return 'El usuario es obligatorio';
  if (requirePassword && !isNonEmptyString(payload.password)) return 'La contraseña es obligatoria';
  if (!isNonEmptyString(payload.razonSocial)) return 'La razón social es obligatoria';
  if (!isNonEmptyString(payload.nit)) return 'El NIT es obligatorio';
  if (!isNonEmptyString(payload.contactFullName)) return 'El nombre del contacto es obligatorio';
  if (!isNonEmptyString(payload.contactRole)) return 'El cargo del contacto es obligatorio';
  if (!isValidIdValue(payload.actorUserId)) return 'El actor administrativo es obligatorio';

  const phoneError = validateAdminPhoneField({ value: payload.phone, label: 'número celular', required: true });
  if (phoneError) return phoneError;

  const whatsappPhoneError = validateAdminPhoneField({ value: payload.whatsappPhone, label: 'WhatsApp', required: requirePassword });
  if (whatsappPhoneError) return whatsappPhoneError;

  const email = normalizeEmail(payload.email);
  if (requirePassword && !email) return 'El email es obligatorio';
  if (email && !isValidEmail(email)) return 'El email no es válido';

  return null;
};

const validateAdminClientPayload = (payload) => validateAdminClientBasePayload(payload, { requirePassword: true });
const validateAdminClientUpdatePayload = (payload) => validateAdminClientBasePayload(payload, { requirePassword: false });

const validateAdminCoordinatorPayload = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return 'Payload de coordinador inválido';
  }

  if (!isNonEmptyString(payload.username)) return 'El usuario es obligatorio';
  if (!isNonEmptyString(payload.password)) return 'La contraseña es obligatoria';
  if (!isNonEmptyString(payload.fullName)) return 'El nombre completo es obligatorio';
  if (!isNonEmptyString(payload.cedula)) return 'La cédula es obligatoria';
  if (!isNonEmptyString(payload.address)) return 'La dirección es obligatoria';
  if (!isNonEmptyString(payload.city)) return 'La ciudad es obligatoria';
  if (!isValidIdValue(payload.actorUserId)) return 'El actor administrativo es obligatorio';

  const phoneError = validateAdminPhoneField({ value: payload.phone, label: 'teléfono', required: true });
  if (phoneError) return phoneError;

  const whatsappPhoneError = validateAdminPhoneField({ value: payload.whatsappPhone, label: 'WhatsApp', required: true });
  if (whatsappPhoneError) return whatsappPhoneError;

  const email = normalizeEmail(payload.email);
  if (!email) return 'El email es obligatorio';
  if (email && !isValidEmail(email)) return 'El email no es válido';

  return null;
};

const validateAdminCoordinatorUpdatePayload = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return 'Payload de coordinador inválido';
  }

  if (!isNonEmptyString(payload.fullName)) return 'El nombre completo es obligatorio';
  if (!isNonEmptyString(payload.cedula)) return 'La cédula es obligatoria';
  if (!isNonEmptyString(payload.address)) return 'La dirección es obligatoria';
  if (!isNonEmptyString(payload.city)) return 'La ciudad es obligatoria';
  if (!isValidIdValue(payload.actorUserId)) return 'El actor administrativo es obligatorio';

  const phoneError = validateAdminPhoneField({ value: payload.phone, label: 'teléfono', required: true });
  if (phoneError) return phoneError;

  const whatsappPhoneError = validateAdminPhoneField({ value: payload.whatsappPhone, label: 'WhatsApp' });
  if (whatsappPhoneError) return whatsappPhoneError;

  const email = normalizeEmail(payload.email);
  if (email && !isValidEmail(email)) return 'El email no es válido';

  return null;
};

const validateStaffMeasurementField = ({ value, label, required = false }) => {
  const normalizedValue = normalizeString(value);

  if (!normalizedValue) {
    return required ? `El ${label} es obligatorio` : null;
  }

  if (!STAFF_MEASUREMENT_PATTERN.test(normalizedValue)) {
    return `El ${label} debe ser una medida simple válida`;
  }

  return null;
};

const validateStaffSizeField = ({ value, label }) => {
  const normalizedValue = normalizeString(value);

  if (!normalizedValue) {
    return null;
  }

  if (!STAFF_SIZE_PATTERN.test(normalizedValue)) {
    return `La ${label} debe ser un valor corto válido`;
  }

  return null;
};

const validateAdminStaffBasePayload = (payload) => {
  const normalizedSexo = normalizeString(payload?.sexo).toLowerCase();

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return 'Payload de staff inválido';
  }

  if (!isNonEmptyString(payload.fullName)) return 'El nombre completo es obligatorio';
  if (!isNonEmptyString(payload.cedula)) return 'La cédula es obligatoria';
  if (!isNonEmptyString(payload.city)) return 'La ciudad es obligatoria';
  if (!isNonEmptyString(payload.category)) return 'La categoría es obligatoria';
  if (!isValidIdValue(payload.actorUserId)) return 'El actor administrativo es obligatorio';
  if (!['mujer', 'hombre'].includes(normalizedSexo)) return 'El sexo debe ser mujer u hombre';

  const photoError = validateOptionalAdminPhotoPayload(payload.photo);
  if (photoError) return photoError;

  const shirtSizeError = validateStaffSizeField({ value: payload.shirtSize, label: 'talla de camisa' });
  if (shirtSizeError) return shirtSizeError;

  const pantsSizeError = validateStaffSizeField({ value: payload.pantsSize, label: 'talla de pantalón' });
  if (pantsSizeError) return pantsSizeError;

  const clothingSizeError = validateStaffSizeField({ value: payload.clothingSize, label: 'talla de ropa' });
  if (clothingSizeError) return clothingSizeError;

  const shoeSizeError = validateStaffSizeField({ value: payload.shoeSize, label: 'talla de calzado' });
  if (shoeSizeError) return shoeSizeError;

  const heightError = validateStaffSizeField({ value: payload.altura, label: 'altura' });
  if (heightError) return heightError;

  if (normalizedSexo === 'mujer') {
    const bustoError = validateStaffMeasurementField({ value: payload.busto, label: 'busto', required: true });
    if (bustoError) return bustoError;

    const cinturaError = validateStaffMeasurementField({ value: payload.cintura, label: 'cintura', required: true });
    if (cinturaError) return cinturaError;

    const caderaError = validateStaffMeasurementField({ value: payload.cadera, label: 'cadera', required: true });
    if (caderaError) return caderaError;
  }

  return null;
};

const validateAdminStaffPayload = (payload) => {
  return validateAdminStaffBasePayload(payload);
};

const validateAdminStaffUpdatePayload = (payload) => {
  return validateAdminStaffBasePayload(payload);
};

const validateAdminEntityInactivationPayload = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return 'Payload de inactivación inválido';
  }

  if (!isValidIdValue(payload.actorUserId)) return 'El actor administrativo es obligatorio';

  return null;
};

module.exports = {
  ALLOWED_COORDINATOR_PHOTO_MIME_TYPES,
  MAX_COORDINATOR_PHOTO_SIZE_BYTES,
  badRequest: (res, message) => res.status(400).json({ message }),
  normalizeString,
  normalizePhoneDigits,
  validateAdminClientPayload,
  validateAdminClientUpdatePayload,
  validateAdminCoordinatorPayload,
  validateAdminCoordinatorUpdatePayload,
  validateAdminEntityInactivationPayload,
  validateAdminStaffPayload,
  validateAdminStaffUpdatePayload,
  validateOptionalAdminPhotoPayload,
  validateCoordinatorPhotoPayload,
  validateCoordinatorReportPayload,
  validateChangePasswordPayload,
  validateExecutiveReportPayload,
  validateLoginPayload,
  validateManualInactivationPayload,
  validateEventPayload,
};
