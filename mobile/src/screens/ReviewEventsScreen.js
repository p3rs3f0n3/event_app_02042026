import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Alert, Modal, TextInput } from 'react-native';

import { getEvents, inactivateEvent } from '../api/api';
import { AppButton, ScreenShell, SectionTitle, StatusBadge, SurfaceCard } from '../components/ui';
import { getEventStatus, getInactiveBadgeLabel, getInactiveDescription } from '../utils/eventLifecycle';
import { getUserDisplayName } from '../utils/user';
import { getAppPalette, getResponsiveTokens } from '../theme/tokens';
import { useResponsiveMetrics } from '../utils/responsive';

const getCoordinatorDisplayName = (coordinator) => coordinator?.name || coordinator?.fullName || 'Sin coordinador';
const getStaffDisplayName = (staffMember) => staffMember?.name || staffMember?.fullName || 'Sin nombre';

const ReviewEventsScreen = ({ onBack, user, onEdit }) => {
  const metrics = useResponsiveMetrics();
  const tokens = getResponsiveTokens(metrics);
  const palette = getAppPalette('green');
  const styles = useMemo(() => createStyles(palette, metrics, tokens), [palette, metrics, tokens]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [expandedSections, setExpandedSections] = useState({ active: true, inactive: false });
  const [showInactivationModal, setShowInactivationModal] = useState(false);
  const [inactivationComment, setInactivationComment] = useState('');
  const [submittingInactivation, setSubmittingInactivation] = useState(false);
  const displayUsername = getUserDisplayName(user);

  useEffect(() => {
    fetchEvents();
  }, [user?.id]);

  const fetchEvents = async () => {
    try {
      const data = await getEvents(user?.id);
      setEvents(Array.isArray(data) ? data : []);
    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar los eventos');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => new Date(date).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const formatTime = (date) => new Date(date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true });
  const activeEvents = events.filter((event) => (event.eventStatus || getEventStatus(event)) === 'active');
  const inactiveEvents = events.filter((event) => (event.eventStatus || getEventStatus(event)) !== 'active');

  const toggleSection = (section) => {
    setExpandedSections((current) => ({
      active: false,
      inactive: false,
      [section]: !current[section],
    }));
  };

  const closeInactivationModal = () => {
    setShowInactivationModal(false);
    setInactivationComment('');
  };

  const handleConfirmInactivation = async () => {
    if (!selectedEvent) return;

    if (!inactivationComment.trim()) {
      Alert.alert('Comentario obligatorio', 'Debes escribir un comentario para inactivar el evento');
      return;
    }

    setSubmittingInactivation(true);
    try {
      const updatedEvent = await inactivateEvent(selectedEvent.id, {
        createdByUserId: user?.id,
        comment: inactivationComment.trim(),
      });

      setEvents((currentEvents) => currentEvents.map((event) => (event.id === updatedEvent.id ? updatedEvent : event)));
      setSelectedEvent(updatedEvent);
      closeInactivationModal();
      Alert.alert('Éxito', 'El evento quedó inactivo');
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.message || 'No se pudo inactivar el evento');
    } finally {
      setSubmittingInactivation(false);
    }
  };

  const EventCard = ({ event, onPress }) => (
    <TouchableOpacity style={[styles.eventButton, (event.eventStatus || getEventStatus(event)) !== 'active' && styles.eventButtonInactive]} onPress={onPress}>
      <Image source={{ uri: event.image || 'https://cdn-icons-png.flaticon.com/512/1162/1162238.png' }} style={[styles.eventIcon, (event.eventStatus || getEventStatus(event)) !== 'active' && styles.eventIconInactive]} />
      <View style={[styles.eventInfo, (event.eventStatus || getEventStatus(event)) !== 'active' && styles.eventInfoInactive]}>
        <Text style={styles.eventTitle}>{event.name}</Text>
        <Text style={styles.eventSubtitle}>{event.client}</Text>
        <Text style={styles.description}>{formatDate(event.startDate)}</Text>
        {(event.eventStatus || getEventStatus(event)) !== 'active' ? <StatusBadge label={getInactiveBadgeLabel(event)} tone="muted" /> : null}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <ScreenShell palette={palette} contentContainerStyle={styles.loadingShell}>
        <ActivityIndicator size="large" color="#FFF" />
        <Text style={styles.loadingText}>Cargando eventos del ejecutivo...</Text>
      </ScreenShell>
    );
  }

  if (selectedEvent) {
    return (
      <ScreenShell palette={palette} contentContainerStyle={styles.screenContent}>
        <SectionTitle title="Detalle del evento" subtitle="Revisión operativa y acciones administrativas del ejecutivo." />

        {selectedEvent.image ? (
          <Image source={{ uri: selectedEvent.image }} style={[styles.detailImage, selectedEvent.isInactive && styles.eventIconInactive]} />
        ) : null}

        <SurfaceCard style={styles.infoBox}>
          <Text style={styles.detailTitle}>{selectedEvent.name}</Text>
          <Text style={styles.detailLabel}>Cliente: <Text style={styles.detailValue}>{selectedEvent.client}</Text></Text>
          <Text style={styles.detailLabel}>Desde: <Text style={styles.detailValue}>{formatDate(selectedEvent.startDate)}</Text></Text>
          <Text style={styles.detailLabel}>Hasta: <Text style={styles.detailValue}>{formatDate(selectedEvent.endDate)}</Text></Text>
          {selectedEvent.isInactive ? (
            <View style={styles.inactiveBox}>
              <Text style={styles.inactiveBoxTitle}>{getInactiveBadgeLabel(selectedEvent)}</Text>
              <Text style={styles.inactiveBoxText}>{getInactiveDescription(selectedEvent)}</Text>
            </View>
          ) : null}
        </SurfaceCard>

        {(selectedEvent.cities || []).map((city, cIndex) => (
          <View key={cIndex} style={styles.citySection}>
            <Text style={styles.cityName}>Ciudad: {city.name}</Text>
            {city.points?.map((point, pIndex) => (
              <SurfaceCard key={pIndex} style={styles.pointDetailCard}>
                <Text style={styles.pointName}>{point.establishment}</Text>
                <Text style={styles.pointInfo}>📍 {point.address}</Text>
                <Text style={styles.pointInfo}>👤 {point.contact}</Text>
                <Text style={styles.pointInfo}>📞 {point.phone}</Text>
                <Text style={styles.pointInfo}>⏰ {formatTime(point.startTime)} - {formatTime(point.endTime)}</Text>

                <View style={styles.coordSubSection}>
                  <Text style={styles.coordLabel}>Coordinador: {getCoordinatorDisplayName(point.coordinator)}</Text>
                  <Text style={styles.staffCount}>Personas a cargo: {point.assignedStaff?.length || 0}</Text>
                  {point.assignedStaff?.map((st) => (
                    <Text key={st.id} style={styles.staffItem}>• {getStaffDisplayName(st)}</Text>
                  ))}
                </View>
              </SurfaceCard>
            ))}
          </View>
        ))}

          {(selectedEvent.eventStatus || getEventStatus(selectedEvent)) === 'active' ? (
            <>
              <AppButton title="EDITAR EVENTO" onPress={() => onEdit(selectedEvent)} />
              <AppButton title="INACTIVAR EVENTO" variant="danger" onPress={() => setShowInactivationModal(true)} />
            </>
          ) : null}

        <AppButton title="REGRESAR A LA LISTA" variant="secondary" onPress={() => setSelectedEvent(null)} />

        <Modal visible={showInactivationModal} transparent animationType="fade" onRequestClose={closeInactivationModal}>
          <View style={styles.modalOverlay}>
            <SurfaceCard style={styles.modalCard}>
              <Text style={styles.modalTitle}>Inactivar evento</Text>
              <Text style={styles.modalText}>El comentario es obligatorio y queda guardado con el evento.</Text>
              <TextInput
                style={styles.modalInput}
                value={inactivationComment}
                onChangeText={setInactivationComment}
                placeholder="Escribe el comentario..."
                placeholderTextColor="#888"
                multiline
                numberOfLines={4}
                editable={!submittingInactivation}
              />
              <AppButton title={submittingInactivation ? 'GUARDANDO...' : 'CONFIRMAR INACTIVACIÓN'} variant="danger" onPress={handleConfirmInactivation} disabled={submittingInactivation} />
              <AppButton title="CANCELAR" variant="secondary" onPress={closeInactivationModal} disabled={submittingInactivation} />
            </SurfaceCard>
          </View>
        </Modal>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell palette={palette} contentContainerStyle={styles.screenContent}>
      <SectionTitle title="Mis eventos" subtitle={`Hola, ${displayUsername}. Revisa tus eventos creados.`} />

      <View style={styles.listContainer}>
        {events.length === 0 ? (
          <Text style={styles.emptyText}>No hay eventos creados actualmente.</Text>
        ) : (
          <>
            <SurfaceCard style={styles.sectionBlock}>
              <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection('active')}>
                <Text style={styles.sectionTitle}>EVENTOS ACTIVOS ({activeEvents.length})</Text>
                <Text style={styles.sectionChevron}>{expandedSections.active ? '▾' : '▸'}</Text>
              </TouchableOpacity>
              {expandedSections.active ? (activeEvents.length === 0 ? <Text style={styles.sectionEmpty}>No hay eventos activos.</Text> : activeEvents.map((event) => <EventCard key={event.id} event={event} onPress={() => setSelectedEvent(event)} />)) : null}
            </SurfaceCard>

            <SurfaceCard style={styles.sectionBlock}>
              <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection('inactive')}>
                <Text style={styles.sectionTitle}>EVENTOS INACTIVOS ({inactiveEvents.length})</Text>
                <Text style={styles.sectionChevron}>{expandedSections.inactive ? '▾' : '▸'}</Text>
              </TouchableOpacity>
              {expandedSections.inactive ? (inactiveEvents.length === 0 ? <Text style={styles.sectionEmpty}>No hay eventos inactivos.</Text> : inactiveEvents.map((event) => <EventCard key={event.id} event={event} onPress={() => setSelectedEvent(event)} />)) : null}
            </SurfaceCard>
          </>
        )}
      </View>

      <AppButton title="REGRESAR AL MENÚ" variant="secondary" onPress={onBack} />
    </ScreenShell>
  );
};

const createStyles = (palette, metrics, tokens) => StyleSheet.create({
  screenContent: { gap: tokens.spacing.md },
  loadingShell: { justifyContent: 'center', alignItems: 'center', gap: tokens.spacing.sm },
  loadingText: { color: palette.onHero, fontWeight: '700', textAlign: 'center' },
  emptyText: { color: palette.onHero, textAlign: 'center', opacity: 0.9 },
  listContainer: { gap: tokens.spacing.md },
  sectionBlock: { gap: tokens.spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tokens.spacing.sm },
  sectionTitle: { flex: 1, fontSize: metrics.font(17, 0.9), fontWeight: '800', color: palette.text },
  sectionChevron: { color: palette.text, fontSize: metrics.font(20, 0.9), fontWeight: 'bold' },
  sectionEmpty: { color: palette.textMuted, fontSize: tokens.typography.caption },
  eventButton: { backgroundColor: palette.surfaceMuted, borderRadius: tokens.radii.sm, overflow: 'hidden' },
  eventButtonInactive: { backgroundColor: palette.secondaryButton },
  eventIcon: { width: '100%', height: metrics.size(130, 0.98), resizeMode: 'cover' },
  eventIconInactive: { opacity: 0.45 },
  eventInfo: { backgroundColor: palette.primaryButton, paddingVertical: tokens.spacing.sm, paddingHorizontal: tokens.spacing.sm, alignItems: 'center', gap: tokens.spacing.xs },
  eventInfoInactive: { backgroundColor: palette.secondaryButton },
  eventTitle: { fontSize: metrics.font(18, 0.9), fontWeight: 'bold', color: palette.primaryButtonText, textAlign: 'center' },
  eventSubtitle: { fontSize: metrics.font(13, 0.85), fontWeight: 'bold', color: '#555', textAlign: 'center' },
  description: { fontSize: tokens.typography.caption, color: '#666', textAlign: 'center' },
  detailImage: { width: '100%', height: metrics.size(220, 1), borderRadius: tokens.radii.md },
  infoBox: { backgroundColor: palette.panelStrong, gap: tokens.spacing.xs },
  detailTitle: { fontSize: metrics.font(28, 0.95), fontWeight: 'bold', color: palette.primaryButton },
  detailLabel: { fontSize: metrics.font(16, 0.88), color: palette.onHero, fontWeight: 'bold' },
  detailValue: { fontWeight: 'normal', color: '#EEE' },
  inactiveBox: { marginTop: tokens.spacing.sm, padding: tokens.spacing.sm, borderRadius: tokens.radii.sm, backgroundColor: 'rgba(0,0,0,0.2)', gap: tokens.spacing.xs },
  inactiveBoxTitle: { color: '#D1D5DB', fontWeight: 'bold' },
  inactiveBoxText: { color: '#EEE', lineHeight: metrics.font(19, 0.85) },
  citySection: { gap: tokens.spacing.sm },
  cityName: { fontSize: metrics.font(20, 0.9), fontWeight: 'bold', color: palette.onHero },
  pointDetailCard: { backgroundColor: palette.panel, gap: tokens.spacing.xs },
  pointName: { fontSize: metrics.font(17, 0.88), fontWeight: 'bold', color: palette.primaryButton },
  pointInfo: { fontSize: tokens.typography.body, color: palette.onHero },
  coordSubSection: { marginTop: tokens.spacing.sm, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', paddingTop: tokens.spacing.sm, gap: metrics.spacing(3, 0.8) },
  coordLabel: { fontSize: metrics.font(15, 0.86), fontWeight: 'bold', color: palette.onHero },
  staffCount: { fontSize: metrics.font(13, 0.84), color: '#DDD' },
  staffItem: { fontSize: tokens.typography.caption, color: '#EEE', marginLeft: metrics.spacing(10, 0.8) },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: tokens.layout.screenPadding },
  modalCard: { width: '100%', maxWidth: tokens.layout.modalMaxWidth, alignSelf: 'center', gap: tokens.spacing.sm },
  modalTitle: { fontSize: metrics.font(22, 0.92), fontWeight: 'bold', color: palette.text, textAlign: 'center' },
  modalText: { color: '#444', textAlign: 'center', lineHeight: metrics.font(19, 0.85) },
  modalInput: { minHeight: metrics.size(110, 0.95), borderWidth: 1, borderColor: palette.inputBorder, borderRadius: tokens.radii.sm, padding: tokens.spacing.sm, textAlignVertical: 'top', color: '#222', fontSize: tokens.typography.bodyLg, backgroundColor: '#FFF' },
});

export default ReviewEventsScreen;
