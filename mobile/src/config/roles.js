export const FALLBACK_APP_CONFIG = {
  appName: 'EventApp',
  roles: [
    { code: 'ADMIN', label: 'Administrador', theme: 'blue', status: 'planned', enabled: false },
    { code: 'EJECUTIVO', label: 'Ejecutivo', theme: 'green', status: 'active', enabled: true },
    { code: 'COORDINADOR', label: 'Coordinador', theme: 'brown', status: 'planned', enabled: false },
    { code: 'CLIENTE', label: 'Cliente', theme: 'blue', status: 'planned', enabled: false },
  ],
};

export const getRolePresentation = (appConfig, roleCode) => {
  const normalizedCode = String(roleCode || '').toUpperCase();
  return appConfig?.roles?.find((role) => role.code === normalizedCode)
    || FALLBACK_APP_CONFIG.roles.find((role) => role.code === normalizedCode)
    || null;
};
