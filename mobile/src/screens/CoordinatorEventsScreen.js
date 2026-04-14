import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getCoordinatorEvents } from '../api/api';
import { useResponsiveMetrics } from '../utils/responsive';
import { getAppPalette, getResponsiveTokens } from '../theme/tokens';

const formatDate = (date) => new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

const CoordinatorEventsScreen = ({ user, onBack, onSelectEvent, roleConfig, refreshToken = 0 }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const metrics = useResponsiveMetrics();
  const tokens = getResponsiveTokens(metrics);
  const palette = getAppPalette(roleConfig?.theme || 'brown');
  const styles = useMemo(() => createStyles(palette, metrics, tokens), [palette, metrics, tokens]);

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
      <View style={styles.loading}> 
        <ActivityIndicator size="large" color="#FFF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}> 
      <ScrollView contentContainerStyle={[styles.scrollContent, { padding: metrics.screenPadding }]}> 
        <Text style={[styles.title, { fontSize: metrics.heroTitleSize }]}>MIS EVENTOS</Text>
        <Text style={styles.subtitle}>Solo ves los eventos en los que estás asignado como coordinador.</Text>

        <View style={styles.listContainer}>
          {events.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Sin eventos asignados</Text>
              <Text style={styles.emptyText}>Cuando un ejecutivo te asigne puntos, aparecerán aquí.</Text>
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

const createStyles = (palette, metrics, tokens) => StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.pageBg },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: metrics.spacing(48), gap: tokens.spacing.lg },
  title: { color: palette.onHero, fontWeight: 'bold', textAlign: 'center' },
  subtitle: { color: palette.onHeroMuted, textAlign: 'center', fontSize: tokens.typography.body, lineHeight: metrics.font(20, 0.85) },
  listContainer: { gap: tokens.spacing.md },
  emptyCard: { backgroundColor: palette.panel, borderRadius: tokens.radii.md, padding: tokens.spacing.lg, alignItems: 'center', gap: tokens.spacing.xs },
  emptyTitle: { color: palette.onHero, fontWeight: 'bold', fontSize: metrics.font(18, 0.9) },
  emptyText: { color: palette.onHeroMuted, textAlign: 'center', fontSize: tokens.typography.body },
  eventCard: { backgroundColor: palette.surface, borderRadius: tokens.radii.md, overflow: 'hidden' },
  eventImage: { width: '100%', height: metrics.size(150), resizeMode: 'cover' },
  eventBody: { padding: tokens.spacing.md, backgroundColor: palette.surfaceMuted, gap: metrics.spacing(4, 0.75) },
  eventTitle: { color: palette.text, fontSize: metrics.font(18, 0.9), fontWeight: 'bold' },
  eventText: { color: palette.textMuted, fontSize: tokens.typography.label },
  backButton: { backgroundColor: palette.secondaryButton, borderRadius: tokens.radii.pill, paddingVertical: tokens.spacing.md, alignItems: 'center' },
  backButtonText: { color: palette.secondaryButtonText, fontWeight: 'bold' },
});

export default CoordinatorEventsScreen;
