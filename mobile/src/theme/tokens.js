import { COLORS } from './colors';

export const SPACING = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32,
};

export const RADII = {
  sm: 12,
  md: 18,
  lg: 24,
  pill: 999,
};

export const SHADOWS = {
  card: {
    shadowColor: COLORS.brand.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 5,
  },
  floating: {
    shadowColor: COLORS.brand.shadow,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 8,
  },
};

const ROLE_THEME_MAP = {
  green: COLORS.green,
  blue: COLORS.blue,
  brown: COLORS.brown,
};

export const getAppPalette = (themeKey = 'green') => {
  const role = ROLE_THEME_MAP[themeKey] || COLORS.green;

  return {
    themeKey,
    hero: role.primary,
    heroSoft: role.secondary,
    pageBg: role.primary,
    pageBgSoft: role.backgroundSoft,
    surface: role.surface,
    surfaceMuted: role.surfaceMuted,
    overlaySurface: 'rgba(255,255,255,0.12)',
    panel: 'rgba(255,255,255,0.14)',
    panelStrong: 'rgba(255,255,255,0.18)',
    border: role.border,
    outline: COLORS.brand.outline,
    text: role.text,
    textMuted: role.textMuted,
    textSoft: COLORS.brand.bodyMuted,
    onHero: '#FFFFFF',
    onHeroMuted: role.background,
    primaryButton: role.button,
    primaryButtonText: '#1F2937',
    secondaryButton: '#D1D5DB',
    secondaryButtonText: '#1F2937',
    ghostButton: 'rgba(255,255,255,0.16)',
    ghostButtonText: '#FFFFFF',
    inputBg: '#FFFFFF',
    inputBorder: COLORS.brand.inputBorder,
    inputText: COLORS.brand.body,
    inputPlaceholder: '#94A3B8',
    badgeInfoBg: COLORS.state.infoSoft,
    badgeInfoText: COLORS.state.info,
    successBg: COLORS.state.successSoft,
    successText: COLORS.state.success,
    warningBg: COLORS.state.warningSoft,
    warningText: COLORS.state.warning,
    errorBg: COLORS.state.errorSoft,
    errorText: COLORS.state.error,
    mutedBg: COLORS.state.mutedSoft,
    mutedText: COLORS.state.muted,
  };
};
