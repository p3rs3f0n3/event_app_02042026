import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CalendarDays, Sparkles } from 'lucide-react-native';

import { APP_DISPLAY_NAME, APP_LEGAL_TAGLINE } from '../config/appMetadata';
import { COLORS } from '../theme/colors';
import { useResponsiveMetrics } from '../utils/responsive';

const SIZE_MAP = {
  sm: {
    badge: 56,
    icon: 24,
    title: 22,
    eyebrow: 10,
    subtitle: 12,
  },
  md: {
    badge: 74,
    icon: 30,
    title: 30,
    eyebrow: 11,
    subtitle: 13,
  },
  lg: {
    badge: 96,
    icon: 40,
    title: 38,
    eyebrow: 12,
    subtitle: 15,
  },
};

const BrandMark = ({ appName = APP_DISPLAY_NAME, subtitle, legalLine = APP_LEGAL_TAGLINE, size = 'md', align = 'center' }) => {
  const metrics = useResponsiveMetrics();
  const styles = useMemo(() => createStyles(metrics), [metrics]);
  const basePalette = SIZE_MAP[size] || SIZE_MAP.md;
  const palette = {
    badge: metrics.size(basePalette.badge, 0.95),
    icon: metrics.size(basePalette.icon, 0.9),
    title: metrics.font(basePalette.title, 0.95),
    eyebrow: metrics.font(basePalette.eyebrow, 0.8),
    subtitle: metrics.font(basePalette.subtitle, 0.85),
  };

  return (
    <View style={[styles.container, align === 'left' ? styles.leftAligned : styles.centerAligned]}>
      <View style={[styles.badge, { width: palette.badge, height: palette.badge, borderRadius: palette.badge / 2 }]}> 
        <View style={styles.badgeGlow} />
        <CalendarDays color={COLORS.brand.onPrimary} size={palette.icon} strokeWidth={2.3} />
        <View style={[styles.sparkleWrap, { width: Math.max(20, Math.round(palette.icon * 0.9)), height: Math.max(20, Math.round(palette.icon * 0.9)), borderRadius: Math.max(10, Math.round(palette.icon * 0.45)) }]}>
          <Sparkles color={COLORS.brand.spark} size={Math.max(14, palette.icon * 0.42)} strokeWidth={2.5} />
        </View>
      </View>

      <View style={[styles.textBlock, align === 'left' ? styles.leftAligned : styles.centerAligned]}>
        <Text style={[styles.eyebrow, align === 'left' ? styles.leftText : styles.centerText, { fontSize: palette.eyebrow }]}>EVENT OPERATIONS SUITE</Text>
        <Text style={[styles.title, align === 'left' ? styles.leftText : styles.centerText, { fontSize: palette.title }]}>{appName}</Text>
        {legalLine ? <Text style={[styles.legalLine, align === 'left' ? styles.leftText : styles.centerText, { fontSize: Math.max(11, palette.subtitle - 1) }]}>{legalLine}</Text> : null}
        {subtitle ? <Text style={[styles.subtitle, align === 'left' ? styles.leftText : styles.centerText, { fontSize: palette.subtitle }]}>{subtitle}</Text> : null}
      </View>
    </View>
  );
};

const createStyles = (metrics) => StyleSheet.create({
  container: {
    gap: metrics.spacing(18, 0.9),
    width: '100%',
  },
  centerAligned: {
    alignItems: 'center',
  },
  leftAligned: {
    alignItems: 'flex-start',
  },
  centerText: {
    textAlign: 'center',
  },
  leftText: {
    textAlign: 'left',
  },
  badge: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.brand.primary,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    shadowColor: COLORS.brand.shadow,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.28,
    shadowRadius: 28,
    elevation: 10,
    overflow: 'visible',
  },
  badgeGlow: {
    position: 'absolute',
    top: 5,
    right: 5,
    bottom: 5,
    left: 5,
    borderRadius: 999,
    backgroundColor: COLORS.brand.primarySoft,
  },
  sparkleWrap: {
    position: 'absolute',
    top: -metrics.spacing(2, 0.7),
    right: -metrics.spacing(1, 0.7),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.brand.surface,
  },
  textBlock: {
    gap: metrics.spacing(6, 0.8),
    width: '100%',
    maxWidth: metrics.contentMaxWidth,
  },
  eyebrow: {
    color: COLORS.brand.muted,
    letterSpacing: 2.4,
    fontWeight: '700',
  },
  title: {
    color: COLORS.brand.onDark,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  legalLine: {
    color: COLORS.brand.highlight,
    fontWeight: '700',
  },
  subtitle: {
    color: COLORS.brand.subtleText,
    lineHeight: metrics.font(20, 0.82),
    maxWidth: Math.min(metrics.contentMaxWidth, metrics.size(320, 0.9)),
  },
});

export default BrandMark;
