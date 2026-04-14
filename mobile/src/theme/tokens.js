import { COLORS } from './colors';
import { createResponsiveMetrics } from '../utils/responsive';

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

export const TYPOGRAPHY = {
  caption: 12,
  body: 14,
  bodyLg: 16,
  label: 13,
  title: 20,
  section: 28,
  hero: 36,
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

const normalizeMetrics = (metrics) => {
  if (
    metrics
    && typeof metrics.spacing === 'function'
    && typeof metrics.font === 'function'
    && typeof metrics.size === 'function'
    && typeof metrics.radius === 'function'
  ) {
    return metrics;
  }

  return createResponsiveMetrics(metrics?.width || 390, metrics?.height || 844);
};

export const getResponsiveTokens = (metrics) => {
  const safeMetrics = normalizeMetrics(metrics);

  return {
    spacing: {
      xs: safeMetrics.spacing(SPACING.xs),
      sm: safeMetrics.spacing(SPACING.sm),
      md: safeMetrics.spacing(SPACING.md),
      lg: safeMetrics.spacing(SPACING.lg),
      xl: safeMetrics.spacing(SPACING.xl),
      xxl: safeMetrics.spacing(SPACING.xxl),
    },
    radii: {
      sm: safeMetrics.radius(RADII.sm),
      md: safeMetrics.radius(RADII.md),
      lg: safeMetrics.radius(RADII.lg),
      pill: RADII.pill,
    },
    typography: {
      caption: safeMetrics.font(TYPOGRAPHY.caption, 0.8),
      body: safeMetrics.font(TYPOGRAPHY.body, 0.8),
      bodyLg: safeMetrics.font(TYPOGRAPHY.bodyLg, 0.85),
      label: safeMetrics.font(TYPOGRAPHY.label, 0.85),
      title: safeMetrics.font(TYPOGRAPHY.title, 0.9),
      section: safeMetrics.font(TYPOGRAPHY.section, 0.95),
      hero: safeMetrics.font(TYPOGRAPHY.hero, 0.95),
    },
    layout: {
      screenPadding: safeMetrics.screenPadding,
      verticalPadding: safeMetrics.verticalPadding,
      sectionGap: safeMetrics.sectionGap,
      cardPadding: safeMetrics.cardPadding,
      modalMaxWidth: safeMetrics.modalMaxWidth,
      contentMaxWidth: safeMetrics.contentMaxWidth,
    },
    sizes: {
      buttonMinHeight: safeMetrics.size(52, 0.95),
      inputMinHeight: safeMetrics.size(50, 0.95),
      badgeMinHeight: safeMetrics.size(30, 0.9),
      imageCardHeight: safeMetrics.size(180, 1),
      heroImageHeight: safeMetrics.size(190, 1),
    },
  };
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
