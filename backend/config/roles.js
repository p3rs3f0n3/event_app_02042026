const ROLE_CONFIG = {
  ADMIN: {
    code: 'ADMIN',
    label: 'Administrador',
    theme: 'blue',
    status: 'active',
    enabled: true,
  },
  EJECUTIVO: {
    code: 'EJECUTIVO',
    label: 'Ejecutivo',
    theme: 'green',
    status: 'active',
    enabled: true,
  },
  COORDINADOR: {
    code: 'COORDINADOR',
    label: 'Coordinador',
    theme: 'brown',
    status: 'active',
    enabled: true,
  },
  CLIENTE: {
    code: 'CLIENTE',
    label: 'Cliente',
    theme: 'blue',
    status: 'active',
    enabled: true,
  },
};

const getRoleConfig = (code) => ROLE_CONFIG[String(code || '').toUpperCase()] || null;
const getRoleConfigList = () => Object.values(ROLE_CONFIG);

module.exports = {
  ROLE_CONFIG,
  getRoleConfig,
  getRoleConfigList,
};
