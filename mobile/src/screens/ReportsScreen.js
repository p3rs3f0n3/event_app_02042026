import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView, ActivityIndicator, Image, Alert, Modal, Linking } from 'react-native';
import { getEvents } from '../api/api';
import { COLORS } from '../theme/colors';

const ReportsScreen = ({ onBack, user }) => {
  const theme = COLORS.green;
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [modalType, setModalType] = useState(null);

  useEffect(() => { fetchEvents(); }, []);

  const fetchEvents = async () => {
    try {
      const data = await getEvents();
      setEvents(data);
    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar los informes');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const getPrimaryCoordinator = (event) => {
    for (const city of event?.cities || []) {
      for (const point of city?.points || []) {
        if (point?.coordinator) {
          return point.coordinator;
        }
      }
    }
    return null;
  };

  const EventCard = ({ event, onPress }) => (
    <TouchableOpacity style={styles.eventCard} onPress={onPress}>
      <Image source={{ uri: event.image || 'https://cdn-icons-png.flaticon.com/512/1162/1162238.png' }} style={styles.eventImage} />
      <View style={styles.eventInfo}>
        <Text style={styles.eventTitle}>{event.name}</Text>
        <Text style={styles.eventSubtitle}>GESTIÓN DE INFORMES</Text>
      </View>
    </TouchableOpacity>
  );

  const openWhatsApp = async (event) => {
    const coordinator = getPrimaryCoordinator(event);
    const phone = coordinator?.phone?.replace(/\D/g, '');

    if (!phone) {
      Alert.alert('Sin contacto', 'Este evento no tiene teléfono de coordinador disponible.');
      return;
    }

    const whatsappUrl = `whatsapp://send?phone=${phone}`;
    const canOpen = await Linking.canOpenURL(whatsappUrl);

    if (!canOpen) {
      Alert.alert('WhatsApp no disponible', 'No se pudo abrir WhatsApp en este dispositivo.');
      return;
    }

    Linking.openURL(whatsappUrl);
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color="#FFF" /></View>;

  if (selectedEvent) {
    const primaryCoordinator = getPrimaryCoordinator(selectedEvent);

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.primary }]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.appTitle}>EVENTAPP</Text>
          
          <View style={styles.reportHeader}>
            <Image source={{ uri: selectedEvent.image }} style={styles.headerImage} />
            <Text style={styles.headerTitle}>{selectedEvent.name}</Text>
            
            <View style={styles.headerInfo}>
              <Text style={styles.headerText}>Desde: {formatDate(selectedEvent.startDate)}</Text>
              <Text style={styles.headerText}>Hasta: {formatDate(selectedEvent.endDate)}</Text>
              <Text style={styles.headerText}>Coordinador: {primaryCoordinator?.name || 'No asignado'}</Text>
            </View>

            <TouchableOpacity style={[styles.whatsappIcon, !primaryCoordinator?.phone && styles.whatsappIconDisabled]} onPress={() => openWhatsApp(selectedEvent)}>
              <View style={styles.waCircle}><Text style={styles.waText}>WA</Text></View>
              <Text style={styles.waLabel}>Chat con Coord</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.bigButton} onPress={() => setModalType('fotos')}>
              <Text style={styles.bigButtonText}>Fotos</Text>
              <Text style={styles.subBtnText}>Galería Visual</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bigButton} onPress={() => setModalType('informes')}>
              <Text style={styles.bigButtonText}>Informes</Text>
              <Text style={styles.subBtnText}>Documentación</Text>
            </TouchableOpacity>
          </View>
          
          <Modal visible={modalType !== null} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>{modalType === 'fotos' ? 'FOTOS DE GESTIÓN' : 'INFORMES RECIBIDOS'}</Text>
                
                <ScrollView contentContainerStyle={styles.modalScroll}>
                  {modalType === 'fotos' ? (
                    <View style={styles.photoGrid}>
                      {selectedEvent.photos?.map((url, i) => (
                        <Image key={i} source={{ uri: url }} style={styles.gridPhoto} />
                      ))}
                    </View>
                  ) : (
                    selectedEvent.reports?.map((rep, i) => (
                      <View key={i} style={styles.reportItem}>
                        <Text style={styles.reportItemTitle}>{rep.title}</Text>
                        <Text style={styles.reportItemDate}>{rep.date}</Text>
                        <Text style={styles.reportItemContent}>{rep.content}</Text>
                      </View>
                    ))
                  )}
                </ScrollView>

                <TouchableOpacity style={styles.closeBtn} onPress={() => setModalType(null)}>
                  <Text style={styles.closeBtnText}>CERRAR</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          <TouchableOpacity style={styles.backButton} onPress={() => setSelectedEvent(null)}>
            <Text style={styles.backText}>REGRESAR A LISTA</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.primary }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.appTitle}>EVENTAPP</Text>
        <Text style={styles.subtitle}>Informes de Eventos Creados</Text>
        
        <View style={styles.listContainer}>
          {events.length === 0 ? (
            <Text style={styles.emptyText}>No hay eventos registrados.</Text>
          ) : (
            events.map(event => <EventCard key={event.id} event={event} onPress={() => setSelectedEvent(event)} />)
          )}
        </View>

        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backText}>REGRESAR AL MENÚ</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, backgroundColor: COLORS.green.primary, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 20, paddingBottom: 60 },
  appTitle: { fontSize: 36, fontWeight: 'bold', color: '#FFF', textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#FFF', textAlign: 'center', marginBottom: 30 },
  listContainer: { gap: 20, marginBottom: 30 },
  eventCard: { backgroundColor: '#FFF', borderRadius: 15, overflow: 'hidden', elevation: 5 },
  eventImage: { width: '100%', height: 160 },
  eventInfo: { backgroundColor: '#FFD54F', padding: 12, alignItems: 'center' },
  eventTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  eventSubtitle: { fontSize: 12, color: '#666', fontWeight: 'bold' },
  reportHeader: { alignItems: 'center', marginBottom: 25, backgroundColor: 'rgba(255,255,255,0.15)', padding: 20, borderRadius: 15 },
  headerImage: { width: 90, height: 90, borderRadius: 45, marginBottom: 12 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#FFB300', marginBottom: 12 },
  headerInfo: { gap: 4, alignItems: 'center' },
  headerText: { fontSize: 14, color: '#FFF' },
  whatsappIcon: { marginTop: 15, alignItems: 'center' },
  whatsappIconDisabled: { opacity: 0.6 },
  waCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#25D366', justifyContent: 'center', alignItems: 'center' },
  waText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  waLabel: { color: '#FFF', fontSize: 10, marginTop: 4 },
  actionButtons: { flexDirection: 'row', justifyContent: 'space-between', gap: 15 },
  bigButton: { flex: 1, backgroundColor: '#D1D5DB', paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  bigButtonText: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  subBtnText: { fontSize: 10, color: '#666' },
  backButton: { backgroundColor: '#D1D5DB', paddingVertical: 14, borderRadius: 30, alignItems: 'center', marginTop: 30 },
  backText: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color: '#333' },
  modalScroll: { gap: 12 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  gridPhoto: { width: '45%', height: 110, borderRadius: 8 },
  reportItem: { backgroundColor: '#F0F0F0', padding: 12, borderRadius: 8 },
  reportItemTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  reportItemDate: { fontSize: 11, color: '#888', marginVertical: 3 },
  reportItemContent: { fontSize: 13, color: '#444' },
  closeBtn: { backgroundColor: '#FFB300', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 15 },
  closeBtnText: { fontWeight: 'bold', color: '#333' },
  emptyText: { color: '#FFF', textAlign: 'center', marginTop: 40 }
});

export default ReportsScreen;
