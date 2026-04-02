import React, { useState } from 'react';
import { SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../theme/colors';
import CoordinatorEventDetailScreen from './CoordinatorEventDetailScreen';
import CoordinatorEventsScreen from './CoordinatorEventsScreen';
import { useResponsiveMetrics } from '../utils/responsive';
import { getUserDisplayName } from '../utils/user';

const CoordinatorHomeScreen = ({ user, onLogout, appConfig, roleConfig }) => {
  const [currentView, setCurrentView] = useState('menu');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const metrics = useResponsiveMetrics();
  const theme = COLORS[roleConfig?.theme] || COLORS.brown;

  if (currentView === 'events') {
    return (
      <CoordinatorEventsScreen
        user={user}
        onBack={() => setCurrentView('menu')}
        onSelectEvent={(event) => {
          setSelectedEvent(event);
          setCurrentView('detail');
        }}
        roleConfig={roleConfig}
        refreshToken={refreshToken}
      />
    );
  }

  if (currentView === 'detail' && selectedEvent) {
    return (
      <CoordinatorEventDetailScreen
        event={selectedEvent}
        user={user}
        onBack={() => setCurrentView('events')}
        onEventUpdated={(updatedEvent) => {
          setSelectedEvent(updatedEvent);
          setRefreshToken((current) => current + 1);
        }}
        roleConfig={roleConfig}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.primary }]}> 
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={[styles.scrollContent, { padding: metrics.screenPadding }]}> 
        <View style={styles.header}>
          <Text style={[styles.title, { fontSize: metrics.heroTitleSize }]}>{appConfig?.appName || 'EVENTAPP'}</Text>
          <Text style={styles.welcome}>Hola, {getUserDisplayName(user)}</Text>
          <Text style={styles.helper}>Tenés acceso a gestión operativa: podés revisar tus puntos, cargar fotos, diligenciar informes y contactar al ejecutivo.</Text>
        </View>

        <View style={styles.menuContainer}>
          <TouchableOpacity style={styles.button} onPress={() => setCurrentView('events')}>
            <Text style={styles.buttonText}>VER EVENTOS ASIGNADOS</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
          <Text style={styles.logoutButtonText}>REGRESAR / SALIR</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'space-between', paddingVertical: 24 },
  header: { alignItems: 'center', gap: 10, marginTop: 16 },
  title: { color: '#FFF', fontWeight: 'bold', letterSpacing: 3, textAlign: 'center' },
  welcome: { color: '#FFF', fontSize: 20 },
  helper: { color: '#EFEBE9', textAlign: 'center', maxWidth: 360, lineHeight: 21 },
  menuContainer: { marginTop: 30, gap: 18 },
  button: { backgroundColor: '#D7CCC8', borderRadius: 34, paddingVertical: 20, alignItems: 'center' },
  buttonText: { color: '#3E2723', fontWeight: 'bold', fontSize: 18 },
  logoutButton: { backgroundColor: '#D1D5DB', borderRadius: 30, paddingVertical: 16, alignItems: 'center' },
  logoutButtonText: { color: '#333', fontWeight: 'bold' },
});

export default CoordinatorHomeScreen;
