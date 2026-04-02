import React from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../theme/colors';

const RolePlaceholderScreen = ({ roleConfig, onLogout }) => {
  const theme = COLORS[roleConfig?.theme] || COLORS.green;

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

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { color: '#FFF', fontSize: 34, fontWeight: 'bold', textAlign: 'center' },
  roleTitle: { color: '#FFB300', fontSize: 24, fontWeight: 'bold', marginTop: 16, textAlign: 'center' },
  helper: { color: '#FFF', fontSize: 15, textAlign: 'center', marginTop: 16, maxWidth: 320, lineHeight: 22 },
  button: { marginTop: 28, backgroundColor: '#D1D5DB', paddingVertical: 14, paddingHorizontal: 36, borderRadius: 30 },
  buttonText: { color: '#333', fontWeight: 'bold' },
});

export default RolePlaceholderScreen;
