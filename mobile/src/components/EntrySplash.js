import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

import BrandMark from './BrandMark';
import { COLORS } from '../theme/colors';

const EntrySplash = ({ appName, loadingConfig = false }) => (
  <View style={styles.container}>
    <View style={styles.orbTop} />
    <View style={styles.orbBottom} />

    <BrandMark
      appName={appName}
      size="lg"
      subtitle="Planificación, ejecución y seguimiento operativo en una sola experiencia móvil."
    />

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.brand.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    overflow: 'hidden',
  },
  orbTop: {
    position: 'absolute',
    top: -110,
    right: -70,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: COLORS.brand.glowStrong,
  },
  orbBottom: {
    position: 'absolute',
    bottom: -140,
    left: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: COLORS.brand.glowSoft,
  },
  footerCard: {
    marginTop: 36,
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    paddingVertical: 18,
    paddingHorizontal: 20,
    backgroundColor: COLORS.brand.card,
    borderWidth: 1,
    borderColor: COLORS.brand.cardBorder,
  },
  kicker: {
    color: COLORS.brand.highlight,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  caption: {
    marginTop: 8,
    color: COLORS.brand.subtleText,
    fontSize: 14,
    lineHeight: 21,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
  },
  loadingText: {
    color: COLORS.brand.onDark,
    fontSize: 13,
    fontWeight: '600',
  },
});

export default EntrySplash;
