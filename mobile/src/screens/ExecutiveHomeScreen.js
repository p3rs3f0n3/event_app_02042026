import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar, ScrollView } from 'react-native';
import { COLORS } from '../theme/colors';
import CreateEventScreen from './CreateEventScreen';
import ReviewEventsScreen from './ReviewEventsScreen';
import ReportsScreen from './ReportsScreen';
import { useResponsiveMetrics } from '../utils/responsive';

const ExecutiveHomeScreen = ({ user, onLogout, appConfig, roleConfig }) => {
  const [currentView, setCurrentView] = useState('menu');
  const [editingEvent, setEditingEvent] = useState(null);
  const metrics = useResponsiveMetrics();
  const theme = COLORS[roleConfig?.theme] || COLORS.green;
  const displayUsername = user?.username || user?.role || 'usuario';

  const handleEditEvent = (event) => {
    setEditingEvent(event);
    setCurrentView('createEvent');
  };

  const handleBackToMenu = () => {
    setEditingEvent(null);
    setCurrentView('menu');
  };

  if (currentView === 'createEvent') {
    return <CreateEventScreen user={user} onBack={handleBackToMenu} eventToEdit={editingEvent} />;
  }

  if (currentView === 'reviewEvents') {
    return <ReviewEventsScreen user={user} onBack={handleBackToMenu} onEdit={handleEditEvent} />;
  }

  if (currentView === 'reports') {
    return <ReportsScreen user={user} onBack={handleBackToMenu} />;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.primary }]}> 
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, { fontSize: metrics.heroTitleSize }]}>{appConfig?.appName || 'EVENTAPP'}</Text>
          <Text style={styles.welcome}>Hola @{displayUsername}</Text>
        </View>

        <View style={[styles.menuContainer, { gap: metrics.sectionGap }]}>
          <TouchableOpacity style={styles.button} onPress={() => setCurrentView('createEvent')}>
            <Text style={styles.buttonText}>CREAR EVENTO</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={() => setCurrentView('reviewEvents')}>
            <Text style={styles.buttonText}>REVISAR EVENTOS</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={() => setCurrentView('reports')}>
            <Text style={styles.buttonText}>GENERAR INFORMES</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
          <Text style={styles.buttonText}>REGRESAR / SALIR</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 24,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginTop: 12,
  },
  title: {
    fontSize: 38,
    fontWeight: 'bold',
    color: '#FFF',
    letterSpacing: 3,
    textAlign: 'center',
  },
  welcome: {
    fontSize: 20,
    color: '#FFF',
    marginTop: 10,
  },
  menuContainer: {
    gap: 24,
    marginTop: 24,
  },
  button: {
    backgroundColor: '#D1D5DB',
    paddingVertical: 20,
    borderRadius: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    letterSpacing: 1,
  },
  logoutButton: {
    backgroundColor: '#D1D5DB',
    paddingVertical: 18,
    borderRadius: 35,
    alignItems: 'center',
    marginTop: 24,
  }
});

export default ExecutiveHomeScreen;
