import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView, ActivityIndicator, Image, Alert, TextInput } from 'react-native';
import { getEvents, saveExecutiveEventReport } from '../api/api';
import { normalizePhotos, normalizeReports } from '../utils/eventAssets';
import { createExecutiveReportDraft, normalizeExecutiveReport } from '../utils/executiveReport';
import { getInactiveBadgeLabel } from '../utils/eventLifecycle';
import { getAppPalette, RADII, SPACING } from '../theme/tokens';

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

const getReportStatusMeta = (report) => {
  if (report?.status === 'published') {
    return { key: 'published', label: 'Con informe publicado' };
  }

  return { key: 'unpublished', label: report?.status === 'draft' ? 'Sin informe publicado · draft guardado' : 'Sin informe publicado' };
};

const createListSections = (events) => {
  const buckets = {
    active: { key: 'active', title: 'EVENTOS ACTIVOS', items: [] },
    inactive: { key: 'inactive', title: 'EVENTOS INACTIVOS', items: [] },
  };

  (Array.isArray(events) ? events : []).forEach((event) => {
    const bucketKey = event?.isInactive ? 'inactive' : 'active';
    buckets[bucketKey].items.push(event);
  });

  return Object.values(buckets).map((section) => {
    const published = [];
    const unpublished = [];

    section.items.forEach((event) => {
      const report = normalizeExecutiveReport(event.executiveReport);
      if (report?.status === 'published') {
        published.push(event);
        return;
      }

      unpublished.push(event);
    });

    return {
      ...section,
      groups: [
        { key: 'published', title: 'Con informe publicado', items: published },
        { key: 'unpublished', title: 'Sin informe publicado', items: unpublished },
      ],
    };
  });
};

const ReportsScreen = ({ onBack, user }) => {
  const palette = getAppPalette('green');
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [draft, setDraft] = useState(createExecutiveReportDraft());
  const [saving, setSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState({ active: true, inactive: false });

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
  const listSections = useMemo(() => createListSections(events), [events]);
  const isPublished = executiveReport?.status === 'published';

  const handleSelectEvent = (event) => {
    setSelectedEventId(event.id);
    setDraft(createExecutiveReportDraft(event.executiveReport));
  };

  const toggleSection = (section) => {
    setExpandedSections((current) => ({
      active: false,
      inactive: false,
      [section]: !current[section],
    }));
  };

  const toggleSelection = (fieldName, value) => {
    if (isPublished) {
      return;
    }

    setDraft((current) => {
      const exists = current[fieldName].includes(value);
      return {
        ...current,
        [fieldName]: exists ? current[fieldName].filter((item) => item !== value) : [...current[fieldName], value],
      };
    });
  };

  const handleSelectAllPhotos = () => {
    if (isPublished) {
      return;
    }

    setDraft((current) => ({
      ...current,
      selectedPhotoIds: photos.map((photo) => photo.id),
    }));
  };

  const handleClearPhotos = () => {
    if (isPublished) {
      return;
    }

    setDraft((current) => ({
      ...current,
      selectedPhotoIds: [],
    }));
  };

  const handleSave = async (status) => {
    if (!selectedEvent) {
      return;
    }

    if (isPublished) {
      Alert.alert('Informe bloqueado', 'El informe final ya fue publicado y no admite cambios.');
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
            {listSections.map((section) => (
              <View key={section.key} style={styles.sectionBlock}>
                <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection(section.key)}>
                  <Text style={styles.listSectionTitle}>{section.title} ({section.items.length})</Text>
                  <Text style={styles.sectionChevron}>{expandedSections[section.key] ? '▾' : '▸'}</Text>
                </TouchableOpacity>

                {expandedSections[section.key] && (
                  section.items.length === 0 ? (
                    <Text style={styles.sectionEmpty}>No hay eventos en esta categoría.</Text>
                  ) : (
                    <View style={styles.groupGap}>
                      {section.groups.map((group) => (
                        <View key={group.key} style={styles.groupBlock}>
                          <View style={styles.groupHeader}>
                            <Text style={styles.groupTitle}>{group.title}</Text>
                            <Text style={styles.groupCount}>{group.items.length}</Text>
                          </View>

                          {group.items.length === 0 ? (
                            <Text style={styles.groupEmpty}>Sin eventos.</Text>
                          ) : (
                            group.items.map((event) => {
                              const report = normalizeExecutiveReport(event.executiveReport);
                              const statusMeta = getReportStatusMeta(report);

                              return (
                                <TouchableOpacity key={event.id} style={styles.eventCard} onPress={() => handleSelectEvent(event)}>
                                  <Image source={{ uri: event.image || 'https://cdn-icons-png.flaticon.com/512/1162/1162238.png' }} style={[styles.eventImage, event.isInactive && styles.eventImageInactive]} />
                                  <View style={[styles.eventBody, event.isInactive && styles.eventBodyInactive]}>
                                    <Text style={styles.eventTitle}>{event.name}</Text>
                                    <Text style={styles.eventMeta}>{event.client}</Text>
                                    <Text style={styles.eventMeta}>{formatDate(event.startDate)} → {formatDate(event.endDate)}</Text>
                                    <Text style={styles.eventMeta}>Fotos: {event.photos?.length || 0} · Reportes: {event.reports?.length || 0}</Text>
                                    {event.isInactive ? <Text style={styles.inactiveBadge}>{getInactiveBadgeLabel(event)}</Text> : null}
                                    <Text style={[styles.statusBadge, report?.status === 'published' ? styles.statusBadgePublished : styles.statusBadgeDraft]}>{statusMeta.label}</Text>
                                  </View>
                                </TouchableOpacity>
                              );
                            })
                          )}
                        </View>
                      ))}
                    </View>
                  )
                )}
              </View>
            ))}
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
          {isPublished ? <Text style={styles.lockedText}>Informe bloqueado: ya fue publicado y no admite nuevas ediciones ni drafts.</Text> : null}
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Insumos del coordinador</Text>
          <Text style={styles.infoText}>Fotos cargadas: {photos.length}</Text>
          <Text style={styles.infoText}>Reportes operativos: {reports.length}</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Fotos relevantes</Text>
          {photos.length > 0 ? (
            <View style={styles.inlineActions}>
              <TouchableOpacity style={[styles.inlineButton, isPublished && styles.disabledInlineButton]} onPress={handleSelectAllPhotos} disabled={isPublished}>
                <Text style={styles.inlineButtonText}>SELECCIONAR TODAS</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.inlineButton, isPublished && styles.disabledInlineButton]} onPress={handleClearPhotos} disabled={isPublished}>
                <Text style={styles.inlineButtonText}>LIMPIAR</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {photos.length === 0 ? <Text style={styles.infoText}>Todavía no hay fotos cargadas.</Text> : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.assetRow}>
            {photos.map((photo) => {
              const selected = draft.selectedPhotoIds.includes(photo.id);
              return (
                <TouchableOpacity key={photo.id} style={[styles.photoCard, selected && styles.selectedCard, isPublished && styles.lockedAsset]} onPress={() => toggleSelection('selectedPhotoIds', photo.id)} disabled={isPublished}>
                  <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
                  <Text style={styles.assetCaption}>{photo.author?.fullName || 'Coordinador'}</Text>
                  <Text style={styles.assetCaption}>{selected ? 'Incluida en el informe final' : isPublished ? 'No incluida' : 'Tocar para incluir'}</Text>
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
                <TouchableOpacity key={report.id} style={[styles.reportCard, selected && styles.selectedCard, isPublished && styles.lockedAsset]} onPress={() => toggleSelection('selectedReportIds', report.id)} disabled={isPublished}>
                  <Text style={styles.reportTitle}>{report.title}</Text>
                  <Text style={styles.reportMeta}>{report.author?.fullName || 'Coordinador'} · {formatDateTime(report.createdAt)}</Text>
                  <Text style={styles.reportBody}>{report.observations || report.content || 'Sin observaciones'}</Text>
                  <Text style={styles.reportSelection}>{selected ? 'Incluido en el informe final' : isPublished ? 'No incluido' : 'Tocar para marcar como insumo confirmado'}</Text>
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
                editable={!isPublished}
              />
            </View>
          ))}
        </View>

        {isPublished ? (
          <View style={styles.lockedBox}>
            <Text style={styles.lockedBoxTitle}>Informe final publicado</Text>
            <Text style={styles.lockedBoxText}>Quedó bloqueado para proteger lo que ya vio el cliente. Si necesitás cambios, hay que definir otro flujo.</Text>
          </View>
        ) : (
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.primaryButton, saving && styles.disabledButton]} disabled={saving} onPress={() => handleSave('draft')}>
              <Text style={styles.primaryButtonText}>{saving ? 'GUARDANDO...' : 'GUARDAR DRAFT'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.publishButton, saving && styles.disabledButton]} disabled={saving} onPress={() => handleSave('published')}>
              <Text style={styles.publishButtonText}>{saving ? 'PUBLICANDO...' : 'PUBLICAR'}</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.secondaryButton} onPress={() => setSelectedEventId(null)}>
          <Text style={styles.secondaryButtonText}>VOLVER A EVENTOS</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.pageBg },
  loading: { flex: 1, backgroundColor: palette.pageBg, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: SPACING.xl, paddingBottom: 60 },
  title: { fontSize: 28, color: palette.onHero, textAlign: 'center', fontWeight: '800' },
  subtitle: { color: palette.onHeroMuted, textAlign: 'center', marginTop: 8, marginBottom: 20, lineHeight: 20 },
  listGap: { gap: 14 },
  sectionBlock: { gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: palette.panel, paddingVertical: 12, paddingHorizontal: 14, borderRadius: RADII.sm },
  listSectionTitle: { fontSize: 17, fontWeight: 'bold', color: palette.onHero },
  sectionChevron: { color: palette.onHero, fontSize: 20, fontWeight: 'bold' },
  sectionEmpty: { color: '#D1D5DB', fontSize: 13 },
  groupGap: { gap: 14 },
  groupBlock: { gap: 10 },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  groupTitle: { color: palette.onHeroMuted, fontWeight: '800', fontSize: 14, textTransform: 'uppercase' },
  groupCount: { color: palette.onHeroMuted, fontWeight: '700' },
  groupEmpty: { color: '#D1D5DB', fontSize: 13 },
  emptyText: { color: palette.onHero, textAlign: 'center', marginTop: 20 },
  eventCard: { backgroundColor: palette.surface, borderRadius: 18, overflow: 'hidden' },
  eventImage: { width: '100%', height: 150 },
  eventImageInactive: { opacity: 0.45 },
  eventBody: { padding: 14, gap: 4 },
  eventBodyInactive: { backgroundColor: palette.secondaryButton },
  eventTitle: { fontSize: 18, fontWeight: '800', color: palette.text },
  eventMeta: { color: '#4B5563' },
  statusBadge: { marginTop: 8, alignSelf: 'flex-start', backgroundColor: palette.pageBgSoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, color: palette.text, fontWeight: '700', overflow: 'hidden' },
  statusBadgePublished: { backgroundColor: '#DCfCE7', color: '#166534' },
  statusBadgeDraft: { backgroundColor: '#FEF3C7', color: '#92400E' },
  inactiveBadge: { marginTop: 4, fontSize: 11, fontWeight: 'bold', color: '#555' },
  infoCard: { backgroundColor: palette.surface, borderRadius: 18, padding: 16, marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: palette.text, marginBottom: 10 },
  infoText: { color: '#374151', marginBottom: 6 },
  lockedText: { marginTop: 8, color: '#B45309', fontWeight: '700', lineHeight: 20 },
  assetRow: { gap: 12 },
  inlineActions: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  inlineButton: { backgroundColor: palette.secondaryButton, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  inlineButtonText: { color: '#1F2937', fontWeight: '800', fontSize: 12 },
  disabledInlineButton: { opacity: 0.55 },
  photoCard: { width: 170, backgroundColor: palette.surfaceMuted, borderRadius: 14, padding: 10 },
  photoPreview: { width: '100%', height: 110, borderRadius: 10, marginBottom: 8 },
  assetCaption: { color: '#475569', fontSize: 12 },
  selectedCard: { borderWidth: 2, borderColor: palette.primaryButton },
  lockedAsset: { opacity: 0.8 },
  reportCard: { backgroundColor: palette.surfaceMuted, borderRadius: 14, padding: 12 },
  reportTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  reportMeta: { color: '#6B7280', marginTop: 4, marginBottom: 6, fontSize: 12 },
  reportBody: { color: '#374151', lineHeight: 19 },
  reportSelection: { color: palette.text, fontWeight: '700', marginTop: 8, fontSize: 12 },
  fieldBlock: { marginBottom: 12 },
  fieldLabel: { color: palette.text, fontWeight: '700', marginBottom: 6 },
  input: { backgroundColor: palette.surfaceMuted, borderRadius: 12, borderWidth: 1, borderColor: palette.inputBorder, paddingHorizontal: 12, color: '#111827' },
  inputSingle: { minHeight: 48, paddingVertical: 12 },
  inputMulti: { minHeight: 110, paddingVertical: 12 },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 6 },
  primaryButton: { flex: 1, backgroundColor: palette.secondaryButton, borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
  primaryButtonText: { color: '#1F2937', fontWeight: '800' },
  publishButton: { flex: 1, backgroundColor: palette.primaryButton, borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
  publishButtonText: { color: '#1F2937', fontWeight: '800' },
  disabledButton: { opacity: 0.65 },
  lockedBox: { backgroundColor: '#FFF7ED', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#FDBA74' },
  lockedBoxTitle: { color: '#9A3412', fontWeight: '800', marginBottom: 6, fontSize: 16 },
  lockedBoxText: { color: '#7C2D12', lineHeight: 20 },
  secondaryButton: { backgroundColor: palette.secondaryButton, borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginTop: 14 },
  secondaryButtonText: { color: '#1F2937', fontWeight: '800' },
});

export default ReportsScreen;
