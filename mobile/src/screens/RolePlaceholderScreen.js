import React from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../theme/colors';
import { getResponsiveTokens } from '../theme/tokens';
import { useResponsiveMetrics } from '../utils/responsive';

const RolePlaceholderScreen = ({ roleConfig, onLogout }) => {
  const theme = COLORS[roleConfig?.theme] || COLORS.green;
  const metrics = useResponsiveMetrics();
  const tokens = getResponsiveTokens(metrics);
  const styles = createStyles(metrics, tokens);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.primary }]}>
      <View style={styles.content}>
        <Text style={styles.title}>EVENTAPP</Text>
        <Text style={styles.roleTitle}>{roleConfig?.label || 'Rol'}</Text>
        <Text style={styles.helper}>Este módulo todavía no está implementado, pero la configuración del rol ya quedó preparada para las próximas pantallas.</Text>
        <TouchableOpacity style={styles.button} onPress={onLogout}>
          <Text style={styles.buttonText}>SALIR</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (metrics, tokens) => StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: tokens.layout.screenPadding },
  title: { color: '#FFF', fontSize: metrics.font(34, 0.95), fontWeight: 'bold', textAlign: 'center' },
  roleTitle: { color: '#FFB300', fontSize: metrics.font(24, 0.95), fontWeight: 'bold', marginTop: tokens.spacing.md, textAlign: 'center' },
  helper: { color: '#FFF', fontSize: tokens.typography.body, textAlign: 'center', marginTop: tokens.spacing.md, maxWidth: metrics.contentMaxWidth, lineHeight: metrics.font(22, 0.86) },
  button: { marginTop: metrics.spacing(28), backgroundColor: '#D1D5DB', paddingVertical: tokens.spacing.md, paddingHorizontal: metrics.spacing(36), borderRadius: tokens.radii.pill },
  buttonText: { color: '#333', fontWeight: 'bold', fontSize: tokens.typography.body },
});

export default RolePlaceholderScreen;
