const { normalizeString } = require('./validation');

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
      author: null,
      source: 'legacy',
      startTime: null,
      endTime: null,
      initialInventory: null,
      finalInventory: null,
      observations: report,
      redemptionsCount: null,
      relevantAspects: null,
    };
  }

  if (typeof report !== 'object') {
    return null;
  }

  const content = normalizeString(report.content || report.summary || report.impact || report.observations || '');
  const title = normalizeString(report.title) || `Informe ${index + 1}`;

  return {
    ...report,
    id: normalizeString(report.id) || `report-${index + 1}`,
    title,
    content,
    createdAt: report.createdAt || report.created_at || report.date || null,
    date: report.date || report.createdAt || report.created_at || null,
    author: normalizeAuthor(report.author),
    source: normalizeString(report.source) || 'coordinator',
    startTime: report.startTime || report.start_time || null,
    endTime: report.endTime || report.end_time || null,
    initialInventory: normalizeString(report.initialInventory || report.initial_inventory || '' ) || null,
    finalInventory: normalizeString(report.finalInventory || report.final_inventory || '' ) || null,
    observations: normalizeString(report.observations || report.impact || report.content || '' ) || null,
    redemptionsCount: Number.isFinite(Number(report.redemptionsCount)) ? Number(report.redemptionsCount) : null,
    relevantAspects: normalizeString(report.relevantAspects || report.otherRelevantAspects || '' ) || null,
  };
};

const buildCoordinatorPhoto = ({ uri, coordinatorProfile, user }) => ({
  id: `photo-${Date.now()}`,
  uri,
  createdAt: new Date().toISOString(),
  source: 'coordinator',
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
  const observations = normalizeString(payload.observations);
  const relevantAspects = normalizeString(payload.relevantAspects);
  const hasRedemptions = Boolean(payload.hasRedemptions);
  const redemptionsCount = hasRedemptions ? Number(payload.redemptionsCount || 0) : 0;

  const contentParts = [
    `Inicio: ${startTime}`,
    `Finalización: ${endTime}`,
    `Inventario inicial: ${initialInventory}`,
    `Inventario final: ${finalInventory}`,
    `Impacto / observaciones: ${observations}`,
    `Redenciones: ${hasRedemptions ? redemptionsCount : 'No aplica'}`,
    `Otros aspectos relevantes: ${relevantAspects || 'Sin novedades adicionales'}`,
  ];

  return {
    id: `report-${Date.now()}`,
    title: normalizeString(payload.title) || 'Informe operativo del coordinador',
    content: contentParts.join('\n'),
    createdAt,
    date: createdAt,
    source: 'coordinator',
    author: {
      userId: Number(user?.id || coordinatorProfile?.userId || 0) || null,
      fullName: normalizeString(user?.fullName || coordinatorProfile?.name || user?.username) || 'Coordinador',
      role: 'COORDINADOR',
    },
    startTime,
    endTime,
    initialInventory,
    finalInventory,
    observations,
    hasRedemptions,
    redemptionsCount,
    relevantAspects: relevantAspects || null,
  };
};

module.exports = {
  buildCoordinatorPhoto,
  buildCoordinatorReport,
  normalizePhotoEntry,
  normalizeReportEntry,
};
