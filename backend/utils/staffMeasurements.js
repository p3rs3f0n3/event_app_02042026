const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizeStaffSexo = (value) => {
  const normalizedValue = normalizeText(value).toLowerCase();

  if (!normalizedValue) {
    return null;
  }

  if (['mujer', 'femenino', 'female', 'f'].includes(normalizedValue)) {
    return 'mujer';
  }

  if (['hombre', 'masculino', 'male', 'm'].includes(normalizedValue)) {
    return 'hombre';
  }

  return null;
};

const normalizeMeasurementValue = (value) => {
  const normalizedValue = normalizeText(value);
  return normalizedValue || null;
};

const isLegacyEmptyMeasurement = (value) => {
  const normalizedValue = normalizeText(value).toLowerCase();
  return !normalizedValue || ['n/a', 'na', 'no aplica', 'sin dato', 'ninguna'].includes(normalizedValue);
};

const buildLegacyMeasurementSummary = ({ busto, cintura, cadera }) => {
  if (!busto || !cintura || !cadera) {
    return null;
  }

  return `${busto}-${cintura}-${cadera}`;
};

const parseLegacyMeasurementSummary = (value) => {
  const normalizedValue = normalizeText(value);
  if (!normalizedValue || isLegacyEmptyMeasurement(normalizedValue)) {
    return null;
  }

  const parts = normalizedValue
    .split(/[-/x]/i)
    .map((part) => normalizeMeasurementValue(part))
    .filter(Boolean);

  if (parts.length !== 3) {
    return null;
  }

  return {
    busto: parts[0],
    cintura: parts[1],
    cadera: parts[2],
  };
};

const normalizeStructuredMeasurements = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const busto = normalizeMeasurementValue(value.busto || value.bust || value.pecho);
  const cintura = normalizeMeasurementValue(value.cintura || value.waist);
  const cadera = normalizeMeasurementValue(value.cadera || value.hip || value.hips);

  if (!busto && !cintura && !cadera) {
    return null;
  }

  return {
    busto,
    cintura,
    cadera,
  };
};

const deserializeStaffMeasurements = (value) => {
  if (!value) {
    return {
      busto: null,
      cintura: null,
      cadera: null,
      legacyMeasurements: null,
      isStructured: false,
    };
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    const parsedObject = normalizeStructuredMeasurements(value);
    return {
      busto: parsedObject?.busto || null,
      cintura: parsedObject?.cintura || null,
      cadera: parsedObject?.cadera || null,
      legacyMeasurements: buildLegacyMeasurementSummary(parsedObject || {}),
      isStructured: Boolean(parsedObject),
    };
  }

  const normalizedValue = normalizeText(value);
  if (!normalizedValue) {
    return {
      busto: null,
      cintura: null,
      cadera: null,
      legacyMeasurements: null,
      isStructured: false,
    };
  }

  if (normalizedValue.startsWith('{')) {
    try {
      return deserializeStaffMeasurements(JSON.parse(normalizedValue));
    } catch (error) {
      return {
        busto: null,
        cintura: null,
        cadera: null,
        legacyMeasurements: normalizedValue,
        isStructured: false,
      };
    }
  }

  const legacyMeasurements = parseLegacyMeasurementSummary(normalizedValue);
  return {
    busto: legacyMeasurements?.busto || null,
    cintura: legacyMeasurements?.cintura || null,
    cadera: legacyMeasurements?.cadera || null,
    legacyMeasurements: isLegacyEmptyMeasurement(normalizedValue) ? null : normalizedValue,
    isStructured: false,
  };
};

const serializeStaffMeasurements = ({ sexo, busto, cintura, cadera, measurements }) => {
  const normalizedSexo = normalizeStaffSexo(sexo);
  const normalizedBusto = normalizeMeasurementValue(busto);
  const normalizedCintura = normalizeMeasurementValue(cintura);
  const normalizedCadera = normalizeMeasurementValue(cadera);

  if (normalizedSexo === 'mujer' && normalizedBusto && normalizedCintura && normalizedCadera) {
    return JSON.stringify({
      version: 2,
      busto: normalizedBusto,
      cintura: normalizedCintura,
      cadera: normalizedCadera,
    });
  }

  if (normalizedSexo === 'hombre') {
    return null;
  }

  const normalizedMeasurements = normalizeMeasurementValue(measurements);
  if (!normalizedMeasurements || isLegacyEmptyMeasurement(normalizedMeasurements)) {
    return null;
  }

  return normalizedMeasurements;
};

module.exports = {
  buildLegacyMeasurementSummary,
  deserializeStaffMeasurements,
  normalizeMeasurementValue,
  normalizeStaffSexo,
  serializeStaffMeasurements,
};
