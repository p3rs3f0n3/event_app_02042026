import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RADII, SHADOWS, SPACING } from '../theme/tokens';

export const ScreenShell = ({ palette, children, scroll = true, contentContainerStyle, style }) => {
  const content = scroll ? (
    <ScrollView contentContainerStyle={[styles.scrollContent, contentContainerStyle]} keyboardShouldPersistTaps="handled">
      <View style={[styles.orb, styles.orbTop, { backgroundColor: palette.panelStrong }]} />
      <View style={[styles.orb, styles.orbBottom, { backgroundColor: palette.overlaySurface }]} />
      {children}
    </ScrollView>
  ) : children;

  return <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.pageBg }, style]}>{content}</SafeAreaView>;
};

export const SurfaceCard = ({ children, style }) => <View style={[styles.card, style]}>{children}</View>;

export const AppButton = ({ title, variant = 'primary', style, textStyle, disabled, ...props }) => {
  const variantStyles = BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.primary;
  return (
    <TouchableOpacity style={[styles.buttonBase, variantStyles.button, disabled && styles.disabled, style]} disabled={disabled} {...props}>
      <Text style={[styles.buttonTextBase, variantStyles.text, textStyle]}>{title}</Text>
    </TouchableOpacity>
  );
};

export const StatusBadge = ({ label, tone = 'muted', style, textStyle }) => {
  const toneStyle = BADGE_TONES[tone] || BADGE_TONES.muted;
  return (
    <View style={[styles.badge, toneStyle.badge, style]}>
      <Text style={[styles.badgeText, toneStyle.text, textStyle]}>{label}</Text>
    </View>
  );
};

export const SectionTitle = ({ kicker, title, subtitle, align = 'left', titleStyle }) => (
  <View style={[styles.sectionHeader, align === 'center' && styles.centerAligned]}>
    {kicker ? <Text style={[styles.kicker, align === 'center' && styles.centerText]}>{kicker}</Text> : null}
    {title ? <Text style={[styles.sectionTitle, align === 'center' && styles.centerText, titleStyle]}>{title}</Text> : null}
    {subtitle ? <Text style={[styles.sectionSubtitle, align === 'center' && styles.centerText]}>{subtitle}</Text> : null}
  </View>
);

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

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: SPACING.xl, paddingBottom: 56, gap: SPACING.lg },
  orb: { position: 'absolute', borderRadius: 999 },
  orbTop: { width: 200, height: 200, top: 24, right: -60 },
  orbBottom: { width: 240, height: 240, bottom: 40, left: -80 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADII.md,
    padding: SPACING.lg,
    gap: SPACING.sm,
    ...SHADOWS.card,
  },
  buttonBase: {
    minHeight: 52,
    borderRadius: RADII.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    ...SHADOWS.card,
  },
  buttonTextBase: { fontWeight: '800', fontSize: 14, letterSpacing: 0.3 },
  disabled: { opacity: 0.6 },
  badge: { alignSelf: 'flex-start', borderRadius: RADII.pill, paddingHorizontal: 10, paddingVertical: 6 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  sectionHeader: { gap: SPACING.xs },
  kicker: { color: '#AFC1D4', fontSize: 12, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase' },
  sectionTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '800' },
  sectionSubtitle: { color: '#E8EDF5', lineHeight: 20 },
  centerAligned: { alignItems: 'center' },
  centerText: { textAlign: 'center' },
});
