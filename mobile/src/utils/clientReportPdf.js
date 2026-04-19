import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const formatDate = (value) => {
  if (!value) {
    return 'Sin fecha';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Sin fecha';
  }

  return date.toLocaleString('es-ES');
};

const renderSection = (title, body) => `
  <div class="section">
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(body || 'Sin información registrada.')}</p>
  </div>
`;

const renderPhotoGrid = (photos) => {
  if (!Array.isArray(photos) || photos.length === 0) {
    return '<p>No hay fotos seleccionadas para este informe.</p>';
  }

  return `
    <div class="photos-grid">
      ${photos.map((photo, index) => `
        <div class="photo-card">
          <img src="${escapeHtml(photo.uri)}" alt="Foto ${index + 1}" />
          <div class="caption">${escapeHtml(photo.author?.fullName || 'Coordinación')}</div>
        </div>
      `).join('')}
    </div>
  `;
};

const buildClientReportHtml = ({ event, report, points }) => `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body {
          font-family: Arial, sans-serif;
          color: #111827;
          padding: 24px;
          font-size: 12px;
          line-height: 1.5;
        }
        h1, h2, h3 {
          margin: 0 0 8px 0;
        }
        h1 {
          font-size: 24px;
        }
        h2 {
          font-size: 18px;
          margin-top: 24px;
        }
        h3 {
          font-size: 14px;
          margin-top: 16px;
        }
        .muted {
          color: #6b7280;
        }
        .summary, .section {
          margin-top: 16px;
          padding: 16px;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          background: #f8fafc;
        }
        .summary-row {
          margin: 4px 0;
        }
        .photos-grid {
          margin-top: 16px;
        }
        .photo-card {
          page-break-inside: avoid;
          margin-bottom: 18px;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          overflow: hidden;
        }
        .photo-card img {
          display: block;
          width: 100%;
          max-height: 360px;
          object-fit: cover;
          background: #e5e7eb;
        }
        .caption {
          padding: 10px 12px;
          color: #475569;
          font-size: 11px;
        }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(report.title || event.name || 'Informe del evento')}</h1>
      <p class="muted">Publicado: ${escapeHtml(formatDate(report.publishedAt))}</p>

      <div class="summary">
        <h2>Resumen del evento</h2>
        <div class="summary-row"><strong>Evento:</strong> ${escapeHtml(event.name)}</div>
        <div class="summary-row"><strong>Cliente:</strong> ${escapeHtml(event.client)}</div>
        <div class="summary-row"><strong>Inicio:</strong> ${escapeHtml(formatDate(event.startDate))}</div>
        <div class="summary-row"><strong>Fin:</strong> ${escapeHtml(formatDate(event.endDate))}</div>
        <div class="summary-row"><strong>Ciudades:</strong> ${escapeHtml(event.cities?.length || 0)}</div>
        <div class="summary-row"><strong>Puntos operativos:</strong> ${escapeHtml(points || 0)}</div>
        <div class="summary-row"><strong>Ejecutivo:</strong> ${escapeHtml(event.executive?.name || event.executive?.fullName || 'No informado')}</div>
        <div class="summary-row"><strong>Email ejecutivo:</strong> ${escapeHtml(event.executive?.email || 'Sin email')}</div>
      </div>

      ${renderSection('Resumen ejecutivo', report.executiveSummary)}
      ${renderSection('Cumplimiento de objetivos', report.objectivesCompliance)}
      ${renderSection('Resultados / impacto', report.resultsImpact)}
      ${renderSection('Redenciones', report.redemptions)}
      ${renderSection('Hallazgos / highlights', report.highlights)}
      ${renderSection('Incidentes', report.incidents)}
      ${renderSection('Recomendaciones', report.recommendations)}

      <h2>Fotos seleccionadas por el ejecutivo</h2>
      ${renderPhotoGrid(report.selectedPhotos)}
    </body>
  </html>
`;

export const shareClientReportPdf = async ({ event, report, points }) => {
  const html = buildClientReportHtml({ event, report, points });
  const { uri } = await Print.printToFileAsync({ html });

  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('La opción para compartir o guardar PDF no está disponible en este dispositivo.');
  }

  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: `${event?.name || 'informe'}-cliente.pdf`,
    UTI: '.pdf',
  });

  return uri;
};
