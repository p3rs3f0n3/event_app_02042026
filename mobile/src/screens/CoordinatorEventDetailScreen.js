import React, { useMemo, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { addCoordinatorEventPhoto, addCoordinatorEventReport } from '../api/api';
import { normalizePhotos, normalizeReports } from '../utils/eventAssets';
import { contactByPhoneCall, contactByWhatsApp, hasDirectContactPhone } from '../utils/contact';
import { useResponsiveMetrics } from '../utils/responsive';
import { getAppPalette, RADII, SPACING } from '../theme/tokens';

const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_PHOTO_SIZE_MB = 10;
const VALID_PHOTO_FORMATS_LABEL = 'JPG, PNG, WEBP y HEIC';

const formatDate = (date) => {
  if (!date) return 'Sin fecha';
  return new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
};

const formatTimeLabel = (date) => {
  if (!date) return 'Sin hora';
  return new Date(date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const formatDateTime = (date) => {
  if (!date) return 'Fecha no disponible';
  return new Date(date).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const createEmptyReportForm = () => ({
  title: '',
  startTime: '',
  endTime: '',
  initialInventory: '',
  finalInventory: '',
  observations: '',
  hasRedemptions: false,
  redemptionsCount: '0',
  relevantAspects: '',
});

const Field = ({ styles, label, value, onChangeText, multiline = false, placeholder = '' }) => (
  <View style={styles.fieldGroup}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#9CA3AF"
      multiline={multiline}
      numberOfLines={multiline ? 4 : 1}
      style={[styles.fieldInput, multiline && styles.fieldInputMultiline]}
      textAlignVertical={multiline ? 'top' : 'center'}
    />
  </View>
);

const CoordinatorEventDetailScreen = ({ event, user, onBack, onEventUpdated, roleConfig }) => {
  const metrics = useResponsiveMetrics();
  const palette = getAppPalette(roleConfig?.theme || 'brown');
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [currentEvent, setCurrentEvent] = useState(event);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [savingReport, setSavingReport] = useState(false);
  const [reportForm, setReportForm] = useState(createEmptyReportForm());

  const photos = useMemo(() => normalizePhotos(currentEvent?.photos), [currentEvent?.photos]);
  const reports = useMemo(() => normalizeReports(currentEvent?.reports), [currentEvent?.reports]);

  const updateEventState = (updatedEvent) => {
    setCurrentEvent(updatedEvent);
    onEventUpdated?.(updatedEvent);
  };

  const handleContactExecutive = async (channel) => {
    try {
      if (channel === 'whatsapp') {
        await contactByWhatsApp(currentEvent?.executiveContact);
        return;
      }

      await contactByPhoneCall(currentEvent?.executiveContact);
    } catch (error) {
      Alert.alert('Error', 'No se pudo abrir la acción de contacto.');
    }
  };

  const handleContactPoint = async (point, channel) => {
    try {
      const pointContact = {
        name: point?.contact || point?.establishment || 'Punto operativo',
        phone: point?.phone,
      };

      if (channel === 'whatsapp') {
        await contactByWhatsApp(pointContact);
        return;
      }

      await contactByPhoneCall(pointContact);
    } catch (error) {
      Alert.alert('Error', 'No se pudo abrir la acción de contacto del punto.');
    }
  };

  const handlePickPhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permiso requerido', 'Necesitas habilitar la galería para cargar fotos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.6,
        base64: true,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];
      const mimeType = asset.mimeType || 'image/jpeg';
      const fileSize = Number(asset.fileSize || 0) || null;
      const fileName = asset.fileName || null;

      if (fileSize && fileSize > MAX_PHOTO_SIZE_BYTES) {
        Alert.alert('Archivo demasiado grande', `La foto supera el límite de ${MAX_PHOTO_SIZE_MB} MB.`);
        return;
      }

      const uri = asset.base64 ? `data:${mimeType};base64,${asset.base64}` : asset.uri;

      setUploadingPhoto(true);
      const updatedEvent = await addCoordinatorEventPhoto(currentEvent.id, {
        authorUserId: user?.id,
        uri,
        mimeType,
        fileSize,
        fileName,
      });
      updateEventState(updatedEvent);
      Alert.alert('Éxito', 'La foto quedó guardada en el evento.');
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.message || 'No se pudo cargar la foto.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveReport = async () => {
    if (!reportForm.startTime.trim() || !reportForm.endTime.trim()) {
        Alert.alert('Datos incompletos', 'Completa la hora de inicio y finalización.');
      return;
    }

    if (!reportForm.initialInventory.trim() || !reportForm.finalInventory.trim()) {
        Alert.alert('Datos incompletos', 'Completa el inventario inicial y final.');
      return;
    }

    if (!reportForm.observations.trim()) {
        Alert.alert('Datos incompletos', 'Describe el impacto o las observaciones del evento.');
      return;
    }

    if (reportForm.hasRedemptions && reportForm.redemptionsCount.trim() === '') {
        Alert.alert('Datos incompletos', 'Indica la cantidad de redenciones.');
      return;
    }

    try {
      setSavingReport(true);
      const updatedEvent = await addCoordinatorEventReport(currentEvent.id, {
        authorUserId: user?.id,
        title: reportForm.title,
        startTime: reportForm.startTime,
        endTime: reportForm.endTime,
        initialInventory: reportForm.initialInventory,
        finalInventory: reportForm.finalInventory,
        observations: reportForm.observations,
        hasRedemptions: reportForm.hasRedemptions,
        redemptionsCount: reportForm.hasRedemptions ? Number(reportForm.redemptionsCount || 0) : 0,
        relevantAspects: reportForm.relevantAspects,
      });
      updateEventState(updatedEvent);
      setReportForm(createEmptyReportForm());
      Alert.alert('Éxito', 'El informe quedó guardado y visible para el ejecutivo.');
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.message || 'No se pudo guardar el informe.');
    } finally {
      setSavingReport(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}> 
      <ScrollView contentContainerStyle={[styles.scrollContent, { padding: metrics.screenPadding }]}> 
        <Text style={[styles.title, { fontSize: metrics.heroTitleSize }]}>DETALLE DEL EVENTO</Text>

        {!!currentEvent?.image && <Image source={{ uri: currentEvent.image }} style={styles.heroImage} />}

        <View style={styles.panel}>
          <Text style={styles.eventName}>{currentEvent?.name}</Text>
          <Text style={styles.metaText}>Cliente: {currentEvent?.client}</Text>
          <Text style={styles.metaText}>Desde: {formatDate(currentEvent?.startDate)}</Text>
          <Text style={styles.metaText}>Hasta: {formatDate(currentEvent?.endDate)}</Text>
          <Text style={styles.metaText}>Puntos asignados: {currentEvent?.assignmentSummary?.pointsCount || 0}</Text>
          <Text style={styles.metaText}>Ejecutivo: {currentEvent?.executiveContact?.fullName || currentEvent?.executiveContact?.username || 'No disponible'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mis puntos asignados</Text>
          {(currentEvent?.cities || []).map((city, cityIndex) => (
            <View key={`${city?.name || 'city'}-${cityIndex}`} style={styles.cityCard}>
              <Text style={styles.cityName}>{city?.name}</Text>
              <Text style={styles.cityMeta}>{(city?.points || []).length} punto(s) asignado(s)</Text>
              {(city?.points || []).map((point, pointIndex) => (
                <View key={`${point?.establishment || 'point'}-${pointIndex}`} style={styles.pointCard}>
                  <Text style={styles.pointTitle}>{point?.establishment || 'Punto sin nombre'}</Text>
                  <Text style={styles.pointText}>Dirección: {point?.address || 'Sin dato'}</Text>
                  <Text style={styles.pointText}>Horario: {formatTimeLabel(point?.startTime)} - {formatTimeLabel(point?.endTime)}</Text>
                  <Text style={styles.pointText}>Equipo asignado: {point?.assignedStaff?.length || 0}</Text>
                  <TouchableOpacity style={styles.pointDetailButton} onPress={() => setSelectedPoint({ ...point, cityName: city?.name })}>
                    <Text style={styles.pointDetailButtonText}>VER DETALLE DEL PUNTO</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ))}
        </View>

        <View style={styles.sectionRow}>
          <View style={styles.assetBox}>
            <Text style={styles.reportTitle}>Fotos del evento ({photos.length})</Text>
            <Text style={styles.helperText}>Carga evidencia visual. Quedará guardada para que el ejecutivo pueda consultarla después.</Text>
            <Text style={styles.helperHint}>Formatos válidos: {VALID_PHOTO_FORMATS_LABEL}.</Text>
            <Text style={styles.helperHint}>Tamaño máximo por foto: {MAX_PHOTO_SIZE_MB} MB.</Text>
            {photos.length > 0 ? (
              <Image source={{ uri: photos[photos.length - 1].uri }} style={styles.latestPhoto} />
            ) : (
              <Text style={styles.emptyText}>Todavía no hay fotos cargadas.</Text>
            )}
            <View style={styles.rowButtons}>
              <TouchableOpacity style={styles.secondaryButton} onPress={handlePickPhoto} disabled={uploadingPhoto}>
                <Text style={styles.secondaryButtonText}>{uploadingPhoto ? 'GUARDANDO...' : 'CARGAR FOTO'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setGalleryVisible(true)}>
                <Text style={styles.secondaryButtonText}>VER GALERÍA</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.reportBox}>
            <Text style={styles.reportTitle}>Informes del coordinador ({reports.length})</Text>
            <Text style={styles.helperText}>Registra el cierre operativo del evento. Puedes cargar más de un informe y quedará guardado para consulta del ejecutivo.</Text>

            <Field styles={styles} label="Título opcional" value={reportForm.title} onChangeText={(value) => setReportForm((current) => ({ ...current, title: value }))} placeholder="Ej: Cierre día 1" />
            <View style={styles.doubleColumn}>
              <View style={styles.columnItem}>
                <Field styles={styles} label="Hora inicio *" value={reportForm.startTime} onChangeText={(value) => setReportForm((current) => ({ ...current, startTime: value }))} placeholder="08:00 AM" />
              </View>
              <View style={styles.columnItem}>
                <Field styles={styles} label="Hora finalización *" value={reportForm.endTime} onChangeText={(value) => setReportForm((current) => ({ ...current, endTime: value }))} placeholder="06:00 PM" />
              </View>
            </View>
            <Field styles={styles} label="Inventario inicial *" value={reportForm.initialInventory} onChangeText={(value) => setReportForm((current) => ({ ...current, initialInventory: value }))} multiline placeholder="Detalle del inventario al inicio" />
            <Field styles={styles} label="Inventario final *" value={reportForm.finalInventory} onChangeText={(value) => setReportForm((current) => ({ ...current, finalInventory: value }))} multiline placeholder="Detalle del inventario al cierre" />
            <Field styles={styles} label="Impacto / observaciones *" value={reportForm.observations} onChangeText={(value) => setReportForm((current) => ({ ...current, observations: value }))} multiline placeholder="Qué pasó durante el evento" />

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>¿Hubo redención?</Text>
              <Switch
                value={reportForm.hasRedemptions}
                onValueChange={(value) => setReportForm((current) => ({ ...current, hasRedemptions: value, redemptionsCount: value ? current.redemptionsCount : '0' }))}
                trackColor={{ false: '#BCAAA4', true: '#FFCC80' }}
                thumbColor={reportForm.hasRedemptions ? '#6D4C41' : '#F5F5F5'}
              />
            </View>

            {reportForm.hasRedemptions && (
              <Field styles={styles} label="Cantidad de redenciones *" value={reportForm.redemptionsCount} onChangeText={(value) => setReportForm((current) => ({ ...current, redemptionsCount: value.replace(/[^0-9]/g, '') }))} placeholder="0" />
            )}

            <Field styles={styles} label="Otros aspectos relevantes" value={reportForm.relevantAspects} onChangeText={(value) => setReportForm((current) => ({ ...current, relevantAspects: value }))} multiline placeholder="Novedades logísticas, incidentes, aprendizajes, etc." />

            <TouchableOpacity style={styles.primaryButton} onPress={handleSaveReport} disabled={savingReport}>
              {savingReport ? <ActivityIndicator color="#4E342E" /> : <Text style={styles.primaryButtonText}>GUARDAR INFORME</Text>}
            </TouchableOpacity>

            {reports.length === 0 ? (
              <Text style={styles.emptyText}>Todavía no hay informes cargados para este evento.</Text>
            ) : (
              reports.map((report, index) => (
                <View key={report.id || `${report.title}-${index}`} style={styles.reportCard}>
                  <Text style={styles.reportCardTitle}>{report.title || `Informe ${index + 1}`}</Text>
                  <Text style={styles.reportCardDate}>{formatDateTime(report.createdAt || report.date)}</Text>
                  {!!report?.author?.fullName && <Text style={styles.reportCardMeta}>Autor: {report.author.fullName}</Text>}
                  <Text style={styles.reportCardContent}>Inicio: {report.startTime || 'Sin dato'}</Text>
                  <Text style={styles.reportCardContent}>Finalización: {report.endTime || 'Sin dato'}</Text>
                  <Text style={styles.reportCardContent}>Inventario inicial: {report.initialInventory || 'Sin dato'}</Text>
                  <Text style={styles.reportCardContent}>Inventario final: {report.finalInventory || 'Sin dato'}</Text>
                  <Text style={styles.reportCardContent}>Observaciones: {report.observations || report.content || 'Sin contenido adicional.'}</Text>
                  <Text style={styles.reportCardContent}>Redenciones: {report.hasRedemptions === false ? 'No aplica' : (report.redemptionsCount ?? 'Sin dato')}</Text>
                  {!!report.relevantAspects && <Text style={styles.reportCardContent}>Otros aspectos: {report.relevantAspects}</Text>}
                </View>
              ))
            )}
          </View>
        </View>

        <View style={styles.contactSection}>
          <Text style={styles.sectionTitle}>Contactar al ejecutivo</Text>
          <Text style={styles.helperText}>Evento creado por: {currentEvent?.executiveContact?.fullName || currentEvent?.executiveContact?.username || 'No disponible'}</Text>
          <View style={styles.rowButtons}>
            <TouchableOpacity
              style={[styles.secondaryButton, !hasDirectContactPhone(currentEvent?.executiveContact) && styles.disabledButton]}
              onPress={() => handleContactExecutive('call')}
              disabled={!hasDirectContactPhone(currentEvent?.executiveContact)}
            >
              <Text style={styles.secondaryButtonText}>LLAMAR</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, !hasDirectContactPhone(currentEvent?.executiveContact) && styles.disabledButton]}
              onPress={() => handleContactExecutive('whatsapp')}
              disabled={!hasDirectContactPhone(currentEvent?.executiveContact)}
            >
              <Text style={styles.secondaryButtonText}>WHATSAPP</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>REGRESAR A EVENTOS</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={galleryVisible} transparent animationType="fade" onRequestClose={() => setGalleryVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Fotos del evento</Text>
            <ScrollView contentContainerStyle={styles.galleryContent}>
              {photos.length === 0 ? (
                <Text style={styles.modalEmptyText}>Todavía no hay fotos disponibles para consulta.</Text>
              ) : (
                photos.map((photo, index) => (
                  <View key={photo.id || `${photo.uri}-${index}`} style={styles.galleryCard}>
                    <Image source={{ uri: photo.uri }} style={styles.galleryPhoto} />
                    <Text style={styles.galleryMeta}>{formatDateTime(photo.createdAt)}</Text>
                    {!!photo?.author?.fullName && <Text style={styles.galleryMeta}>Cargó: {photo.author.fullName}</Text>}
                  </View>
                ))
              )}
            </ScrollView>
            <TouchableOpacity style={styles.primaryButton} onPress={() => setGalleryVisible(false)}>
              <Text style={styles.primaryButtonText}>CERRAR</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(selectedPoint)} transparent animationType="fade" onRequestClose={() => setSelectedPoint(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{selectedPoint?.establishment || 'Detalle del punto'}</Text>
            <View style={styles.pointDetailContent}>
              <Text style={styles.modalInfoText}>Ciudad: {selectedPoint?.cityName || 'Sin dato'}</Text>
              <Text style={styles.modalInfoText}>Dirección: {selectedPoint?.address || 'Sin dato'}</Text>
              <Text style={styles.modalInfoText}>Contacto local: {selectedPoint?.contact || 'Sin dato'}</Text>
              <Text style={styles.modalInfoText}>Teléfono local: {selectedPoint?.phone || 'Sin dato'}</Text>
              <Text style={styles.modalInfoText}>Horario: {formatTimeLabel(selectedPoint?.startTime)} - {formatTimeLabel(selectedPoint?.endTime)}</Text>
              <Text style={styles.modalInfoText}>Equipo asignado: {selectedPoint?.assignedStaff?.length || 0}</Text>
              {(selectedPoint?.assignedStaff || []).map((staffMember) => (
                <Text key={staffMember.id} style={styles.staffItemDark}>• {staffMember.name} · {staffMember.category}</Text>
              ))}
            </View>

            <View style={styles.rowButtons}>
              <TouchableOpacity
                style={[styles.secondaryButton, !hasDirectContactPhone(selectedPoint) && styles.disabledButton]}
                onPress={() => handleContactPoint(selectedPoint, 'call')}
                disabled={!hasDirectContactPhone(selectedPoint)}
              >
                <Text style={styles.secondaryButtonText}>LLAMAR</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryButton, !hasDirectContactPhone(selectedPoint) && styles.disabledButton]}
                onPress={() => handleContactPoint(selectedPoint, 'whatsapp')}
                disabled={!hasDirectContactPhone(selectedPoint)}
              >
                <Text style={styles.secondaryButtonText}>WHATSAPP</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={() => setSelectedPoint(null)}>
              <Text style={styles.primaryButtonText}>CERRAR</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.pageBg },
  scrollContent: { paddingBottom: 42, gap: 16 },
  title: { color: palette.onHero, fontWeight: 'bold', textAlign: 'center' },
  heroImage: { width: '100%', height: 190, borderRadius: 18, resizeMode: 'cover' },
  panel: { backgroundColor: palette.panel, borderRadius: 18, padding: 18, gap: 8 },
  eventName: { color: palette.primaryButton, fontSize: 24, fontWeight: 'bold' },
  metaText: { color: palette.onHero, fontSize: 14 },
  section: { gap: 12 },
  sectionTitle: { color: palette.onHero, fontWeight: 'bold', fontSize: 18 },
  cityCard: { backgroundColor: palette.panelStrong, borderRadius: 16, padding: 14, gap: 10 },
  cityName: { color: palette.primaryButton, fontSize: 18, fontWeight: 'bold' },
  cityMeta: { color: palette.onHeroMuted, fontSize: 12 },
  pointCard: { backgroundColor: 'rgba(0,0,0,0.14)', borderRadius: 14, padding: 12, gap: 5 },
  pointTitle: { color: palette.onHero, fontSize: 16, fontWeight: 'bold' },
  pointText: { color: '#F3F4F6', fontSize: 13 },
  staffItem: { color: '#FDE68A', fontSize: 12, marginLeft: 6 },
  staffItemDark: { color: palette.text, fontSize: 12, marginLeft: 6 },
  pointDetailButton: { marginTop: 8, alignSelf: 'flex-start', backgroundColor: palette.primaryButton, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  pointDetailButtonText: { color: palette.primaryButtonText, fontSize: 12, fontWeight: 'bold' },
  sectionRow: { gap: 14 },
  assetBox: { backgroundColor: palette.panel, borderRadius: 16, padding: 14, gap: 10 },
  latestPhoto: { width: '100%', height: 180, borderRadius: 14, resizeMode: 'cover' },
  helperText: { color: palette.onHeroMuted, fontSize: 13, lineHeight: 18 },
  helperHint: { color: '#FDE68A', fontSize: 12, lineHeight: 16 },
  rowButtons: { flexDirection: 'row', gap: 10 },
  secondaryButton: { flex: 1, backgroundColor: palette.secondaryButton, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  disabledButton: { opacity: 0.55 },
  secondaryButtonText: { color: palette.secondaryButtonText, fontWeight: 'bold' },
  reportBox: { backgroundColor: palette.panel, borderRadius: 16, padding: 14, gap: 10 },
  reportTitle: { color: palette.onHero, fontSize: 17, fontWeight: 'bold' },
  emptyText: { color: '#E5E7EB', fontSize: 13 },
  fieldGroup: { gap: 6 },
  fieldLabel: { color: palette.onHero, fontSize: 13, fontWeight: 'bold' },
  fieldInput: { backgroundColor: palette.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, color: '#222' },
  fieldInputMultiline: { minHeight: 92 },
  doubleColumn: { flexDirection: 'row', gap: 10 },
  columnItem: { flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  switchLabel: { color: palette.onHero, fontWeight: 'bold' },
  reportCard: { backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 12, padding: 10, gap: 4 },
  reportCardTitle: { color: palette.onHero, fontWeight: 'bold' },
  reportCardDate: { color: '#D7CCC8', fontSize: 12 },
  reportCardMeta: { color: '#FDE68A', fontSize: 12 },
  reportCardContent: { color: '#F3F4F6', fontSize: 13 },
  primaryButton: { backgroundColor: palette.primaryButton, borderRadius: 28, paddingVertical: 15, alignItems: 'center' },
  primaryButtonText: { color: palette.primaryButtonText, fontWeight: 'bold' },
  contactSection: { backgroundColor: palette.panel, borderRadius: 16, padding: 14, gap: 10 },
  backButton: { backgroundColor: palette.secondaryButton, borderRadius: 28, paddingVertical: 14, alignItems: 'center' },
  backButtonText: { color: palette.secondaryButtonText, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: palette.surface, borderRadius: 20, padding: 20, maxHeight: '80%' },
  modalTitle: { color: palette.text, fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 },
  modalInfoText: { color: '#4B5563', fontSize: 14 },
  pointDetailContent: { gap: 8, marginBottom: 18 },
  galleryContent: { gap: 12 },
  modalEmptyText: { color: '#6B7280', textAlign: 'center' },
  galleryCard: { gap: 6 },
  galleryMeta: { color: '#6B7280', fontSize: 12 },
  galleryPhoto: { width: '100%', height: 180, borderRadius: 14, resizeMode: 'cover' },
});

export default CoordinatorEventDetailScreen;
