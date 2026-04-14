import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getResponsiveTokens, SHADOWS } from '../theme/tokens';
import { useResponsiveMetrics } from '../utils/responsive';

export const ScreenShell = ({ palette, children, scroll = true, contentContainerStyle, style }) => {
  const metrics = useResponsiveMetrics();
  const tokens = getResponsiveTokens(metrics);
  const styles = createStyles(metrics, tokens);
  const content = scroll ? (
    <ScrollView contentContainerStyle={[styles.scrollContent, contentContainerStyle]} keyboardShouldPersistTaps="handled">
      <View style={[styles.orb, styles.orbTop, { backgroundColor: palette.panelStrong }]} />
      <View style={[styles.orb, styles.orbBottom, { backgroundColor: palette.overlaySurface }]} />
      {children}
    </ScrollView>
  ) : children;

  return <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.pageBg }, style]}>{content}</SafeAreaView>;
};

export const SurfaceCard = ({ children, style }) => {
  const metrics = useResponsiveMetrics();
  const tokens = getResponsiveTokens(metrics);
  const styles = createStyles(metrics, tokens);

  return <View style={[styles.card, style]}>{children}</View>;
};

export const AppButton = ({ title, variant = 'primary', style, textStyle, disabled, ...props }) => {
  const metrics = useResponsiveMetrics();
  const tokens = getResponsiveTokens(metrics);
  const styles = createStyles(metrics, tokens);
  const variantStyles = BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.primary;
  return (
    <TouchableOpacity style={[styles.buttonBase, variantStyles.button, disabled && styles.disabled, style]} disabled={disabled} {...props}>
      <Text style={[styles.buttonTextBase, variantStyles.text, textStyle]}>{title}</Text>
    </TouchableOpacity>
  );
};

export const StatusBadge = ({ label, tone = 'muted', style, textStyle }) => {
  const metrics = useResponsiveMetrics();
  const tokens = getResponsiveTokens(metrics);
  const styles = createStyles(metrics, tokens);
  const toneStyle = BADGE_TONES[tone] || BADGE_TONES.muted;
  return (
    <View style={[styles.badge, toneStyle.badge, style]}>
      <Text style={[styles.badgeText, toneStyle.text, textStyle]}>{label}</Text>
    </View>
  );
};

export const SectionTitle = ({ kicker, title, subtitle, align = 'left', titleStyle }) => {
  const metrics = useResponsiveMetrics();
  const tokens = getResponsiveTokens(metrics);
  const styles = createStyles(metrics, tokens);

  return (
    <View style={[styles.sectionHeader, align === 'center' && styles.centerAligned]}>
      {kicker ? <Text style={[styles.kicker, align === 'center' && styles.centerText]}>{kicker}</Text> : null}
      {title ? <Text style={[styles.sectionTitle, align === 'center' && styles.centerText, titleStyle]}>{title}</Text> : null}
      {subtitle ? <Text style={[styles.sectionSubtitle, align === 'center' && styles.centerText]}>{subtitle}</Text> : null}
    </View>
  );
};

const BUTTON_VARIANTS = {
  primary: {
    button: { backgroundColor: '#FFB300' },
    text: { color: '#1F2937' },
  },
  secondary: {
    button: { backgroundColor: '#D1D5DB' },
    text: { color: '#1F2937' },
  },
  ghost: {
    button: { backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
    text: { color: '#FFFFFF' },
  },
  danger: {
    button: { backgroundColor: '#6B7280' },
    text: { color: '#FFFFFF' },
  },
};

const BADGE_TONES = {
  success: { badge: { backgroundColor: '#DCFCE7' }, text: { color: '#166534' } },
  warning: { badge: { backgroundColor: '#FEF3C7' }, text: { color: '#92400E' } },
  error: { badge: { backgroundColor: '#FEE2E2' }, text: { color: '#B91C1C' } },
  info: { badge: { backgroundColor: '#DBEAFE' }, text: { color: '#1D4ED8' } },
  muted: { badge: { backgroundColor: '#E2E8F0' }, text: { color: '#475569' } },
};

const createStyles = (metrics, tokens) => StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: tokens.layout.screenPadding,
    paddingTop: tokens.layout.verticalPadding,
    paddingBottom: metrics.spacing(56),
    gap: tokens.layout.sectionGap,
  },
  orb: { position: 'absolute', borderRadius: 999 },
  orbTop: { width: metrics.orbSize.top, height: metrics.orbSize.top, top: metrics.spacing(24), right: -metrics.spacing(60) },
  orbBottom: { width: metrics.orbSize.bottom, height: metrics.orbSize.bottom, bottom: metrics.spacing(40), left: -metrics.spacing(80) },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: tokens.radii.md,
    padding: tokens.layout.cardPadding,
    gap: tokens.spacing.sm,
    ...SHADOWS.card,
  },
  buttonBase: {
    minHeight: tokens.sizes.buttonMinHeight,
    borderRadius: tokens.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    ...SHADOWS.card,
  },
  buttonTextBase: { fontWeight: '800', fontSize: metrics.buttonTextSize, letterSpacing: 0.3 },
  disabled: { opacity: 0.6 },
  badge: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    minHeight: tokens.sizes.badgeMinHeight,
    borderRadius: tokens.radii.pill,
    paddingHorizontal: tokens.spacing.sm + metrics.spacing(2),
    paddingVertical: metrics.spacing(5, 0.9),
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: tokens.typography.caption,
    fontWeight: '700',
    lineHeight: metrics.font(14, 0.8),
    includeFontPadding: false,
    textAlignVertical: 'center',
    textAlign: 'center',
    flexShrink: 1,
  },
  sectionHeader: { gap: tokens.spacing.xs },
  kicker: { color: '#AFC1D4', fontSize: tokens.typography.caption, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase' },
  sectionTitle: { color: '#FFFFFF', fontSize: metrics.sectionTitleSize, fontWeight: '800' },
  sectionSubtitle: { color: '#E8EDF5', fontSize: tokens.typography.body, lineHeight: metrics.font(20, 0.85) },
  centerAligned: { alignItems: 'center' },
  centerText: { textAlign: 'center' },
});
