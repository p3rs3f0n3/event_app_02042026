const toTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '');

export const normalizePhotoItem = (photo, index = 0) => {
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

  const uri = toTrimmedString(photo.uri || photo.url || photo.photoUrl || photo.src);
  if (!uri) {
    return null;
  }

  return {
    ...photo,
    id: toTrimmedString(photo.id) || `photo-${index + 1}`,
    uri,
    createdAt: photo.createdAt || photo.created_at || null,
    author: photo.author || null,
    source: toTrimmedString(photo.source) || 'coordinator',
  };
};

export const normalizePhotos = (photos) => (Array.isArray(photos) ? photos.map(normalizePhotoItem).filter(Boolean) : []);

export const normalizeReportItem = (report, index = 0) => {
  if (!report) {
    return null;
  }

  if (typeof report === 'string') {
    return {
      id: `report-${index + 1}`,
      title: `Informe ${index + 1}`,
      content: report,
      createdAt: null,
      date: null,
      author: null,
      source: 'legacy',
      startTime: null,
      endTime: null,
      initialInventory: null,
      finalInventory: null,
      observations: report,
      redemptionsCount: null,
      relevantAspects: null,
      hasRedemptions: null,
    };
  }

  if (typeof report !== 'object') {
    return null;
  }

  return {
    ...report,
    id: toTrimmedString(report.id) || `report-${index + 1}`,
    title: toTrimmedString(report.title) || `Informe ${index + 1}`,
    content: toTrimmedString(report.content || report.summary || report.observations || ''),
    createdAt: report.createdAt || report.created_at || report.date || null,
    date: report.date || report.createdAt || report.created_at || null,
    author: report.author || null,
    source: toTrimmedString(report.source) || 'coordinator',
    startTime: report.startTime || report.start_time || null,
    endTime: report.endTime || report.end_time || null,
    initialInventory: report.initialInventory || report.initial_inventory || null,
    finalInventory: report.finalInventory || report.final_inventory || null,
    observations: report.observations || report.impact || report.content || null,
    redemptionsCount: Number.isFinite(Number(report.redemptionsCount)) ? Number(report.redemptionsCount) : null,
    relevantAspects: report.relevantAspects || report.otherRelevantAspects || null,
    hasRedemptions: typeof report.hasRedemptions === 'boolean' ? report.hasRedemptions : null,
  };
};

export const normalizeReports = (reports) => (Array.isArray(reports) ? reports.map(normalizeReportItem).filter(Boolean) : []);
