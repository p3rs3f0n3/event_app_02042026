import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { getClientEvents } from '../api/api';
import { APP_DISPLAY_NAME } from '../config/appMetadata';
import UserProfileCard from '../components/UserProfileCard';
import { normalizeExecutiveReport } from '../utils/executiveReport';
import { contactByPhoneCall, contactByWhatsApp } from '../utils/contact';
import { getUserDisplayName } from '../utils/user';
import { AppButton, ScreenShell, SectionTitle, StatusBadge, SurfaceCard } from '../components/ui';
import { getAppPalette, getResponsiveTokens } from '../theme/tokens';
import { shareClientReportPdf } from '../utils/clientReportPdf';
import { useResponsiveMetrics } from '../utils/responsive';
import { getEventVisualState } from '../utils/eventLifecycle';

const formatDate = (value) => {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatDateTime = (value) => {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return date.toLocaleString('es-ES');
};

const ClientHomeScreen = ({ user, onLogout, appConfig, roleConfig, notificationData = null, onNotificationHandled = null }) => {
  const [currentView, setCurrentView] = useState('menu');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const lastHandledNotificationIdRef = useRef(null);
  const displayUsername = getUserDisplayName(user);
  const metrics = useResponsiveMetrics();
  const tokens = getResponsiveTokens(metrics);
  const palette = getAppPalette(roleConfig?.theme || 'blue');
  const styles = useMemo(() => createStyles(palette, metrics, tokens), [palette, metrics, tokens]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const response = await getClientEvents(user?.id);
      const nextEvents = Array.isArray(response) ? response : [];
      setEvents(nextEvents);

      if (selectedEvent) {
        const refreshedSelected = nextEvents.find((item) => String(item.id) === String(selectedEvent.id));
        if (refreshedSelected) {
          setSelectedEvent(refreshedSelected);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar tus eventos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id && (currentView === 'menu' || currentView === 'events')) {
      fetchEvents();
    }
  }, [currentView, user?.id]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && user?.id) {
        fetchEvents();
      }
    });

    return () => subscription.remove();
  }, [user?.id, currentView, selectedEvent]);

  useEffect(() => {
    const notificationId = notificationData?.notificationId || null;
    const eventId = notificationData?.data?.eventId;

    if (!notificationId || !eventId || !events.length || lastHandledNotificationIdRef.current === notificationId) {
      return;
    }

    const nextEvent = events.find((event) => Number(event.id) === Number(eventId));
    if (nextEvent) {
      lastHandledNotificationIdRef.current = notificationId;
      setSelectedPhoto(null);
      setSelectedEvent(nextEvent);
      setCurrentView('detail');
      onNotificationHandled?.(notificationId);
    }
  }, [notificationData, events, onNotificationHandled]);

  const handleDownloadPdf = async (event, report, points) => {
    setDownloadingPdf(true);
    try {
      await shareClientReportPdf({ event, report, points });
    } catch (error) {
      Alert.alert('Error', error?.message || 'No se pudo generar el PDF del informe.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const publishedEvents = useMemo(() => events.filter((event) => normalizeExecutiveReport(event.executiveReport)), [events]);

  const renderMenu = () => (
    <ScreenShell palette={palette} contentContainerStyle={styles.content}>
      <SectionTitle
        kicker="Portal cliente"
        title={appConfig?.appName || APP_DISPLAY_NAME}
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
        <Text style={styles.cardText}>Acceso a reportes con el fin de realizar seguimiento a los diferentes eventos.</Text>
      </SurfaceCard>

      <UserProfileCard
        user={user}
        palette={palette}
        title="Mi perfil cliente"
        description={`Sesión activa como @${user?.username}.`}
        buttonLabel="MI CONTRASEÑA"
        buttonVariant="primary"
      />

      <AppButton title="VER MIS EVENTOS" onPress={() => setCurrentView('events')} />
      <AppButton title="SALIR" variant="secondary" onPress={onLogout} />
    </ScreenShell>
  );

  const renderEventList = () => (
    <ScreenShell palette={palette}>
      <SectionTitle kicker="Eventos" title="Mis eventos" subtitle="Informes finales publicados." />

      {loading ? <ActivityIndicator color="#FFFFFF" size="large" style={styles.loading} /> : null}
      {!loading && events.length === 0 ? <Text style={styles.emptyText}>Todavía no tienes eventos vinculados.</Text> : null}

      <View style={styles.listGap}>
        {events.map((event) => {
          const publishedReport = normalizeExecutiveReport(event.executiveReport);
          const visualState = getEventVisualState(event);

          return (
            <TouchableOpacity key={event.id} style={styles.eventCard} onPress={() => { setSelectedEvent(event); setCurrentView('detail'); }}>
              <Text style={styles.eventTitle}>{event.name}</Text>
              <Text style={styles.eventMeta}>{event.client}</Text>
              <Text style={styles.eventMeta}>{formatDate(event.startDate)} → {formatDate(event.endDate)}</Text>
              <StatusBadge label={visualState.label} tone={visualState.tone} />
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
    const executive = event?.executive || null;
    const hasExecutiveAssociation = Boolean(executive?.id);

    if (__DEV__) {
      console.log('[ClientHomeScreen] photos received', {
        eventId: event?.id,
        total: event?.photos?.length || 0,
        photos: event?.photos || [],
      });
    }

    return (
      <ScreenShell palette={palette}>
        <SectionTitle title={event?.name} subtitle={`${event?.client} · visión compartida con el cliente`} />

        <StatusBadge label={getEventVisualState(event).label} tone={getEventVisualState(event).tone} />

        <SurfaceCard>
          <Text style={styles.cardTitle}>Resumen del evento</Text>
          <Text style={styles.detailRow}>Cliente: {event?.client}</Text>
          <Text style={styles.detailRow}>Inicio: {formatDate(event?.startDate)}</Text>
          <Text style={styles.detailRow}>Fin: {formatDate(event?.endDate)}</Text>
          {getEventVisualState(event).isInactive ? <Text style={styles.pendingText}>{getEventVisualState(event).description}</Text> : null}
          <Text style={styles.detailRow}>Ciudades: {event?.cities?.length || 0}</Text>
          <Text style={styles.detailRow}>Puntos operativos: {points}</Text>
        </SurfaceCard>

        {Array.isArray(event?.photos) && event.photos.length > 0 ? (
          <SurfaceCard>
            <Text style={styles.cardTitle}>Galería del evento</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
              {event.photos.map((photo) => (
                <TouchableOpacity key={photo.id} style={styles.photoCard} activeOpacity={0.9} onPress={() => setSelectedPhoto(photo)}>
                  <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
                  <Text style={styles.photoCaption}>{photo.milestoneType === 'start_photo' ? 'Foto inicio' : photo.milestoneType === 'end_photo' ? 'Foto fin' : 'Foto'}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </SurfaceCard>
        ) : null}

        <SurfaceCard>
          <Text style={styles.cardTitle}>Contacto ejecutivo</Text>
          <Text style={styles.detailRow}>{event?.executive?.name || event?.executive?.fullName || 'Ejecutivo no informado'}</Text>
          <Text style={styles.detailRow}>{event?.executive?.email || 'Sin email'}</Text>
          <View style={styles.contactRow}>
            <AppButton title="LLAMAR" variant="secondary" style={styles.contactButton} disabled={!hasExecutiveAssociation} onPress={() => contactByPhoneCall(executive)} />
            <AppButton title="WHATSAPP" variant="secondary" style={styles.contactButton} disabled={!hasExecutiveAssociation} onPress={() => contactByWhatsApp(executive)} />
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
              <Text style={styles.reportMeta}>Publicado: {formatDateTime(report.publishedAt)}</Text>
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
                      <TouchableOpacity key={photo.id} style={styles.photoCard} activeOpacity={0.9} onPress={() => setSelectedPhoto(photo)}>
                        <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
                        <Text style={styles.photoCaption}>{photo.author?.fullName || 'Coordinación'}</Text>
                        <Text style={styles.photoHint}>Tocá la foto para verla grande</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              ) : null}

              <AppButton title={downloadingPdf ? 'GENERANDO PDF...' : 'DESCARGAR INFORME PDF'} variant="secondary" disabled={downloadingPdf} onPress={() => handleDownloadPdf(event, report, points)} />
            </View>
          )}
        </SurfaceCard>

        <AppButton title="VOLVER A MIS EVENTOS" variant="secondary" onPress={() => setCurrentView('events')} />

        <Modal visible={Boolean(selectedPhoto)} transparent animationType="fade" onRequestClose={() => setSelectedPhoto(null)}>
          <Pressable style={styles.photoModalBackdrop} onPress={() => setSelectedPhoto(null)}>
            <View style={styles.photoModalCard}>
              {selectedPhoto ? <Image source={{ uri: selectedPhoto.uri }} style={styles.photoModalImage} /> : null}
              <Text style={styles.photoModalCaption}>{selectedPhoto?.author?.fullName || 'Coordinación'}</Text>
              <AppButton title="CERRAR" variant="secondary" onPress={() => setSelectedPhoto(null)} />
            </View>
          </Pressable>
        </Modal>
      </ScreenShell>
    );
  };

  if (currentView === 'events') return renderEventList();
  if (currentView === 'detail' && selectedEvent) return renderEventDetail();
  return renderMenu();
};

const createStyles = (palette, metrics, tokens) => StyleSheet.create({
  content: { justifyContent: 'space-between' },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm },
  metricCard: { flex: 1, alignItems: 'center', backgroundColor: palette.surfaceMuted },
  metricNumber: { fontSize: metrics.font(30, 0.95), fontWeight: '800', color: palette.text },
  metricLabel: { color: palette.textMuted, textAlign: 'center', fontSize: tokens.typography.body },
  heroCard: { backgroundColor: palette.surfaceMuted },
  cardTitle: { fontSize: metrics.cardTitleSize, fontWeight: '800', color: palette.text },
  cardText: { color: palette.textMuted, fontSize: tokens.typography.body, lineHeight: metrics.font(20, 0.85) },
  loading: { marginTop: metrics.spacing(24) },
  emptyText: { color: '#FFFFFF', textAlign: 'center', marginTop: metrics.spacing(28), fontSize: tokens.typography.body },
  listGap: { gap: tokens.spacing.md },
  eventCard: { backgroundColor: '#FFFFFF', borderRadius: tokens.radii.md, padding: tokens.spacing.md, gap: tokens.spacing.xs },
  eventTitle: { fontSize: metrics.font(18, 0.9), fontWeight: '800', color: palette.text },
  eventMeta: { color: palette.textMuted, fontSize: tokens.typography.body },
  detailRow: { color: '#374151', marginBottom: metrics.spacing(6, 0.8), fontSize: tokens.typography.body },
  contactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm, marginTop: tokens.spacing.sm },
  contactButton: { flexGrow: 1, flexBasis: metrics.compactWidth ? '100%' : 0 },
  pendingText: { color: palette.textMuted, fontSize: tokens.typography.body, lineHeight: metrics.font(20, 0.85) },
  reportGap: { gap: tokens.spacing.xs },
  reportTitle: { fontSize: metrics.cardTitleSize, fontWeight: '800', color: '#111827' },
  reportMeta: { color: '#6B7280', marginBottom: metrics.spacing(4, 0.75), fontSize: tokens.typography.caption },
  reportSectionTitle: { color: palette.text, fontWeight: '800', marginTop: metrics.spacing(4, 0.75), fontSize: tokens.typography.body },
  reportBody: { color: '#374151', fontSize: tokens.typography.body, lineHeight: metrics.font(20, 0.85) },
  photoRow: { gap: tokens.spacing.sm, marginTop: metrics.spacing(4, 0.75) },
  photoCard: { width: metrics.size(180), backgroundColor: palette.surfaceMuted, borderRadius: tokens.radii.sm, padding: tokens.spacing.sm },
  photoPreview: { width: '100%', height: metrics.size(120), borderRadius: metrics.radius(10), marginBottom: tokens.spacing.xs },
  photoCaption: { color: '#475569', fontSize: tokens.typography.caption },
  photoHint: { color: palette.hero, fontSize: metrics.font(11, 0.75), marginTop: metrics.spacing(6, 0.8), fontWeight: '700' },
  photoModalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.88)', alignItems: 'center', justifyContent: 'center', padding: tokens.spacing.lg },
  photoModalCard: { width: '100%', maxWidth: metrics.modalMaxWidth, backgroundColor: '#FFFFFF', borderRadius: tokens.radii.lg, padding: tokens.spacing.md, gap: tokens.spacing.sm },
  photoModalImage: { width: '100%', height: Math.max(metrics.size(240, 0.9), Math.min(metrics.size(420, 0.95), Math.round(metrics.height * 0.58))), borderRadius: metrics.radius(16), resizeMode: 'contain', backgroundColor: '#0F172A' },
  photoModalCaption: { color: '#475569', textAlign: 'center', fontSize: tokens.typography.body },
});

export default ClientHomeScreen;
