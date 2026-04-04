const DEFAULT_STAFF_CATEGORY_NAMES = [
  'ANFITRIONES',
  'BARISTAS',
  'DEGUSTADORES',
  'DEMOSTRADORAS',
  'IMPULSADORES',
  'LOGISTICOS',
  'MERCADERISTAS',
  'MODELOS',
  'PROTOCOLO',
  'SUPERVISORES',
];

const collapseSpaces = (value) => String(value || '').trim().replace(/\s+/g, ' ');
const stripDiacritics = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const normalizeStaffCategoryName = (value) => collapseSpaces(value).toUpperCase();

const normalizeStaffCategoryCode = (value) => stripDiacritics(normalizeStaffCategoryName(value))
  .replace(/[^A-Z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '')
  .slice(0, 80);

const sanitizeStaffCategoryRecord = (category) => ({
  id: Number(category.id || 0) || null,
  name: normalizeStaffCategoryName(category.name),
  code: String(category.code || normalizeStaffCategoryCode(category.name || '')).toUpperCase(),
  isActive: category.isActive ?? category.is_active ?? true,
  createdAt: category.createdAt || category.created_at || null,
});

const isStaffCategoryMatch = (category, search) => {
  const normalizedSearch = stripDiacritics(collapseSpaces(search).toLowerCase());
  if (!normalizedSearch) {
    return true;
  }

  const normalizedName = stripDiacritics(String(category.name || '').toLowerCase());
  const normalizedCode = stripDiacritics(String(category.code || '').toLowerCase());

  return normalizedName.includes(normalizedSearch) || normalizedCode.includes(normalizedSearch);
};

const mergeStaffCategoryCatalog = ({ categories = [], staff = [], fallbackNames = DEFAULT_STAFF_CATEGORY_NAMES }) => {
  const catalog = new Map();
  let nextId = 0;

  [...categories, ...fallbackNames.map((name) => ({ name })), ...staff.map((staffMember) => ({ name: staffMember.category }))]
    .forEach((entry) => {
      const normalizedName = normalizeStaffCategoryName(entry?.name);
      if (!normalizedName) {
        return;
      }

      const existing = catalog.get(normalizedName);
      nextId = Math.max(nextId, Number(entry?.id || 0) || 0);

      if (existing) {
        if (!existing.createdAt && entry?.createdAt) {
          existing.createdAt = entry.createdAt;
        }
        return;
      }

      catalog.set(normalizedName, sanitizeStaffCategoryRecord({
        id: Number(entry?.id || 0) || null,
        name: normalizedName,
        code: entry?.code || normalizeStaffCategoryCode(normalizedName),
        isActive: entry?.isActive ?? entry?.is_active ?? true,
        createdAt: entry?.createdAt || entry?.created_at || null,
      }));
    });

  return [...catalog.values()]
    .map((category) => {
      if (category.id) {
        return category;
      }

      nextId += 1;
      return { ...category, id: nextId };
    })
    .sort((left, right) => left.name.localeCompare(right.name, 'es'));
};

module.exports = {
  DEFAULT_STAFF_CATEGORY_NAMES,
  isStaffCategoryMatch,
  mergeStaffCategoryCatalog,
  normalizeStaffCategoryCode,
  normalizeStaffCategoryName,
  sanitizeStaffCategoryRecord,
};
