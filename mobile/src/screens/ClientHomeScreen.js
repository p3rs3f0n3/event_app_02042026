import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { getClientEvents } from '../api/api';
import UserProfileCard from '../components/UserProfileCard';
import { normalizeExecutiveReport } from '../utils/executiveReport';
import { contactByPhoneCall, contactByWhatsApp, hasDirectContactPhone } from '../utils/contact';
import { getUserDisplayName } from '../utils/user';
import { AppButton, ScreenShell, SectionTitle, StatusBadge, SurfaceCard } from '../components/ui';
import { getAppPalette, SPACING } from '../theme/tokens';

const formatDate = (value) => new Date(value).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

const ClientHomeScreen = ({ user, onLogout, appConfig, roleConfig }) => {
  const [currentView, setCurrentView] = useState('menu');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const displayUsername = getUserDisplayName(user);
  const palette = getAppPalette(roleConfig?.theme || 'blue');
  const styles = useMemo(() => createStyles(palette), [palette]);

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
    <ScreenShell palette={palette} contentContainerStyle={styles.content}>
      <SectionTitle
        kicker="Portal cliente"
        title={appConfig?.appName || 'EventApp'}
        subtitle={`Hola, ${displayUsername}. Consulta los eventos vinculados y el informe final publicado por el ejecutivo.`}
      />

      <View style={styles.metricsRow}>
        <SurfaceCard style={styles.metricCard}>
          <Text style={styles.metricNumber}>{events.length}</Text>
          <Text style={styles.metricLabel}>Eventos vinculados</Text>
        </SurfaceCard>
        <SurfaceCard style={styles.metricCard}>
          <Text style={styles.metricNumber}>{publishedEvents.length}</Text>
          <Text style={styles.metricLabel}>Informes publicados</Text>
        </SurfaceCard>
      </View>

      <SurfaceCard style={styles.heroCard}>
        <StatusBadge label="Visibilidad controlada" tone="info" />
        <Text style={styles.cardTitle}>Acceso a reportes publicados</Text>
        <Text style={styles.cardText}>Los borradores siguen ocultos. Solo ves información validada y publicada.</Text>
      </SurfaceCard>

      <UserProfileCard
        user={user}
        palette={palette}
        title="Mi perfil cliente"
        description={`Sesión activa como @${user?.username}. El cambio de contraseña quedó en tu bloque personal, separado de la consulta de eventos e informes.`}
        buttonLabel="MI CONTRASEÑA"
        buttonVariant="primary"
      />

      <AppButton title="VER MIS EVENTOS" onPress={() => setCurrentView('events')} />
      <AppButton title="SALIR" variant="secondary" onPress={onLogout} />
    </ScreenShell>
  );

  const renderEventList = () => (
    <ScreenShell palette={palette}>
      <SectionTitle kicker="Eventos" title="Mis eventos" subtitle="Solo verás informes finales publicados. Los borradores no se muestran." />

      {loading ? <ActivityIndicator color="#FFFFFF" size="large" style={styles.loading} /> : null}
      {!loading && events.length === 0 ? <Text style={styles.emptyText}>Todavía no tienes eventos vinculados.</Text> : null}

      <View style={styles.listGap}>
        {events.map((event) => {
          const publishedReport = normalizeExecutiveReport(event.executiveReport);

          return (
            <TouchableOpacity key={event.id} style={styles.eventCard} onPress={() => { setSelectedEvent(event); setCurrentView('detail'); }}>
              <Text style={styles.eventTitle}>{event.name}</Text>
              <Text style={styles.eventMeta}>{event.client}</Text>
              <Text style={styles.eventMeta}>{formatDate(event.startDate)} → {formatDate(event.endDate)}</Text>
              <StatusBadge label={publishedReport ? 'Informe final publicado' : 'Informe final pendiente'} tone={publishedReport ? 'success' : 'warning'} />
            </TouchableOpacity>
          );
        })}
      </View>

      <AppButton title="VOLVER" variant="secondary" onPress={() => setCurrentView('menu')} />
    </ScreenShell>
  );

  const renderEventDetail = () => {
    const event = selectedEvent;
    const report = normalizeExecutiveReport(event?.executiveReport);
    const points = (event?.cities || []).reduce((total, city) => total + (city.points?.length || 0), 0);

    return (
      <ScreenShell palette={palette}>
        <SectionTitle title={event?.name} subtitle={`${event?.client} · visión compartida con el cliente`} />

        <SurfaceCard>
          <Text style={styles.cardTitle}>Resumen del evento</Text>
          <Text style={styles.detailRow}>Cliente: {event?.client}</Text>
          <Text style={styles.detailRow}>Inicio: {formatDate(event?.startDate)}</Text>
          <Text style={styles.detailRow}>Fin: {formatDate(event?.endDate)}</Text>
          <Text style={styles.detailRow}>Ciudades: {event?.cities?.length || 0}</Text>
          <Text style={styles.detailRow}>Puntos operativos: {points}</Text>
        </SurfaceCard>

        <SurfaceCard>
          <Text style={styles.cardTitle}>Contacto ejecutivo</Text>
          <Text style={styles.detailRow}>{event?.executiveContact?.fullName || 'Ejecutivo no informado'}</Text>
          <Text style={styles.detailRow}>{event?.executiveContact?.email || 'Sin email'}</Text>
          <View style={styles.contactRow}>
            <AppButton title="LLAMAR" variant="secondary" style={styles.contactButton} disabled={!hasDirectContactPhone(event?.executiveContact)} onPress={() => contactByPhoneCall(event?.executiveContact)} />
            <AppButton title="WHATSAPP" variant="secondary" style={styles.contactButton} disabled={!hasDirectContactPhone(event?.executiveContact)} onPress={() => contactByWhatsApp(event?.executiveContact)} />
          </View>
        </SurfaceCard>

        <SurfaceCard>
          <Text style={styles.cardTitle}>Informe final</Text>
          {!report ? (
            <Text style={styles.pendingText}>Todavía no hay un informe final publicado para este evento.</Text>
          ) : (
            <View style={styles.reportGap}>
              <StatusBadge label="Publicado" tone="success" />
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

              {report.selectedPhotos?.length > 0 ? (
                <>
                  <Text style={styles.reportSectionTitle}>Fotos seleccionadas por el ejecutivo</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
                    {report.selectedPhotos.map((photo) => (
                      <View key={photo.id} style={styles.photoCard}>
                        <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
                        <Text style={styles.photoCaption}>{photo.author?.fullName || 'Coordinación'}</Text>
                      </View>
                    ))}
                  </ScrollView>
                </>
              ) : null}
            </View>
          )}
        </SurfaceCard>

        <AppButton title="VOLVER A MIS EVENTOS" variant="secondary" onPress={() => setCurrentView('events')} />
      </ScreenShell>
    );
  };

  if (currentView === 'events') return renderEventList();
  if (currentView === 'detail' && selectedEvent) return renderEventDetail();
  return renderMenu();
};

const createStyles = (palette) => StyleSheet.create({
  content: { justifyContent: 'space-between' },
  metricsRow: { flexDirection: 'row', gap: SPACING.sm },
  metricCard: { flex: 1, alignItems: 'center', backgroundColor: palette.surfaceMuted },
  metricNumber: { fontSize: 30, fontWeight: '800', color: palette.text },
  metricLabel: { color: palette.textMuted, textAlign: 'center' },
  heroCard: { backgroundColor: palette.surfaceMuted },
  cardTitle: { fontSize: 20, fontWeight: '800', color: palette.text },
  cardText: { color: palette.textMuted, lineHeight: 20 },
  loading: { marginTop: 24 },
  emptyText: { color: '#FFFFFF', textAlign: 'center', marginTop: 28 },
  listGap: { gap: SPACING.md },
  eventCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, gap: 8 },
  eventTitle: { fontSize: 18, fontWeight: '800', color: palette.text },
  eventMeta: { color: palette.textMuted },
  detailRow: { color: '#374151', marginBottom: 6 },
  contactRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  contactButton: { flex: 1 },
  pendingText: { color: palette.textMuted, lineHeight: 20 },
  reportGap: { gap: 8 },
  reportTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  reportMeta: { color: '#6B7280', marginBottom: 4 },
  reportSectionTitle: { color: palette.text, fontWeight: '800', marginTop: 4 },
  reportBody: { color: '#374151', lineHeight: 20 },
  photoRow: { gap: 12, marginTop: 4 },
  photoCard: { width: 180, backgroundColor: palette.surfaceMuted, borderRadius: 14, padding: 10 },
  photoPreview: { width: '100%', height: 120, borderRadius: 10, marginBottom: 8 },
  photoCaption: { color: '#475569', fontSize: 12 },
});

export default ClientHomeScreen;
