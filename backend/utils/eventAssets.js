const { normalizeString } = require('./validation');

const COORDINATOR_REPORT_TIME_TOLERANCE_MINUTES = 5;

const normalizeAuthor = (author) => {
  if (!author || typeof author !== 'object') {
    return null;
  }

  const userId = Number(author.userId || author.id || 0) || null;
  const role = normalizeString(author.role) || 'COORDINADOR';
  const fullName = normalizeString(author.fullName || author.name || author.username);

  if (!userId && !fullName) {
    return null;
  }

  return {
    userId,
    fullName: fullName || null,
    role,
  };
};

const normalizePhotoEntry = (photo, index = 0) => {
  if (!photo) {
    return null;
  }

  if (typeof photo === 'string') {
    return {
      id: `photo-${index + 1}`,
      uri: photo,
      createdAt: null,
      author: null,
      source: 'legacy',
    };
  }

  if (typeof photo !== 'object') {
    return null;
  }

  const uri = normalizeString(photo.uri || photo.url || photo.photoUrl || photo.src);
  if (!uri) {
    return null;
  }

  return {
    ...photo,
    id: normalizeString(photo.id) || `photo-${index + 1}`,
    uri,
    createdAt: photo.createdAt || photo.created_at || null,
    author: normalizeAuthor(photo.author),
    mimeType: normalizeString(photo.mimeType || photo.mime_type || '') || null,
    fileName: normalizeString(photo.fileName || photo.file_name || '') || null,
    fileSize: Number.isFinite(Number(photo.fileSize)) ? Number(photo.fileSize) : null,
    source: normalizeString(photo.source) || 'coordinator',
  };
};

const normalizeReportEntry = (report, index = 0) => {
  if (!report) {
    return null;
  }

  if (typeof report === 'string') {
    return {
      id: `report-${index + 1}`,
      title: `Informe ${index + 1}`,
      content: report,
      createdAt: null,
      submittedAt: null,
      author: null,
      source: 'legacy',
      status: 'submitted',
      isSubmitted: true,
      startTime: null,
      endTime: null,
      initialInventory: null,
      finalInventory: null,
      directImpact: null,
      indirectImpact: null,
      observations: report,
      redemptionsCount: null,
      relevantAspects: null,
    };
  }

  if (typeof report !== 'object') {
    return null;
  }

  const directImpact = Number.isFinite(Number(report.directImpact)) ? Number(report.directImpact) : null;
  const indirectImpact = Number.isFinite(Number(report.indirectImpact)) ? Number(report.indirectImpact) : null;
  const content = normalizeString(report.content || report.summary || report.impact || report.observations || '');
  const title = normalizeString(report.title) || `Informe ${index + 1}`;

  return {
    ...report,
    id: normalizeString(report.id) || `report-${index + 1}`,
    title,
    content,
    createdAt: report.createdAt || report.created_at || report.date || null,
    submittedAt: report.submittedAt || report.submitted_at || report.createdAt || report.created_at || report.date || null,
    date: report.date || report.createdAt || report.created_at || null,
    author: normalizeAuthor(report.author),
    source: normalizeString(report.source) || 'coordinator',
    status: normalizeString(report.status) || (typeof report.isSubmitted === 'boolean' ? (report.isSubmitted ? 'submitted' : 'draft') : 'submitted'),
    isSubmitted: typeof report.isSubmitted === 'boolean' ? report.isSubmitted : true,
    startTime: report.startTime || report.start_time || null,
    endTime: report.endTime || report.end_time || null,
    initialInventory: normalizeString(report.initialInventory || report.initial_inventory || '' ) || null,
    finalInventory: normalizeString(report.finalInventory || report.final_inventory || '' ) || null,
    directImpact,
    indirectImpact,
    observations: normalizeString(report.observations || report.impact || report.content || '' ) || null,
    redemptionsCount: Number.isFinite(Number(report.redemptionsCount)) ? Number(report.redemptionsCount) : null,
    relevantAspects: normalizeString(report.relevantAspects || report.otherRelevantAspects || '' ) || null,
  };
};

const buildCoordinatorPhoto = ({ uri, mimeType, fileSize, fileName, coordinatorProfile, user }) => ({
  id: `photo-${Date.now()}`,
  uri,
  createdAt: new Date().toISOString(),
  source: 'coordinator',
  mimeType: normalizeString(mimeType) || null,
  fileName: normalizeString(fileName) || null,
  fileSize: Number.isFinite(Number(fileSize)) ? Number(fileSize) : null,
  author: {
    userId: Number(user?.id || coordinatorProfile?.userId || 0) || null,
    fullName: normalizeString(user?.fullName || coordinatorProfile?.name || user?.username) || 'Coordinador',
    role: 'COORDINADOR',
  },
});

const buildCoordinatorReport = ({ payload, coordinatorProfile, user }) => {
  const createdAt = new Date().toISOString();
  const startTime = payload.startTime;
  const endTime = payload.endTime;
  const initialInventory = normalizeString(payload.initialInventory);
  const finalInventory = normalizeString(payload.finalInventory);
  const directImpact = Number.isFinite(Number(payload.directImpact)) ? Number(payload.directImpact) : 0;
  const indirectImpact = Number.isFinite(Number(payload.indirectImpact)) ? Number(payload.indirectImpact) : 0;
  const relevantAspects = normalizeString(payload.relevantAspects);
  const hasRedemptions = Boolean(payload.hasRedemptions);
  const redemptionsCount = hasRedemptions ? Number(payload.redemptionsCount || 0) : 0;

  const contentParts = [
    `Inicio: ${startTime}`,
    `Finalización: ${endTime}`,
    `Inventario inicial: ${initialInventory}`,
    `Inventario final: ${finalInventory}`,
    `Impacto directo: ${directImpact}`,
    `Impacto indirecto: ${indirectImpact}`,
    `Redenciones: ${hasRedemptions ? redemptionsCount : 'No aplica'}`,
    `Otros aspectos relevantes: ${relevantAspects || 'Sin novedades adicionales'}`,
  ];

  return {
    id: `report-${Date.now()}`,
    title: normalizeString(payload.title) || 'Informe operativo del coordinador',
    content: contentParts.join('\n'),
    createdAt,
    submittedAt: createdAt,
    date: createdAt,
    source: 'coordinator',
    status: 'submitted',
    isSubmitted: true,
    author: {
      userId: Number(user?.id || coordinatorProfile?.userId || 0) || null,
      fullName: normalizeString(user?.fullName || coordinatorProfile?.name || user?.username) || 'Coordinador',
      role: 'COORDINADOR',
    },
    startTime,
    endTime,
    initialInventory,
    finalInventory,
    directImpact,
    indirectImpact,
    observations: null,
    hasRedemptions,
    redemptionsCount,
    relevantAspects: relevantAspects || null,
  };
};

const parseMeridiemTimeToMinutes = (value) => {
  const normalizedValue = normalizeString(value)
    .replace(/\u00A0/g, ' ')
    .replace(/a\.\s*m\./i, 'AM')
    .replace(/p\.\s*m\./i, 'PM')
    .replace(/a\.m\./i, 'AM')
    .replace(/p\.m\./i, 'PM');
  const match = normalizedValue.match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3].toUpperCase();
  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
    return null;
  }

  let normalizedHours = hours % 12;
  if (period === 'PM') {
    normalizedHours += 12;
  }

  return (normalizedHours * 60) + minutes;
};

const validateCoordinatorReportTimeRange = ({ event, startTime, endTime }) => {
  const startMinutes = parseMeridiemTimeToMinutes(startTime);
  const endMinutes = parseMeridiemTimeToMinutes(endTime);
  if (startMinutes === null || endMinutes === null) {
    return 'La hora de inicio y finalización deben tener formato de hora válido';
  }
  if (startMinutes === endMinutes) {
    return 'La hora de finalización debe ser distinta a la hora de inicio';
  }

  const durationMinutes = endMinutes > startMinutes ? (endMinutes - startMinutes) : (1440 - startMinutes) + endMinutes;
  if (durationMinutes <= 0 || durationMinutes > 1440) {
    return 'El bloque horario del informe no puede superar 24 horas';
  }

  return null;
};

module.exports = {
  buildCoordinatorPhoto,
  buildCoordinatorReport,
  normalizePhotoEntry,
  parseMeridiemTimeToMinutes,
  normalizeReportEntry,
  validateCoordinatorReportTimeRange,
};
