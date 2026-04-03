const toTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '');

export const normalizeExecutiveReport = (report) => {
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    return null;
  }

  const status = toTrimmedString(report.status).toLowerCase();

  return {
    id: toTrimmedString(report.id) || `executive-report-${Date.now()}`,
    title: toTrimmedString(report.title),
    executiveSummary: toTrimmedString(report.executiveSummary || report.summary),
    objectivesCompliance: toTrimmedString(report.objectivesCompliance),
    resultsImpact: toTrimmedString(report.resultsImpact || report.impact),
    redemptions: toTrimmedString(report.redemptions),
    highlights: toTrimmedString(report.highlights),
    incidents: toTrimmedString(report.incidents),
    recommendations: toTrimmedString(report.recommendations),
    selectedPhotoIds: Array.isArray(report.selectedPhotoIds) ? report.selectedPhotoIds.map((item) => toTrimmedString(item)).filter(Boolean) : [],
    selectedReportIds: Array.isArray(report.selectedReportIds) ? report.selectedReportIds.map((item) => toTrimmedString(item)).filter(Boolean) : [],
    status: status || 'draft',
    createdAt: report.createdAt || report.created_at || null,
    updatedAt: report.updatedAt || report.updated_at || null,
    publishedAt: report.publishedAt || report.published_at || null,
    author: report.author || null,
  };
};

export const createExecutiveReportDraft = (report) => {
  const normalized = normalizeExecutiveReport(report);

  return {
    title: normalized?.title || '',
    executiveSummary: normalized?.executiveSummary || '',
    objectivesCompliance: normalized?.objectivesCompliance || '',
    resultsImpact: normalized?.resultsImpact || '',
    redemptions: normalized?.redemptions || '',
    highlights: normalized?.highlights || '',
    incidents: normalized?.incidents || '',
    recommendations: normalized?.recommendations || '',
    selectedPhotoIds: normalized?.selectedPhotoIds || [],
    selectedReportIds: normalized?.selectedReportIds || [],
    status: normalized?.status || 'draft',
  };
};
