import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image, Alert, TextInput, AppState } from 'react-native';

import { getEvents, saveExecutiveEventReport } from '../api/api';
import { ScreenShell, AppButton, SectionTitle, StatusBadge, SurfaceCard } from '../components/ui';
import { normalizePhotos, normalizeReports } from '../utils/eventAssets';
import { createExecutiveReportDraft, normalizeExecutiveReport } from '../utils/executiveReport';
import { getEventStatus, getEventVisualState } from '../utils/eventLifecycle';
import { getAppPalette, getResponsiveTokens } from '../theme/tokens';
import { useResponsiveMetrics } from '../utils/responsive';

const FORM_FIELDS = [
  ['title', 'Título *'],
  ['executiveSummary', 'Resumen ejecutivo *'],
  ['objectivesCompliance', 'Cumplimiento de objetivos *'],
  ['resultsImpact', 'Resultados / impacto *'],
  ['redemptions', 'Redenciones / aclaración *'],
  ['highlights', 'Hallazgos o highlights *'],
  ['incidents', 'Incidentes *'],
  ['recommendations', 'Recomendaciones *'],
];

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

const getReportStatusMeta = (report) => {
  if (report?.status === 'published') {
    return { key: 'published', label: 'Con informe publicado', tone: 'success' };
  }

  return {
    key: 'unpublished',
    label: report?.status === 'draft' ? 'Sin informe publicado · draft guardado' : 'Sin informe publicado',
    tone: report?.status === 'draft' ? 'warning' : 'muted',
  };
};

const createListSections = (events) => {
  const buckets = {
    active: { key: 'active', title: 'EVENTOS ACTIVOS', items: [] },
    inactive: { key: 'inactive', title: 'EVENTOS INACTIVOS', items: [] },
  };

  (Array.isArray(events) ? events : []).forEach((event) => {
    const bucketKey = getEventStatus(event) === 'active' ? 'active' : 'inactive';
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
  const metrics = useResponsiveMetrics();
  const tokens = getResponsiveTokens(metrics);
  const palette = getAppPalette('green');
  const styles = useMemo(() => createStyles(palette, metrics, tokens), [palette, metrics, tokens]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [draft, setDraft] = useState(createExecutiveReportDraft());
  const [saving, setSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState({ active: true, inactive: false });

  const fetchEvents = async (preserveSelected = true) => {
    try {
      const data = await getEvents(user?.id);
      const normalizedEvents = Array.isArray(data) ? data : [];
      setEvents(normalizedEvents);

      if (preserveSelected && selectedEventId) {
        const nextSelected = normalizedEvents.find((event) => event.id === selectedEventId);
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

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && user?.id) {
        fetchEvents(false);
      }
    });

    return () => subscription.remove();
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
    if (isPublished) return;

    setDraft((current) => {
      const exists = current[fieldName].includes(value);
      return {
        ...current,
        [fieldName]: exists ? current[fieldName].filter((item) => item !== value) : [...current[fieldName], value],
      };
    });
  };

  const handleSelectAllPhotos = () => {
    if (isPublished) return;
    setDraft((current) => ({ ...current, selectedPhotoIds: photos.map((photo) => photo.id) }));
  };

  const handleClearPhotos = () => {
    if (isPublished) return;
    setDraft((current) => ({ ...current, selectedPhotoIds: [] }));
  };

  const handleSave = async (status) => {
    if (!selectedEvent) return;

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
    return (
      <ScreenShell palette={palette} contentContainerStyle={styles.loadingShell}>
        <ActivityIndicator color="#FFFFFF" size="large" />
        <Text style={styles.loadingText}>Cargando eventos para informe final...</Text>
      </ScreenShell>
    );
  }

  if (!selectedEvent) {
    return (
      <ScreenShell palette={palette} contentContainerStyle={styles.screenContent}>
        <SectionTitle title="Informe final" subtitle="Abre uno de tus eventos para revisar insumos del coordinador y redactar el cierre ejecutivo." />

        <SurfaceCard style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <StatusBadge label={`${events.length} eventos`} tone="info" />
            <StatusBadge label={`${events.filter((event) => normalizeExecutiveReport(event.executiveReport)?.status === 'published').length} publicados`} tone="success" />
          </View>
          <Text style={styles.helperText}>Priorizamos visibilidad de estado, activos/inactivos y acceso rápido al flujo de redacción.</Text>
        </SurfaceCard>

        <View style={styles.listGap}>
          {events.length === 0 ? <Text style={styles.emptyText}>No hay eventos creados para informar.</Text> : null}
          {listSections.map((section) => (
            <SurfaceCard key={section.key} style={styles.sectionCard}>
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
                            const visualState = getEventVisualState(event);

                            return (
                              <TouchableOpacity key={event.id} style={styles.eventCard} onPress={() => handleSelectEvent(event)}>
                                <Image source={{ uri: event.image || 'https://cdn-icons-png.flaticon.com/512/1162/1162238.png' }} style={[styles.eventImage, visualState.isInactive && styles.eventImageInactive]} />
                                <View style={[styles.eventBody, visualState.isInactive && styles.eventBodyInactive]}>
                                  <Text style={styles.eventTitle}>{event.name}</Text>
                                  <Text style={styles.eventMeta}>{event.client}</Text>
                                  <Text style={styles.eventMeta}>{formatDate(event.startDate)} → {formatDate(event.endDate)}</Text>
                                  <Text style={styles.eventMeta}>Fotos: {event.photos?.length || 0} · Reportes: {event.reports?.length || 0}</Text>
                                  <StatusBadge label={visualState.label} tone={visualState.tone} />
                                  <StatusBadge label={statusMeta.label} tone={statusMeta.tone} />
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
            </SurfaceCard>
          ))}
        </View>

        <AppButton title="VOLVER AL MENÚ" variant="secondary" onPress={onBack} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell palette={palette} contentContainerStyle={styles.screenContent}>
      <SectionTitle title={selectedEvent.name} subtitle={`${selectedEvent.client} · Informe final del ejecutivo`} />

      <SurfaceCard style={styles.infoCard}>
        <Text style={styles.sectionTitle}>Estado actual</Text>
        <Text style={styles.infoText}>Estado: {executiveReport?.status === 'published' ? 'Publicado' : executiveReport?.status === 'draft' ? 'Draft' : 'Sin iniciar'}</Text>
        <Text style={styles.infoText}>Última actualización: {formatDateTime(executiveReport?.updatedAt)}</Text>
        <Text style={styles.infoText}>Autor: {executiveReport?.author?.fullName || user?.fullName || user?.username}</Text>
        {isPublished ? <Text style={styles.lockedText}>Informe bloqueado: ya fue publicado y no admite nuevas ediciones ni drafts.</Text> : null}
      </SurfaceCard>

      <SurfaceCard style={styles.infoCard}>
        <Text style={styles.sectionTitle}>Insumos del coordinador</Text>
        <Text style={styles.infoText}>Fotos cargadas: {photos.length}</Text>
        <Text style={styles.infoText}>Reportes operativos: {reports.length}</Text>
      </SurfaceCard>

      <SurfaceCard style={styles.infoCard}>
        <Text style={styles.sectionTitle}>Fotos relevantes</Text>
        {photos.length > 0 ? (
          <View style={styles.inlineActions}>
            <AppButton title="SELECCIONAR TODAS" variant="secondary" style={styles.inlineButton} onPress={handleSelectAllPhotos} disabled={isPublished} />
            <AppButton title="LIMPIAR" variant="secondary" style={styles.inlineButton} onPress={handleClearPhotos} disabled={isPublished} />
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
      </SurfaceCard>

      <SurfaceCard style={styles.infoCard}>
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
      </SurfaceCard>

      <SurfaceCard style={styles.infoCard}>
        <Text style={styles.sectionTitle}>Redacción del informe final</Text>
        <Text style={styles.infoText}>Los campos marcados con * son obligatorios para publicar el informe final.</Text>
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
      </SurfaceCard>

      {isPublished ? (
        <SurfaceCard style={styles.lockedBox}>
          <Text style={styles.lockedBoxTitle}>Informe final publicado</Text>
          <Text style={styles.lockedBoxText}>Quedó bloqueado para proteger lo que ya vio el cliente. Si necesitas cambios, hay que definir otro flujo.</Text>
        </SurfaceCard>
      ) : (
        <View style={styles.actionRow}>
          <AppButton title={saving ? 'GUARDANDO...' : 'GUARDAR DRAFT'} variant="secondary" style={styles.actionButton} disabled={saving} onPress={() => handleSave('draft')} />
          <AppButton title={saving ? 'PUBLICANDO...' : 'PUBLICAR'} style={styles.actionButton} disabled={saving} onPress={() => handleSave('published')} />
        </View>
      )}

      <AppButton title="VOLVER A EVENTOS" variant="secondary" onPress={() => setSelectedEventId(null)} />
    </ScreenShell>
  );
};

const createStyles = (palette, metrics, tokens) => StyleSheet.create({
  screenContent: { gap: tokens.spacing.md },
  loadingShell: { justifyContent: 'center', alignItems: 'center', gap: tokens.spacing.sm },
  loadingText: { color: palette.onHero, fontWeight: '700', textAlign: 'center' },
  summaryCard: { backgroundColor: palette.surfaceMuted, gap: tokens.spacing.sm },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm },
  helperText: { color: palette.textMuted, fontSize: tokens.typography.body, lineHeight: metrics.font(20, 0.85) },
  listGap: { gap: tokens.spacing.md },
  sectionCard: { gap: tokens.spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tokens.spacing.sm },
  listSectionTitle: { flex: 1, fontSize: metrics.font(17, 0.9), fontWeight: '800', color: palette.text },
  sectionChevron: { color: palette.text, fontSize: metrics.font(20, 0.9), fontWeight: 'bold' },
  sectionEmpty: { color: palette.textMuted, fontSize: tokens.typography.caption },
  groupGap: { gap: tokens.spacing.md },
  groupBlock: { gap: tokens.spacing.sm },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: tokens.spacing.sm },
  groupTitle: { flex: 1, color: palette.textMuted, fontWeight: '800', fontSize: metrics.font(14, 0.85), textTransform: 'uppercase' },
  groupCount: { color: palette.textMuted, fontWeight: '700' },
  groupEmpty: { color: palette.textMuted, fontSize: tokens.typography.caption },
  emptyText: { color: palette.onHero, textAlign: 'center', opacity: 0.9 },
  eventCard: { backgroundColor: palette.surfaceMuted, borderRadius: tokens.radii.md, overflow: 'hidden' },
  eventImage: { width: '100%', height: tokens.sizes.imageCardHeight },
  eventImageInactive: { opacity: 0.45 },
  eventBody: { padding: tokens.spacing.md, gap: tokens.spacing.xs },
  eventBodyInactive: { backgroundColor: palette.secondaryButton },
  eventTitle: { fontSize: metrics.font(18, 0.9), fontWeight: '800', color: palette.text },
  eventMeta: { color: palette.textMuted, fontSize: tokens.typography.body },
  infoCard: { gap: tokens.spacing.sm },
  sectionTitle: { fontSize: metrics.font(18, 0.9), fontWeight: '800', color: palette.text },
  infoText: { color: '#374151', fontSize: tokens.typography.body, lineHeight: metrics.font(20, 0.85) },
  lockedText: { marginTop: tokens.spacing.xs, color: '#B45309', fontWeight: '700', lineHeight: metrics.font(20, 0.85) },
  assetRow: { gap: tokens.spacing.sm },
  inlineActions: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm },
  inlineButton: { minWidth: metrics.size(148, 0.9) },
  photoCard: { width: Math.min(metrics.size(190, 0.95), tokens.layout.contentMaxWidth * 0.72), backgroundColor: palette.surfaceMuted, borderRadius: tokens.radii.sm, padding: tokens.spacing.sm, gap: tokens.spacing.xs },
  photoPreview: { width: '100%', height: metrics.size(118, 0.95), borderRadius: metrics.radius(10, 0.8) },
  assetCaption: { color: '#475569', fontSize: tokens.typography.caption, lineHeight: metrics.font(16, 0.8) },
  selectedCard: { borderWidth: 2, borderColor: palette.primaryButton },
  lockedAsset: { opacity: 0.8 },
  reportCard: { backgroundColor: palette.surfaceMuted, borderRadius: tokens.radii.sm, padding: tokens.spacing.sm, gap: tokens.spacing.xs },
  reportTitle: { fontSize: metrics.font(16, 0.88), fontWeight: '800', color: '#111827' },
  reportMeta: { color: '#6B7280', fontSize: tokens.typography.caption },
  reportBody: { color: '#374151', lineHeight: metrics.font(19, 0.85), fontSize: tokens.typography.body },
  reportSelection: { color: palette.text, fontWeight: '700', marginTop: tokens.spacing.xs, fontSize: tokens.typography.caption },
  fieldBlock: { gap: tokens.spacing.xs },
  fieldLabel: { color: palette.text, fontWeight: '700', fontSize: metrics.font(13, 0.85) },
  input: { backgroundColor: palette.surfaceMuted, borderRadius: tokens.radii.sm, borderWidth: 1, borderColor: palette.inputBorder, paddingHorizontal: tokens.spacing.sm, color: '#111827', fontSize: tokens.typography.bodyLg },
  inputSingle: { minHeight: metrics.size(48, 0.95), paddingVertical: tokens.spacing.sm },
  inputMulti: { minHeight: metrics.size(110, 0.95), paddingVertical: tokens.spacing.sm },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm },
  actionButton: { flexGrow: 1, flexBasis: metrics.compactWidth ? '100%' : 0 },
  lockedBox: { backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FDBA74' },
  lockedBoxTitle: { color: '#9A3412', fontWeight: '800', fontSize: metrics.font(16, 0.88) },
  lockedBoxText: { color: '#7C2D12', lineHeight: metrics.font(20, 0.85), fontSize: tokens.typography.body },
});

export default ReportsScreen;
