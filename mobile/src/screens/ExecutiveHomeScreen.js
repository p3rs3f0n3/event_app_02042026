import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar, ScrollView } from 'react-native';
import { COLORS } from '../theme/colors';
import CreateEventScreen from './CreateEventScreen';
import ReviewEventsScreen from './ReviewEventsScreen';
import ReportsScreen from './ReportsScreen';

const ExecutiveHomeScreen = ({ user, onLogout }) => {
  const [currentView, setCurrentView] = useState('menu');
  const [editingEvent, setEditingEvent] = useState(null);
  const theme = COLORS.green; // Executive role uses Green theme
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
      <View style={styles.header}>
        <Text style={styles.title}>EVENTAPP</Text>
        <Text style={styles.welcome}>Hola @{displayUsername}</Text>
      </View>

      <View style={styles.menuContainer}>
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 30,
    justifyContent: 'space-between',
    paddingVertical: 60,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
  },
  title: {
    fontSize: 50,
    fontWeight: 'bold',
    color: '#FFF',
    letterSpacing: 3,
  },
  welcome: {
    fontSize: 20,
    color: '#FFF',
    marginTop: 10,
  },
  menuContainer: {
    gap: 30,
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
    marginBottom: 40,
  }
});

export default ExecutiveHomeScreen;
