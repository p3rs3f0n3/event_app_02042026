import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

import BrandMark from './BrandMark';
import { APP_DISPLAY_NAME, SPLASH_BRAND_SUBTITLE } from '../config/appMetadata';
import { COLORS } from '../theme/colors';
import { getResponsiveTokens, SHADOWS, getAppPalette } from '../theme/tokens';
import { useResponsiveMetrics } from '../utils/responsive';

const palette = getAppPalette();

const EntrySplash = ({ appName, loadingConfig = false }) => {
  const metrics = useResponsiveMetrics();
  const tokens = getResponsiveTokens(metrics);
  const styles = useMemo(() => createStyles(metrics, tokens), [metrics, tokens]);

  return (
    <View style={styles.container}>
      <View style={styles.orbTop} />
      <View style={styles.orbBottom} />

      <View style={styles.brandWrap}>
        <BrandMark
          appName={appName || APP_DISPLAY_NAME}
          size="lg"
          subtitle={SPLASH_BRAND_SUBTITLE}
        />
      </View>

      <View style={styles.footerCard}>
        <Text style={styles.kicker}>Listo para trabajar</Text>
        <Text style={styles.caption}>Acceso unificado para operación comercial, coordinación y monitoreo de eventos.</Text>
        <View style={styles.loadingRow}>
          <ActivityIndicator color={COLORS.brand.highlight} />
          <Text style={styles.loadingText}>{loadingConfig ? 'Preparando configuración...' : 'Iniciando experiencia...'}</Text>
        </View>
      </View>
    </View>
  );
};

const createStyles = (metrics, tokens) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.pageBg,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: tokens.layout.screenPadding,
    paddingVertical: tokens.layout.verticalPadding,
    overflow: 'hidden',
  },
  brandWrap: {
    width: '100%',
    maxWidth: tokens.layout.contentMaxWidth,
    alignItems: 'center',
  },
  orbTop: {
    position: 'absolute',
    top: -metrics.spacing(110),
    right: -metrics.spacing(70),
    width: metrics.size(240),
    height: metrics.size(240),
    borderRadius: metrics.size(120),
    backgroundColor: COLORS.brand.glowStrong,
  },
  orbBottom: {
    position: 'absolute',
    bottom: -metrics.spacing(140),
    left: -metrics.spacing(80),
    width: metrics.size(280),
    height: metrics.size(280),
    borderRadius: metrics.size(140),
    backgroundColor: COLORS.brand.glowSoft,
  },
  footerCard: {
    marginTop: tokens.spacing.xl + tokens.spacing.sm,
    width: '100%',
    maxWidth: tokens.layout.contentMaxWidth,
    borderRadius: tokens.radii.lg,
    paddingVertical: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.lg,
    backgroundColor: COLORS.brand.card,
    borderWidth: 1,
    borderColor: COLORS.brand.cardBorder,
    ...SHADOWS.floating,
  },
  kicker: {
    color: COLORS.brand.highlight,
    fontSize: tokens.typography.caption,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  caption: {
    marginTop: tokens.spacing.xs,
    color: COLORS.brand.subtleText,
    fontSize: tokens.typography.body,
    lineHeight: metrics.font(21, 0.85),
  },
  loadingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.md,
  },
  loadingText: {
    color: COLORS.brand.onDark,
    fontSize: metrics.font(13, 0.85),
    fontWeight: '600',
    flex: 1,
  },
});

export default EntrySplash;
