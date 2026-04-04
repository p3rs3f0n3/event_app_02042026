export const FALLBACK_APP_CONFIG = {
  appName: 'EventApp',
  roles: [
    { code: 'ADMIN', label: 'Administrador', theme: 'blue', status: 'active', enabled: true },
    { code: 'EJECUTIVO', label: 'Ejecutivo', theme: 'green', status: 'active', enabled: true },
    { code: 'COORDINADOR', label: 'Coordinador', theme: 'brown', status: 'active', enabled: true },
    { code: 'CLIENTE', label: 'Cliente', theme: 'blue', status: 'active', enabled: true },
  ],
};

export const getRolePresentation = (appConfig, roleCode) => {
  const normalizedCode = String(roleCode || '').toUpperCase();
  return appConfig?.roles?.find((role) => role.code === normalizedCode)
    || FALLBACK_APP_CONFIG.roles.find((role) => role.code === normalizedCode)
    || null;
};
