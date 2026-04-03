import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView, ActivityIndicator, Image, Alert, TextInput } from 'react-native';
import { getEvents, saveExecutiveEventReport } from '../api/api';
import { COLORS } from '../theme/colors';
import { normalizePhotos, normalizeReports } from '../utils/eventAssets';
import { createExecutiveReportDraft, normalizeExecutiveReport } from '../utils/executiveReport';

const FORM_FIELDS = [
  ['title', 'Título'],
  ['executiveSummary', 'Resumen ejecutivo'],
  ['objectivesCompliance', 'Cumplimiento de objetivos'],
  ['resultsImpact', 'Resultados / impacto'],
  ['redemptions', 'Redenciones / aclaración'],
  ['highlights', 'Hallazgos o highlights'],
  ['incidents', 'Incidentes'],
  ['recommendations', 'Recomendaciones'],
];

const formatDate = (value) => new Date(value).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
const formatDateTime = (value) => (value ? new Date(value).toLocaleString('es-ES') : 'Sin fecha');

const ReportsScreen = ({ onBack, user }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [draft, setDraft] = useState(createExecutiveReportDraft());
  const [saving, setSaving] = useState(false);

  const fetchEvents = async (preserveSelected = true) => {
    try {
      const data = await getEvents(user?.id);
      setEvents(Array.isArray(data) ? data : []);

      if (preserveSelected && selectedEventId) {
        const nextSelected = (Array.isArray(data) ? data : []).find((event) => event.id === selectedEventId);
        if (nextSelected) {
          setDraft(createExecutiveReportDraft(nextSelected.executiveReport));
        }
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar los eventos del ejecutivo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents(false);
  }, [user?.id]);

  const selectedEvent = useMemo(() => events.find((event) => event.id === selectedEventId) || null, [events, selectedEventId]);
  const photos = useMemo(() => normalizePhotos(selectedEvent?.photos), [selectedEvent?.photos]);
  const reports = useMemo(() => normalizeReports(selectedEvent?.reports), [selectedEvent?.reports]);
  const executiveReport = useMemo(() => normalizeExecutiveReport(selectedEvent?.executiveReport), [selectedEvent?.executiveReport]);

  const handleSelectEvent = (event) => {
    setSelectedEventId(event.id);
    setDraft(createExecutiveReportDraft(event.executiveReport));
  };

  const toggleSelection = (fieldName, value) => {
    setDraft((current) => {
      const exists = current[fieldName].includes(value);
      return {
        ...current,
        [fieldName]: exists ? current[fieldName].filter((item) => item !== value) : [...current[fieldName], value],
      };
    });
  };

  const handleSave = async (status) => {
    if (!selectedEvent) {
      return;
    }

    setSaving(true);
    try {
      const updatedEvent = await saveExecutiveEventReport(selectedEvent.id, {
        ...draft,
        status,
        authorUserId: user?.id,
      });

      setEvents((current) => current.map((event) => (event.id === updatedEvent.id ? updatedEvent : event)));
      setDraft(createExecutiveReportDraft(updatedEvent.executiveReport));
      Alert.alert('Éxito', status === 'published' ? 'Informe final publicado.' : 'Borrador guardado.');
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.message || 'No se pudo guardar el informe final.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator color="#FFF" size="large" /></View>;
  }

  if (!selectedEvent) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>INFORME FINAL</Text>
          <Text style={styles.subtitle}>Abrí uno de tus eventos para revisar insumos del coordinador y redactar el cierre ejecutivo.</Text>

          <View style={styles.listGap}>
            {events.length === 0 ? <Text style={styles.emptyText}>No hay eventos creados para informar.</Text> : null}
            {events.map((event) => {
              const report = normalizeExecutiveReport(event.executiveReport);
              return (
                <TouchableOpacity key={event.id} style={styles.eventCard} onPress={() => handleSelectEvent(event)}>
                  <Image source={{ uri: event.image }} style={styles.eventImage} />
                  <View style={styles.eventBody}>
                    <Text style={styles.eventTitle}>{event.name}</Text>
                    <Text style={styles.eventMeta}>{event.client}</Text>
                    <Text style={styles.eventMeta}>{formatDate(event.startDate)} → {formatDate(event.endDate)}</Text>
                    <Text style={styles.eventMeta}>Fotos: {event.photos?.length || 0} · Reportes: {event.reports?.length || 0}</Text>
                    <Text style={styles.statusBadge}>{report?.status === 'published' ? 'Publicado' : report?.status === 'draft' ? 'Draft guardado' : 'Sin informe final'}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={styles.secondaryButton} onPress={onBack}>
            <Text style={styles.secondaryButtonText}>VOLVER AL MENÚ</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{selectedEvent.name}</Text>
        <Text style={styles.subtitle}>{selectedEvent.client} · Informe final del ejecutivo</Text>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Estado actual</Text>
          <Text style={styles.infoText}>Estado: {executiveReport?.status === 'published' ? 'Publicado' : executiveReport?.status === 'draft' ? 'Draft' : 'Sin iniciar'}</Text>
          <Text style={styles.infoText}>Última actualización: {formatDateTime(executiveReport?.updatedAt)}</Text>
          <Text style={styles.infoText}>Autor: {executiveReport?.author?.fullName || user?.fullName || user?.username}</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Insumos del coordinador</Text>
          <Text style={styles.infoText}>Fotos cargadas: {photos.length}</Text>
          <Text style={styles.infoText}>Reportes operativos: {reports.length}</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Fotos relevantes</Text>
          {photos.length === 0 ? <Text style={styles.infoText}>Todavía no hay fotos cargadas.</Text> : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.assetRow}>
            {photos.map((photo) => {
              const selected = draft.selectedPhotoIds.includes(photo.id);
              return (
                <TouchableOpacity key={photo.id} style={[styles.photoCard, selected && styles.selectedCard]} onPress={() => toggleSelection('selectedPhotoIds', photo.id)}>
                  <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
                  <Text style={styles.assetCaption}>{photo.author?.fullName || 'Coordinador'}</Text>
                  <Text style={styles.assetCaption}>{selected ? 'Seleccionada' : 'Tocar para incluir'}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Reportes operativos relevantes</Text>
          {reports.length === 0 ? <Text style={styles.infoText}>Todavía no hay reportes operativos cargados.</Text> : null}
          <View style={styles.listGap}>
            {reports.map((report) => {
              const selected = draft.selectedReportIds.includes(report.id);
              return (
                <TouchableOpacity key={report.id} style={[styles.reportCard, selected && styles.selectedCard]} onPress={() => toggleSelection('selectedReportIds', report.id)}>
                  <Text style={styles.reportTitle}>{report.title}</Text>
                  <Text style={styles.reportMeta}>{report.author?.fullName || 'Coordinador'} · {formatDateTime(report.createdAt)}</Text>
                  <Text style={styles.reportBody}>{report.observations || report.content || 'Sin observaciones'}</Text>
                  <Text style={styles.reportSelection}>{selected ? 'Incluido en el informe final' : 'Tocar para marcar como insumo confirmado'}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Redacción del informe final</Text>
          {FORM_FIELDS.map(([fieldName, label]) => (
            <View key={fieldName} style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>{label}</Text>
              <TextInput
                style={[styles.input, fieldName === 'title' ? styles.inputSingle : styles.inputMulti]}
                value={draft[fieldName]}
                onChangeText={(value) => setDraft((current) => ({ ...current, [fieldName]: value }))}
                placeholder={label}
                placeholderTextColor="#94A3B8"
                multiline={fieldName !== 'title'}
                numberOfLines={fieldName === 'title' ? 1 : 4}
                textAlignVertical="top"
              />
            </View>
          ))}
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.primaryButton, saving && styles.disabledButton]} disabled={saving} onPress={() => handleSave('draft')}>
            <Text style={styles.primaryButtonText}>{saving ? 'GUARDANDO...' : 'GUARDAR DRAFT'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.publishButton, saving && styles.disabledButton]} disabled={saving} onPress={() => handleSave('published')}>
            <Text style={styles.publishButtonText}>{saving ? 'PUBLICANDO...' : 'PUBLICAR'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => setSelectedEventId(null)}>
          <Text style={styles.secondaryButtonText}>VOLVER A EVENTOS</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.green.primary },
  loading: { flex: 1, backgroundColor: COLORS.green.primary, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 20, paddingBottom: 60 },
  title: { fontSize: 28, color: '#FFF', textAlign: 'center', fontWeight: '800' },
  subtitle: { color: '#E8F5E9', textAlign: 'center', marginTop: 8, marginBottom: 20, lineHeight: 20 },
  listGap: { gap: 14 },
  emptyText: { color: '#FFF', textAlign: 'center', marginTop: 20 },
  eventCard: { backgroundColor: '#FFF', borderRadius: 18, overflow: 'hidden' },
  eventImage: { width: '100%', height: 150 },
  eventBody: { padding: 14, gap: 4 },
  eventTitle: { fontSize: 18, fontWeight: '800', color: '#1B5E20' },
  eventMeta: { color: '#4B5563' },
  statusBadge: { marginTop: 8, alignSelf: 'flex-start', backgroundColor: '#E8F5E9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, color: '#1B5E20', fontWeight: '700', overflow: 'hidden' },
  infoCard: { backgroundColor: '#FFF', borderRadius: 18, padding: 16, marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1B5E20', marginBottom: 10 },
  infoText: { color: '#374151', marginBottom: 6 },
  assetRow: { gap: 12 },
  photoCard: { width: 170, backgroundColor: '#F8FAFC', borderRadius: 14, padding: 10 },
  photoPreview: { width: '100%', height: 110, borderRadius: 10, marginBottom: 8 },
  assetCaption: { color: '#475569', fontSize: 12 },
  selectedCard: { borderWidth: 2, borderColor: '#FFB300' },
  reportCard: { backgroundColor: '#F8FAFC', borderRadius: 14, padding: 12 },
  reportTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  reportMeta: { color: '#6B7280', marginTop: 4, marginBottom: 6, fontSize: 12 },
  reportBody: { color: '#374151', lineHeight: 19 },
  reportSelection: { color: '#1B5E20', fontWeight: '700', marginTop: 8, fontSize: 12 },
  fieldBlock: { marginBottom: 12 },
  fieldLabel: { color: '#1B5E20', fontWeight: '700', marginBottom: 6 },
  input: { backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#D1D5DB', paddingHorizontal: 12, color: '#111827' },
  inputSingle: { minHeight: 48, paddingVertical: 12 },
  inputMulti: { minHeight: 110, paddingVertical: 12 },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 6 },
  primaryButton: { flex: 1, backgroundColor: '#D1D5DB', borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
  primaryButtonText: { color: '#1F2937', fontWeight: '800' },
  publishButton: { flex: 1, backgroundColor: '#FFB300', borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
  publishButtonText: { color: '#1F2937', fontWeight: '800' },
  disabledButton: { opacity: 0.65 },
  secondaryButton: { backgroundColor: '#D1D5DB', borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginTop: 14 },
  secondaryButtonText: { color: '#1F2937', fontWeight: '800' },
});

export default ReportsScreen;
