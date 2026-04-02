import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView, ActivityIndicator, Image, Alert, Modal, TextInput } from 'react-native';
import { getEvents, inactivateEvent } from '../api/api';
import { COLORS } from '../theme/colors';
import { getInactiveBadgeLabel, getInactiveDescription } from '../utils/eventLifecycle';
import { getUserDisplayName } from '../utils/user';

const ReviewEventsScreen = ({ onBack, user, onEdit }) => {
  const theme = COLORS.green;
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [expandedSections, setExpandedSections] = useState({ active: false, inactive: false });
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
      setEvents(data);
    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar los eventos');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => new Date(date).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const formatTime = (date) => new Date(date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true });
  const activeEvents = events.filter((event) => !event.isInactive);
  const inactiveEvents = events.filter((event) => event.isInactive);

  const toggleSection = (section) => {
    setExpandedSections((current) => {
      const nextValue = !current[section];

      return {
        active: false,
        inactive: false,
        [section]: nextValue,
      };
    });
  };

  const closeInactivationModal = () => {
    setShowInactivationModal(false);
    setInactivationComment('');
  };

  const handleConfirmInactivation = async () => {
    if (!selectedEvent) {
      return;
    }

    if (!inactivationComment.trim()) {
      Alert.alert('Comentario obligatorio', 'Debés escribir un comentario para inactivar el evento');
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
    <TouchableOpacity style={[styles.eventButton, event.isInactive && styles.eventButtonInactive]} onPress={onPress}>
      <Image
        source={{ uri: event.image || 'https://cdn-icons-png.flaticon.com/512/1162/1162238.png' }}
        style={[styles.eventIcon, event.isInactive && styles.eventIconInactive]}
      />
      <View style={[styles.eventInfo, event.isInactive && styles.eventInfoInactive]}>
        <Text style={styles.eventTitle}>{event.name}</Text>
        <Text style={styles.eventSubtitle}>{event.client}</Text>
        <Text style={styles.description}>{formatDate(event.startDate)}</Text>
        {event.isInactive && <Text style={styles.inactiveBadge}>{getInactiveBadgeLabel(event)}</Text>}
      </View>
    </TouchableOpacity>
  );

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color="#FFF" /></View>;

  if (selectedEvent) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.primary }]}> 
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>DETALLE DEL EVENTO</Text>

          {selectedEvent.image && (
            <Image source={{ uri: selectedEvent.image }} style={[styles.detailImage, selectedEvent.isInactive && styles.eventIconInactive]} />
          )}

          <View style={styles.infoBox}>
            <Text style={styles.detailTitle}>{selectedEvent.name}</Text>
            <Text style={styles.detailLabel}>Cliente: <Text style={styles.detailValue}>{selectedEvent.client}</Text></Text>
            <Text style={styles.detailLabel}>Desde: <Text style={styles.detailValue}>{formatDate(selectedEvent.startDate)}</Text></Text>
            <Text style={styles.detailLabel}>Hasta: <Text style={styles.detailValue}>{formatDate(selectedEvent.endDate)}</Text></Text>
            {selectedEvent.isInactive && (
              <View style={styles.inactiveBox}>
                <Text style={styles.inactiveBoxTitle}>{getInactiveBadgeLabel(selectedEvent)}</Text>
                <Text style={styles.inactiveBoxText}>{getInactiveDescription(selectedEvent)}</Text>
              </View>
            )}
          </View>

          <View style={styles.dividerLarge} />

          {selectedEvent.cities?.map((city, cIndex) => (
            <View key={cIndex} style={styles.citySection}>
              <Text style={styles.cityName}>Ciudad: {city.name}</Text>
              {city.points?.map((point, pIndex) => (
                <View key={pIndex} style={styles.pointDetailCard}>
                  <Text style={styles.pointName}>{point.establishment}</Text>
                  <Text style={styles.pointInfo}>📍 {point.address}</Text>
                  <Text style={styles.pointInfo}>👤 {point.contact}</Text>
                  <Text style={styles.pointInfo}>📞 {point.phone}</Text>
                  <Text style={styles.pointInfo}>⏰ {formatTime(point.startTime)} - {formatTime(point.endTime)}</Text>

                  <View style={styles.coordSubSection}>
                    <Text style={styles.coordLabel}>Coordinador: {point.coordinator?.name}</Text>
                    <Text style={styles.staffCount}>Personas a cargo: {point.assignedStaff?.length || 0}</Text>
                    {point.assignedStaff?.map((st) => (
                      <Text key={st.id} style={styles.staffItem}>• {st.name}</Text>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          ))}

          {!selectedEvent.isInactive && (
            <>
              <TouchableOpacity style={styles.editButton} onPress={() => onEdit(selectedEvent)}>
                <Text style={styles.editButtonText}>EDITAR EVENTO</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.inactivateButton} onPress={() => setShowInactivationModal(true)}>
                <Text style={styles.inactivateButtonText}>INACTIVAR EVENTO</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.actionButton} onPress={() => setSelectedEvent(null)}>
            <Text style={styles.actionText}>REGRESAR A LA LISTA</Text>
          </TouchableOpacity>

          <Modal visible={showInactivationModal} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Inactivar evento</Text>
                <Text style={styles.modalText}>El comentario es obligatorio y queda guardado con el evento.</Text>
                <TextInput
                  style={styles.modalInput}
                  value={inactivationComment}
                  onChangeText={setInactivationComment}
                  placeholder="Escribí el comentario..."
                  placeholderTextColor="#888"
                  multiline
                  numberOfLines={4}
                  editable={!submittingInactivation}
                />
                <TouchableOpacity style={styles.inactivateButton} onPress={handleConfirmInactivation} disabled={submittingInactivation}>
                  <Text style={styles.inactivateButtonText}>{submittingInactivation ? 'GUARDANDO...' : 'CONFIRMAR INACTIVACIÓN'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={closeInactivationModal} disabled={submittingInactivation}>
                  <Text style={styles.actionText}>CANCELAR</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.primary }]}> 
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>MIS EVENTOS</Text>
          <Text style={styles.welcome}>Hola, {displayUsername}. Revisá tus eventos creados</Text>
        </View>

        <View style={styles.listContainer}>
          {events.length === 0 ? (
            <Text style={styles.emptyText}>No hay eventos creados actualmente.</Text>
          ) : (
            <>
              <View style={styles.sectionBlock}>
                <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection('active')}>
                  <Text style={styles.sectionTitle}>EVENTOS ACTIVOS ({activeEvents.length})</Text>
                  <Text style={styles.sectionChevron}>{expandedSections.active ? '▾' : '▸'}</Text>
                </TouchableOpacity>
                {expandedSections.active && (
                  activeEvents.length === 0 ? (
                    <Text style={styles.sectionEmpty}>No hay eventos activos.</Text>
                  ) : (
                    activeEvents.map((event) => <EventCard key={event.id} event={event} onPress={() => setSelectedEvent(event)} />)
                  )
                )}
              </View>

              <View style={styles.sectionBlock}>
                <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection('inactive')}>
                  <Text style={styles.sectionTitle}>EVENTOS INACTIVOS ({inactiveEvents.length})</Text>
                  <Text style={styles.sectionChevron}>{expandedSections.inactive ? '▾' : '▸'}</Text>
                </TouchableOpacity>
                {expandedSections.inactive && (
                  inactiveEvents.length === 0 ? (
                    <Text style={styles.sectionEmpty}>No hay eventos inactivos.</Text>
                  ) : (
                    inactiveEvents.map((event) => <EventCard key={event.id} event={event} onPress={() => setSelectedEvent(event)} />)
                  )
                )}
              </View>
            </>
          )}
        </View>

        <TouchableOpacity style={styles.actionButton} onPress={onBack}>
          <Text style={styles.actionText}>REGRESAR AL MENÚ</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, backgroundColor: COLORS.green.primary, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 20, paddingBottom: 60 },
  header: { alignItems: 'center', marginBottom: 30 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#FFF', textAlign: 'center' },
  welcome: { fontSize: 14, color: '#FFF', textAlign: 'center', marginTop: 10 },
  emptyText: { color: '#FFF', textAlign: 'center', opacity: 0.9 },
  listContainer: { gap: 20, marginBottom: 30 },
  sectionBlock: { gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.12)', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12 },
  sectionTitle: { fontSize: 17, fontWeight: 'bold', color: '#FFF' },
  sectionChevron: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  sectionEmpty: { color: '#D1D5DB', fontSize: 13 },
  eventButton: { backgroundColor: '#FFF', borderRadius: 15, overflow: 'hidden', elevation: 4 },
  eventButtonInactive: { backgroundColor: '#D1D5DB' },
  eventIcon: { width: '100%', height: 110, resizeMode: 'cover' },
  eventIconInactive: { opacity: 0.45 },
  eventInfo: { backgroundColor: '#FFD54F', paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center' },
  eventInfoInactive: { backgroundColor: '#D1D5DB' },
  eventTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', textAlign: 'center' },
  eventSubtitle: { fontSize: 13, fontWeight: 'bold', color: '#555', textAlign: 'center' },
  description: { fontSize: 11, color: '#666', marginTop: 4, textAlign: 'center' },
  inactiveBadge: { marginTop: 8, fontSize: 11, fontWeight: 'bold', color: '#555' },
  detailImage: { width: '100%', height: 200, borderRadius: 12, marginBottom: 20 },
  infoBox: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 15, borderRadius: 12 },
  detailTitle: { fontSize: 28, fontWeight: 'bold', color: '#FFB300', marginBottom: 15 },
  detailLabel: { fontSize: 16, color: '#FFF', fontWeight: 'bold', marginBottom: 5 },
  detailValue: { fontWeight: 'normal', color: '#EEE' },
  inactiveBox: { marginTop: 14, padding: 12, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.2)' },
  inactiveBoxTitle: { color: '#D1D5DB', fontWeight: 'bold', marginBottom: 6 },
  inactiveBoxText: { color: '#EEE' },
  dividerLarge: { height: 1, backgroundColor: '#FFF', marginVertical: 20, opacity: 0.3 },
  citySection: { marginBottom: 25 },
  cityName: { fontSize: 20, fontWeight: 'bold', color: '#FFF', marginBottom: 12 },
  pointDetailCard: { backgroundColor: 'rgba(255,255,255,0.1)', padding: 12, borderRadius: 10, marginBottom: 10 },
  pointName: { fontSize: 17, fontWeight: 'bold', color: '#FFB300', marginBottom: 5 },
  pointInfo: { fontSize: 14, color: '#FFF', marginBottom: 3 },
  coordSubSection: { marginTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', paddingTop: 10 },
  coordLabel: { fontSize: 15, fontWeight: 'bold', color: '#FFF' },
  staffCount: { fontSize: 13, color: '#DDD', marginVertical: 3 },
  staffItem: { fontSize: 12, color: '#EEE', marginLeft: 10 },
  editButton: { backgroundColor: '#FFB300', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  editButtonText: { color: '#333', fontWeight: 'bold', fontSize: 16 },
  inactivateButton: { backgroundColor: '#6B7280', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  inactivateButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  actionButton: { backgroundColor: '#D1D5DB', paddingVertical: 14, borderRadius: 30, alignItems: 'center', marginTop: 15 },
  actionText: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 10, textAlign: 'center' },
  modalText: { color: '#444', marginBottom: 12, textAlign: 'center' },
  modalInput: { minHeight: 110, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, padding: 12, textAlignVertical: 'top', color: '#222' },
});

export default ReviewEventsScreen;
