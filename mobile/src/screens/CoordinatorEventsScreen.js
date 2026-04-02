import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getCoordinatorEvents } from '../api/api';
import { COLORS } from '../theme/colors';
import { useResponsiveMetrics } from '../utils/responsive';

const formatDate = (date) => new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

const CoordinatorEventsScreen = ({ user, onBack, onSelectEvent, roleConfig, refreshToken = 0 }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const metrics = useResponsiveMetrics();
  const theme = COLORS[roleConfig?.theme] || COLORS.brown;

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const response = await getCoordinatorEvents(user?.id);
        setEvents(response);
      } catch (error) {
        Alert.alert('Error', 'No se pudieron cargar los eventos asignados.');
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, [refreshToken, user?.id]);

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.primary }]}> 
        <ActivityIndicator size="large" color="#FFF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.primary }]}> 
      <ScrollView contentContainerStyle={[styles.scrollContent, { padding: metrics.screenPadding }]}> 
        <Text style={[styles.title, { fontSize: metrics.heroTitleSize }]}>MIS EVENTOS</Text>
        <Text style={styles.subtitle}>Solo ves los eventos donde estás asignado como coordinador.</Text>

        <View style={styles.listContainer}>
          {events.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Sin eventos asignados</Text>
              <Text style={styles.emptyText}>Cuando un ejecutivo te asigne puntos, van a aparecer acá.</Text>
            </View>
          ) : (
            events.map((event) => (
              <TouchableOpacity key={event.id} style={styles.eventCard} onPress={() => onSelectEvent(event)}>
                <Image source={{ uri: event.image || 'https://cdn-icons-png.flaticon.com/512/1162/1162238.png' }} style={styles.eventImage} />
                <View style={styles.eventBody}>
                  <Text style={styles.eventTitle}>{event.name}</Text>
                  <Text style={styles.eventText}>{event.client}</Text>
                  <Text style={styles.eventText}>Fechas: {formatDate(event.startDate)} - {formatDate(event.endDate)}</Text>
                  <Text style={styles.eventText}>Puntos asignados: {event.assignmentSummary?.pointsCount || 0}</Text>
                  <Text style={styles.eventText}>Fotos: {event.photos?.length || 0} · Informes: {event.reports?.length || 0}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>REGRESAR AL MENÚ</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: 48, gap: 18 },
  title: { color: '#FFF', fontWeight: 'bold', textAlign: 'center' },
  subtitle: { color: '#EFEBE9', textAlign: 'center' },
  listContainer: { gap: 16 },
  emptyCard: { backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 18, padding: 20, alignItems: 'center', gap: 8 },
  emptyTitle: { color: '#FFF', fontWeight: 'bold', fontSize: 18 },
  emptyText: { color: '#EFEBE9', textAlign: 'center' },
  eventCard: { backgroundColor: '#FFF', borderRadius: 18, overflow: 'hidden' },
  eventImage: { width: '100%', height: 150, resizeMode: 'cover' },
  eventBody: { padding: 14, backgroundColor: '#D7CCC8', gap: 4 },
  eventTitle: { color: '#3E2723', fontSize: 18, fontWeight: 'bold' },
  eventText: { color: '#4E342E', fontSize: 13 },
  backButton: { backgroundColor: '#D1D5DB', borderRadius: 28, paddingVertical: 14, alignItems: 'center' },
  backButtonText: { color: '#333', fontWeight: 'bold' },
});

export default CoordinatorEventsScreen;
