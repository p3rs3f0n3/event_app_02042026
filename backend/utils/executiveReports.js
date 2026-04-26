const { normalizeString } = require('./validation');
const { buildEventResponse } = require('./eventResponse');

const VALID_REPORT_STATUSES = new Set(['draft', 'published']);

const normalizeSelectedAssetEntries = (assets, selectedIds) => {
  const normalizedAssets = Array.isArray(assets) ? assets.filter(Boolean) : [];
  const allowedIds = new Set(selectedIds);

  return normalizedAssets.filter((asset) => allowedIds.has(normalizeString(asset?.id)));
};

const normalizeAuthor = (author) => {
  if (!author || typeof author !== 'object') {
    return null;
  }

  const userId = Number(author.userId || author.id || 0) || null;
  const fullName = normalizeString(author.fullName || author.name || author.username);
  const role = normalizeString(author.role) || 'EJECUTIVO';

  if (!userId && !fullName) {
    return null;
  }

  return {
    userId,
    fullName: fullName || null,
    role,
  };
};

const normalizeSelectedIds = (values) => (Array.isArray(values)
  ? values
    .map((value) => normalizeString(value))
    .filter(Boolean)
  : []);

const normalizeExecutiveReportEntry = (report, assets = {}) => {
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    return null;
  }

  const status = normalizeString(report.status).toLowerCase();
  const selectedPhotoIds = normalizeSelectedIds(report.selectedPhotoIds);
  const selectedPhotos = normalizeSelectedAssetEntries(report.selectedPhotos || assets.photos, selectedPhotoIds);

  return {
    id: normalizeString(report.id) || `executive-report-${Date.now()}`,
    title: normalizeString(report.title) || '',
    executiveSummary: normalizeString(report.executiveSummary || report.summary || ''),
    objectivesCompliance: normalizeString(report.objectivesCompliance || ''),
    resultsImpact: normalizeString(report.resultsImpact || report.impact || ''),
    redemptions: normalizeString(report.redemptions || ''),
    highlights: normalizeString(report.highlights || ''),
    incidents: normalizeString(report.incidents || ''),
    recommendations: normalizeString(report.recommendations || ''),
    selectedPhotoIds,
    selectedPhotos,
    selectedReportIds: normalizeSelectedIds(report.selectedReportIds),
    status: VALID_REPORT_STATUSES.has(status) ? status : 'draft',
    createdAt: report.createdAt || report.created_at || null,
    updatedAt: report.updatedAt || report.updated_at || report.createdAt || null,
    publishedAt: report.publishedAt || report.published_at || null,
    author: normalizeAuthor(report.author),
  };
};

const buildExecutiveReport = ({ payload, user, existingReport, event }) => {
  const now = new Date().toISOString();
  const normalizedExistingReport = normalizeExecutiveReportEntry(existingReport, event);
  const normalizedStatus = normalizeString(payload.status).toLowerCase();
  const status = VALID_REPORT_STATUSES.has(normalizedStatus) ? normalizedStatus : 'draft';
  const createdAt = normalizedExistingReport?.createdAt || now;
  const currentPublishedAt = normalizedExistingReport?.publishedAt || null;
  const nextPublishedAt = status === 'published' ? (currentPublishedAt || now) : null;
  const selectedPhotoIds = normalizeSelectedIds(payload.selectedPhotoIds);
  const selectedReportIds = normalizeSelectedIds(payload.selectedReportIds);
  const selectedPhotos = normalizeSelectedAssetEntries(event?.photos, selectedPhotoIds);

  return {
    id: normalizedExistingReport?.id || `executive-report-${Date.now()}`,
    title: normalizeString(payload.title),
    executiveSummary: normalizeString(payload.executiveSummary),
    objectivesCompliance: normalizeString(payload.objectivesCompliance),
    resultsImpact: normalizeString(payload.resultsImpact),
    redemptions: normalizeString(payload.redemptions),
    highlights: normalizeString(payload.highlights),
    incidents: normalizeString(payload.incidents),
    recommendations: normalizeString(payload.recommendations),
    selectedPhotoIds,
    selectedPhotos,
    selectedReportIds,
    status,
    createdAt,
    updatedAt: now,
    publishedAt: nextPublishedAt,
    author: {
      userId: Number(user?.id || payload.authorUserId || 0) || null,
      fullName: normalizeString(user?.fullName || user?.username) || 'Ejecutivo',
      role: 'EJECUTIVO',
    },
  };
};

const sanitizePublishedExecutiveReport = (report, assets = {}) => {
  const normalizedReport = normalizeExecutiveReportEntry(report, assets);

  if (!normalizedReport || normalizedReport.status !== 'published') {
    return null;
  }

  return normalizedReport;
};

const sanitizeEventForClient = ({ event, executiveContact }) => {
  const canonicalEvent = buildEventResponse(event, { executiveContact });

  return {
    ...canonicalEvent,
    reports: [],
    photos: canonicalEvent.photos,
    executiveReport: sanitizePublishedExecutiveReport(canonicalEvent.executiveReport, { photos: canonicalEvent.photos }),
  };
};

module.exports = {
  VALID_REPORT_STATUSES,
  buildExecutiveReport,
  normalizeExecutiveReportEntry,
  sanitizeEventForClient,
  sanitizePublishedExecutiveReport,
};
