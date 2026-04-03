import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { getClientEvents } from '../api/api';
import { COLORS } from '../theme/colors';
import { normalizeExecutiveReport } from '../utils/executiveReport';
import { contactByPhoneCall, contactByWhatsApp, hasDirectContactPhone } from '../utils/contact';
import { getUserDisplayName } from '../utils/user';

const formatDate = (value) => new Date(value).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

const ClientHomeScreen = ({ user, onLogout, appConfig }) => {
  const [currentView, setCurrentView] = useState('menu');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const displayUsername = getUserDisplayName(user);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const response = await getClientEvents(user?.id);
      setEvents(Array.isArray(response) ? response : []);
    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar tus eventos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentView === 'events') {
      fetchEvents();
    }
  }, [currentView, user?.id]);

  const publishedEvents = useMemo(() => events.filter((event) => normalizeExecutiveReport(event.executiveReport)), [events]);

  const renderMenu = () => (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.heroCard}>
          <Text style={styles.appTitle}>{appConfig?.appName || 'EVENTAPP'}</Text>
          <Text style={styles.welcome}>Hola, {displayUsername}</Text>
          <Text style={styles.helper}>Revisá tus eventos y el informe final publicado por el ejecutivo.</Text>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricNumber}>{events.length}</Text>
            <Text style={styles.metricLabel}>Eventos asignados</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricNumber}>{publishedEvents.length}</Text>
            <Text style={styles.metricLabel}>Informes publicados</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={() => setCurrentView('events')}>
          <Text style={styles.primaryButtonText}>VER MIS EVENTOS</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={onLogout}>
          <Text style={styles.secondaryButtonText}>SALIR</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );

  const renderEventList = () => (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>MIS EVENTOS</Text>
        <Text style={styles.helper}>Solo vas a ver informes finales publicados. Los borradores no se exponen.</Text>

        {loading ? <ActivityIndicator color="#FFF" size="large" style={styles.loading} /> : null}

        {!loading && events.length === 0 ? <Text style={styles.emptyText}>Todavía no tenés eventos vinculados.</Text> : null}

        <View style={styles.listGap}>
          {events.map((event) => {
            const publishedReport = normalizeExecutiveReport(event.executiveReport);

            return (
              <TouchableOpacity key={event.id} style={styles.eventCard} onPress={() => { setSelectedEvent(event); setCurrentView('detail'); }}>
                <Text style={styles.eventTitle}>{event.name}</Text>
                <Text style={styles.eventMeta}>{event.client}</Text>
                <Text style={styles.eventMeta}>{formatDate(event.startDate)} → {formatDate(event.endDate)}</Text>
                <Text style={styles.badge}>{publishedReport ? 'Informe final publicado' : 'Informe final pendiente'}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => setCurrentView('menu')}>
          <Text style={styles.secondaryButtonText}>VOLVER</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );

  const renderEventDetail = () => {
    const event = selectedEvent;
    const report = normalizeExecutiveReport(event?.executiveReport);
    const points = (event?.cities || []).reduce((total, city) => total + (city.points?.length || 0), 0);

    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionTitle}>{event?.name}</Text>

          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>Resumen del evento</Text>
            <Text style={styles.detailRow}>Cliente: {event?.client}</Text>
            <Text style={styles.detailRow}>Inicio: {formatDate(event?.startDate)}</Text>
            <Text style={styles.detailRow}>Fin: {formatDate(event?.endDate)}</Text>
            <Text style={styles.detailRow}>Ciudades: {event?.cities?.length || 0}</Text>
            <Text style={styles.detailRow}>Puntos operativos: {points}</Text>
          </View>

          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>Contacto ejecutivo</Text>
            <Text style={styles.detailRow}>{event?.executiveContact?.fullName || 'Ejecutivo no informado'}</Text>
            <Text style={styles.detailRow}>{event?.executiveContact?.email || 'Sin email'}</Text>
            <View style={styles.contactRow}>
              <TouchableOpacity style={[styles.contactButton, !hasDirectContactPhone(event?.executiveContact) && styles.contactButtonDisabled]} onPress={() => contactByPhoneCall(event?.executiveContact)}>
                <Text style={styles.contactButtonText}>LLAMAR</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.contactButton, !hasDirectContactPhone(event?.executiveContact) && styles.contactButtonDisabled]} onPress={() => contactByWhatsApp(event?.executiveContact)}>
                <Text style={styles.contactButtonText}>WHATSAPP</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>Informe final</Text>
            {!report ? (
              <Text style={styles.pendingText}>Todavía no hay un informe final publicado para este evento.</Text>
            ) : (
              <View style={styles.reportGap}>
                <Text style={styles.reportTitle}>{report.title}</Text>
                <Text style={styles.reportMeta}>Publicado: {report.publishedAt ? new Date(report.publishedAt).toLocaleString('es-ES') : 'Sin fecha'}</Text>
                <Text style={styles.reportSectionTitle}>Resumen ejecutivo</Text>
                <Text style={styles.reportBody}>{report.executiveSummary}</Text>
                <Text style={styles.reportSectionTitle}>Cumplimiento de objetivos</Text>
                <Text style={styles.reportBody}>{report.objectivesCompliance}</Text>
                <Text style={styles.reportSectionTitle}>Resultados / impacto</Text>
                <Text style={styles.reportBody}>{report.resultsImpact}</Text>
                <Text style={styles.reportSectionTitle}>Redenciones</Text>
                <Text style={styles.reportBody}>{report.redemptions}</Text>
                <Text style={styles.reportSectionTitle}>Hallazgos / highlights</Text>
                <Text style={styles.reportBody}>{report.highlights}</Text>
                <Text style={styles.reportSectionTitle}>Incidentes</Text>
                <Text style={styles.reportBody}>{report.incidents}</Text>
                <Text style={styles.reportSectionTitle}>Recomendaciones</Text>
                <Text style={styles.reportBody}>{report.recommendations}</Text>
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.secondaryButton} onPress={() => setCurrentView('events')}>
            <Text style={styles.secondaryButtonText}>VOLVER A MIS EVENTOS</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  };

  if (currentView === 'events') {
    return renderEventList();
  }

  if (currentView === 'detail' && selectedEvent) {
    return renderEventDetail();
  }

  return renderMenu();
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.blue.primary },
  scrollContent: { padding: 20, paddingBottom: 60 },
  heroCard: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20, padding: 20, marginBottom: 20 },
  appTitle: { fontSize: 30, color: '#FFF', fontWeight: '800', textAlign: 'center' },
  welcome: { color: '#FFF', textAlign: 'center', marginTop: 10, fontSize: 18, fontWeight: '700' },
  helper: { color: '#E3F2FD', textAlign: 'center', marginTop: 10, lineHeight: 20 },
  metricsRow: { flexDirection: 'row', gap: 12, marginBottom: 22 },
  metricCard: { flex: 1, backgroundColor: '#FFF', borderRadius: 16, padding: 18, alignItems: 'center' },
  metricNumber: { fontSize: 28, fontWeight: '800', color: COLORS.blue.text },
  metricLabel: { marginTop: 6, color: '#4B5563', textAlign: 'center' },
  primaryButton: { backgroundColor: '#FFB300', borderRadius: 18, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  primaryButtonText: { color: '#263238', fontWeight: '800' },
  secondaryButton: { backgroundColor: '#D1D5DB', borderRadius: 18, paddingVertical: 15, alignItems: 'center', marginTop: 10 },
  secondaryButtonText: { color: '#263238', fontWeight: '800' },
  sectionTitle: { fontSize: 28, color: '#FFF', fontWeight: '800', textAlign: 'center', marginBottom: 10 },
  loading: { marginTop: 24 },
  emptyText: { color: '#FFF', textAlign: 'center', marginTop: 28 },
  listGap: { gap: 14, marginTop: 18 },
  eventCard: { backgroundColor: '#FFF', borderRadius: 18, padding: 16, gap: 6 },
  eventTitle: { fontSize: 18, fontWeight: '800', color: COLORS.blue.text },
  eventMeta: { color: '#4B5563' },
  badge: { marginTop: 6, alignSelf: 'flex-start', backgroundColor: '#E3F2FD', color: COLORS.blue.text, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, overflow: 'hidden', fontSize: 12, fontWeight: '700' },
  detailCard: { backgroundColor: '#FFF', borderRadius: 18, padding: 18, marginTop: 14 },
  detailTitle: { fontSize: 18, fontWeight: '800', color: COLORS.blue.text, marginBottom: 10 },
  detailRow: { color: '#374151', marginBottom: 6 },
  contactRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  contactButton: { flex: 1, backgroundColor: '#E3F2FD', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  contactButtonDisabled: { opacity: 0.55 },
  contactButtonText: { color: COLORS.blue.text, fontWeight: '800' },
  pendingText: { color: '#4B5563', lineHeight: 20 },
  reportGap: { gap: 8 },
  reportTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  reportMeta: { color: '#6B7280', marginBottom: 4 },
  reportSectionTitle: { color: COLORS.blue.text, fontWeight: '800', marginTop: 4 },
  reportBody: { color: '#374151', lineHeight: 20 },
});

export default ClientHomeScreen;
