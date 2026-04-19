import React, { useMemo, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  ActivityIndicator,
  Alert,
  Platform,
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
import DateTimePicker from '@react-native-community/datetimepicker';
import { addCoordinatorEventPhoto, addCoordinatorEventReport } from '../api/api';
import { normalizePhotos, normalizeReports } from '../utils/eventAssets';
import { getEventStatus } from '../utils/eventLifecycle';
import { contactByPhoneCall, contactByWhatsApp, hasDirectContactPhone } from '../utils/contact';
import { useResponsiveMetrics } from '../utils/responsive';
import { getAppPalette, getResponsiveTokens } from '../theme/tokens';

const getStaffDisplayName = (staffMember) => staffMember?.name || staffMember?.fullName || 'Sin nombre';

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
  directImpact: '',
  indirectImpact: '',
  hasRedemptions: false,
  redemptionsCount: '0',
  relevantAspects: '',
});

const parseTimeValue = (value) => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value
    .trim()
    .replace(/\u00A0/g, ' ')
    .replace(/a\.\s*m\./i, 'AM')
    .replace(/p\.\s*m\./i, 'PM')
    .replace(/a\.m\./i, 'AM')
    .replace(/p\.m\./i, 'PM');

  const match = normalizedValue.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3].toUpperCase();

  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
    return null;
  }

  const date = new Date();
  date.setSeconds(0, 0);
  let normalizedHours = hours % 12;
  if (period === 'PM') {
    normalizedHours += 12;
  }
  date.setHours(normalizedHours, minutes, 0, 0);
  return date;
};

const formatReportTime = (value) => {
  const parsed = value instanceof Date ? value : parseTimeValue(value);
  if (!parsed) {
    return '';
  }

  return parsed.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const getTimeMinutesFromDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return (date.getHours() * 60) + date.getMinutes();
};

const Field = ({ styles, label, value, onChangeText, multiline = false, placeholder = '', editable = true }) => (
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
      editable={editable}
    />
  </View>
);

const CoordinatorEventDetailScreen = ({ event, user, onBack, onEventUpdated, roleConfig }) => {
  const metrics = useResponsiveMetrics();
  const tokens = getResponsiveTokens(metrics);
  const palette = getAppPalette(roleConfig?.theme || 'brown');
  const styles = useMemo(() => createStyles(palette, metrics, tokens), [palette, metrics, tokens]);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [currentEvent, setCurrentEvent] = useState(event);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [savingReport, setSavingReport] = useState(false);
  const [reportForm, setReportForm] = useState(createEmptyReportForm());
  const [reportTimePicker, setReportTimePicker] = useState(null);
  const [reportComposerExpanded, setReportComposerExpanded] = useState(false);

  const photos = useMemo(() => normalizePhotos(currentEvent?.photos), [currentEvent?.photos]);
  const reports = useMemo(() => normalizeReports(currentEvent?.reports), [currentEvent?.reports]);
  const eventStatus = currentEvent?.eventStatus || getEventStatus(currentEvent);
  const isEventFinalized = eventStatus === 'finalized';
  const isEventNotStarted = eventStatus === 'not_started';
  const canManageReports = eventStatus === 'active';

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
    if (!canManageReports) {
      Alert.alert(
        isEventNotStarted ? 'Evento no iniciado' : 'Evento finalizado',
        isEventNotStarted ? 'El evento aún no ha iniciado' : 'El evento ha finalizado',
      );
      return;
    }

    if (!reportForm.startTime.trim() || !reportForm.endTime.trim()) {
        Alert.alert('Datos incompletos', 'Completa la hora de inicio y finalización.');
      return;
    }

    const parsedStartTime = parseTimeValue(reportForm.startTime);
    const parsedEndTime = parseTimeValue(reportForm.endTime);
    if (!parsedStartTime || !parsedEndTime) {
      Alert.alert('Hora inválida', 'Selecciona horas válidas para inicio y finalización.');
      return;
    }
    const startMinutes = (parsedStartTime.getHours() * 60) + parsedStartTime.getMinutes();
    const endMinutes = (parsedEndTime.getHours() * 60) + parsedEndTime.getMinutes();
    if (startMinutes === endMinutes) {
      Alert.alert('Hora inválida', 'La hora de finalización debe ser distinta a la hora de inicio.');
      return;
    }
    const durationMinutes = endMinutes > startMinutes ? (endMinutes - startMinutes) : (1440 - startMinutes) + endMinutes;
    if (durationMinutes <= 0 || durationMinutes > 1440) {
      Alert.alert('Hora inválida', 'El bloque horario del informe no puede superar 24 horas.');
      return;
    }

    if (!reportForm.initialInventory.trim() || !reportForm.finalInventory.trim()) {
        Alert.alert('Datos incompletos', 'Completa el inventario inicial y final.');
      return;
    }

    if (reportForm.directImpact.trim() === '' || reportForm.indirectImpact.trim() === '') {
        Alert.alert('Datos incompletos', 'Completa el impacto directo e indirecto.');
      return;
    }

    if (!/^\d+$/.test(reportForm.directImpact) || !/^\d+$/.test(reportForm.indirectImpact)) {
      Alert.alert('Formato inválido', 'El impacto directo e indirecto deben ser numéricos.');
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
        directImpact: Number(reportForm.directImpact),
        indirectImpact: Number(reportForm.indirectImpact),
        hasRedemptions: reportForm.hasRedemptions,
        redemptionsCount: reportForm.hasRedemptions ? Number(reportForm.redemptionsCount || 0) : 0,
        relevantAspects: reportForm.relevantAspects,
      });
      updateEventState(updatedEvent);
      setReportForm(createEmptyReportForm());
      setReportComposerExpanded(false);
      Alert.alert('Éxito', 'El informe quedó guardado y visible para el ejecutivo.');
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.message || 'No se pudo guardar el informe.');
    } finally {
      setSavingReport(false);
    }
  };

  const handleReportTimeChange = (event, selectedDate) => {
    const target = reportTimePicker;
    if (Platform.OS !== 'ios') {
      setReportTimePicker(null);
    }
    if (!selectedDate || !target) {
      return;
    }

    setReportForm((current) => ({
      ...current,
      [target]: formatReportTime(selectedDate),
    }));
  };

  const handleToggleReportComposer = () => {
    if (!canManageReports) {
      Alert.alert(
        isEventNotStarted ? 'Evento no iniciado' : 'Evento finalizado',
        isEventNotStarted ? 'El evento aún no ha iniciado' : 'El evento ha finalizado',
      );
      return;
    }

    setReportComposerExpanded((current) => !current);
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
            <View style={styles.pointContactButtons}>
              <TouchableOpacity style={styles.secondaryButton} onPress={handlePickPhoto} disabled={uploadingPhoto}>
                <Text style={styles.secondaryButtonText}>{uploadingPhoto ? 'GUARDANDO...' : 'CARGAR FOTO'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setGalleryVisible(true)}>
                <Text style={styles.secondaryButtonText}>VER GALERÍA</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.reportBox}>
            <TouchableOpacity style={styles.reportHeader} onPress={handleToggleReportComposer} activeOpacity={0.8}>
              <View style={styles.reportHeaderCopy}>
                <Text style={styles.reportTitle}>Informes del coordinador ({reports.length})</Text>
                <Text style={styles.helperText}>Toca para abrir o cerrar el formulario. Inicia colapsado por defecto.</Text>
              </View>
              <Text style={styles.reportHeaderToggle}>{!canManageReports ? '🔒' : (reportComposerExpanded ? '−' : '+')}</Text>
            </TouchableOpacity>

            {!canManageReports ? (
              <Text style={styles.noticeText}>{isEventNotStarted ? 'El evento aún no ha iniciado' : 'El evento ha finalizado'}</Text>
            ) : null}

            {reportComposerExpanded && canManageReports ? (
              <View style={styles.reportComposerCard}>
                <Field styles={styles} label="Título opcional" value={reportForm.title} onChangeText={(value) => setReportForm((current) => ({ ...current, title: value }))} placeholder="Ej: Cierre día 1" />
                <View style={styles.doubleColumn}>
                  <View style={styles.columnItem}>
                    <TouchableOpacity onPress={() => setReportTimePicker('startTime')}>
                      <Field styles={styles} label="Hora inicio *" value={reportForm.startTime} onChangeText={() => {}} placeholder="Seleccionar hora" editable={false} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.columnItem}>
                    <TouchableOpacity onPress={() => setReportTimePicker('endTime')}>
                      <Field styles={styles} label="Hora finalización *" value={reportForm.endTime} onChangeText={() => {}} placeholder="Seleccionar hora" editable={false} />
                    </TouchableOpacity>
                  </View>
                </View>
                <Field styles={styles} label="Inventario inicial *" value={reportForm.initialInventory} onChangeText={(value) => setReportForm((current) => ({ ...current, initialInventory: value }))} multiline placeholder="Detalle del inventario al inicio" />
                <Field styles={styles} label="Inventario final *" value={reportForm.finalInventory} onChangeText={(value) => setReportForm((current) => ({ ...current, finalInventory: value }))} multiline placeholder="Detalle del inventario al cierre" />
                <View style={styles.doubleColumn}>
                  <View style={styles.columnItem}>
                    <Field styles={styles} label="Impacto directo *" value={reportForm.directImpact} onChangeText={(value) => setReportForm((current) => ({ ...current, directImpact: value.replace(/[^0-9]/g, '') }))} placeholder="0" />
                  </View>
                  <View style={styles.columnItem}>
                    <Field styles={styles} label="Impacto indirecto *" value={reportForm.indirectImpact} onChangeText={(value) => setReportForm((current) => ({ ...current, indirectImpact: value.replace(/[^0-9]/g, '') }))} placeholder="0" />
                  </View>
                </View>

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
                  {savingReport ? <ActivityIndicator color="#4E342E" /> : <Text style={styles.primaryButtonText}>ENVIAR INFORME</Text>}
                </TouchableOpacity>
              </View>
            ) : null}

            {reports.length === 0 ? (
              <Text style={styles.emptyText}>Todavía no hay informes cargados para este evento.</Text>
            ) : (
              reports.map((report, index) => (
                <View key={report.id || `${report.title}-${index}`} style={styles.reportCard}>
                  <View style={styles.reportCardHeader}>
                    <Text style={styles.reportCardTitle}>{report.title || `Informe ${index + 1}`}</Text>
                    <Text style={styles.reportStatusBadge}>{report.isSubmitted ? 'ENVIADO' : 'BORRADOR'}</Text>
                  </View>
                  <Text style={styles.reportCardDate}>{formatDateTime(report.submittedAt || report.createdAt || report.date)}</Text>
                  {!!report?.author?.fullName && <Text style={styles.reportCardMeta}>Autor: {report.author.fullName}</Text>}
                  {report.isSubmitted ? <Text style={styles.reportCardNotice}>Este informe ya fue enviado y no puede ser editado.</Text> : null}
                  <Text style={styles.reportCardContent}>Inicio: {report.startTime || 'Sin dato'}</Text>
                  <Text style={styles.reportCardContent}>Finalización: {report.endTime || 'Sin dato'}</Text>
                  <Text style={styles.reportCardContent}>Inventario inicial: {report.initialInventory || 'Sin dato'}</Text>
                  <Text style={styles.reportCardContent}>Inventario final: {report.finalInventory || 'Sin dato'}</Text>
                  <Text style={styles.reportCardContent}>Impacto directo: {report.directImpact ?? 'Sin dato'}</Text>
                  <Text style={styles.reportCardContent}>Impacto indirecto: {report.indirectImpact ?? 'Sin dato'}</Text>
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
                <Text key={staffMember.id} style={styles.staffItemDark}>• {getStaffDisplayName(staffMember)} · {staffMember.category}</Text>
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

            <TouchableOpacity style={[styles.primaryButton, styles.closePointDetailButton]} onPress={() => setSelectedPoint(null)}>
              <Text style={styles.primaryButtonText}>CERRAR</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {reportTimePicker ? (
        <DateTimePicker
          value={parseTimeValue(reportForm[reportTimePicker]) || new Date()}
          mode="time"
          is24Hour={false}
          display="default"
          onChange={handleReportTimeChange}
        />
      ) : null}
    </SafeAreaView>
  );
};

const createStyles = (palette, metrics, tokens) => StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.pageBg },
  scrollContent: { paddingBottom: metrics.spacing(42), gap: tokens.spacing.md },
  title: { color: palette.onHero, fontWeight: 'bold', textAlign: 'center' },
  heroImage: { width: '100%', height: metrics.size(190), borderRadius: tokens.radii.md, resizeMode: 'cover' },
  panel: { backgroundColor: palette.panel, borderRadius: tokens.radii.md, padding: tokens.spacing.lg, gap: tokens.spacing.xs },
  eventName: { color: palette.primaryButton, fontSize: metrics.font(24, 0.95), fontWeight: 'bold' },
  metaText: { color: palette.onHero, fontSize: tokens.typography.body },
  section: { gap: tokens.spacing.sm },
  sectionTitle: { color: palette.onHero, fontWeight: 'bold', fontSize: metrics.font(18, 0.9) },
  cityCard: { backgroundColor: palette.panelStrong, borderRadius: tokens.radii.sm, padding: tokens.spacing.md, gap: tokens.spacing.sm },
  cityName: { color: palette.primaryButton, fontSize: metrics.font(18, 0.9), fontWeight: 'bold' },
  cityMeta: { color: palette.onHeroMuted, fontSize: tokens.typography.caption },
  pointCard: { backgroundColor: 'rgba(0,0,0,0.14)', borderRadius: tokens.radii.sm, padding: tokens.spacing.sm + metrics.spacing(2), gap: metrics.spacing(5, 0.8) },
  pointTitle: { color: palette.onHero, fontSize: metrics.font(16, 0.88), fontWeight: 'bold' },
  pointText: { color: '#F3F4F6', fontSize: tokens.typography.label },
  staffItem: { color: '#FDE68A', fontSize: tokens.typography.caption, marginLeft: metrics.spacing(6, 0.8) },
  staffItemDark: { color: palette.text, fontSize: tokens.typography.caption, marginLeft: metrics.spacing(6, 0.8) },
  pointDetailButton: { marginTop: tokens.spacing.xs, alignSelf: 'flex-start', backgroundColor: palette.primaryButton, borderRadius: tokens.radii.sm, paddingHorizontal: tokens.spacing.sm + metrics.spacing(2), paddingVertical: tokens.spacing.sm },
  pointDetailButtonText: { color: palette.primaryButtonText, fontSize: tokens.typography.caption, fontWeight: 'bold' },
  sectionRow: { gap: tokens.spacing.md },
  assetBox: { backgroundColor: palette.panel, borderRadius: tokens.radii.sm, padding: tokens.spacing.md, gap: tokens.spacing.sm },
  latestPhoto: { width: '100%', height: metrics.size(180), borderRadius: tokens.radii.sm, resizeMode: 'cover' },
  helperText: { color: palette.onHeroMuted, fontSize: tokens.typography.label, lineHeight: metrics.font(18, 0.8) },
  helperHint: { color: '#FDE68A', fontSize: tokens.typography.caption, lineHeight: metrics.font(16, 0.78) },
  rowButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm },
  pointContactButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm, marginBottom: tokens.spacing.md },
  closePointDetailButton: { marginTop: 8 },
  secondaryButton: { flexGrow: 1, flexBasis: metrics.compactWidth ? '100%' : 0, backgroundColor: palette.secondaryButton, borderRadius: tokens.radii.sm, paddingVertical: tokens.spacing.md, alignItems: 'center' },
  disabledButton: { opacity: 0.55 },
  secondaryButtonText: { color: palette.secondaryButtonText, fontWeight: 'bold' },
  reportBox: { backgroundColor: palette.panel, borderRadius: tokens.radii.sm, padding: tokens.spacing.md, gap: tokens.spacing.sm },
  reportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: tokens.spacing.sm },
  reportHeaderCopy: { flex: 1, gap: tokens.spacing.xs },
  reportTitle: { color: palette.onHero, fontSize: metrics.font(17, 0.88), fontWeight: 'bold' },
  reportHeaderToggle: { color: palette.primaryButton, fontSize: metrics.font(24, 0.9), fontWeight: '800', lineHeight: metrics.font(24, 0.9) },
  reportComposerCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: tokens.radii.sm, padding: tokens.spacing.md, gap: tokens.spacing.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  emptyText: { color: '#E5E7EB', fontSize: tokens.typography.label },
  noticeText: { color: '#FDE68A', fontSize: tokens.typography.caption, fontWeight: '700' },
  fieldGroup: { gap: metrics.spacing(6, 0.8) },
  fieldLabel: { color: palette.onHero, fontSize: tokens.typography.label, fontWeight: 'bold' },
  fieldInput: { backgroundColor: palette.surface, borderRadius: tokens.radii.sm, paddingHorizontal: tokens.spacing.sm + metrics.spacing(2), paddingVertical: tokens.spacing.sm + metrics.spacing(2), color: '#222', fontSize: tokens.typography.bodyLg },
  fieldInputMultiline: { minHeight: metrics.size(92) },
  doubleColumn: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm },
  columnItem: { flexGrow: 1, flexBasis: metrics.compactWidth ? '100%' : 0 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: metrics.spacing(4, 0.75) },
  switchLabel: { color: palette.onHero, fontWeight: 'bold' },
  reportCard: { backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: tokens.radii.sm, padding: tokens.spacing.sm, gap: metrics.spacing(4, 0.75) },
  reportCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: tokens.spacing.sm },
  reportCardTitle: { color: palette.onHero, fontWeight: 'bold' },
  reportStatusBadge: { color: palette.primaryButton, fontSize: tokens.typography.caption, fontWeight: '800' },
  reportCardNotice: { color: '#FDE68A', fontSize: tokens.typography.caption, fontWeight: '700' },
  reportCardDate: { color: '#D7CCC8', fontSize: tokens.typography.caption },
  reportCardMeta: { color: '#FDE68A', fontSize: tokens.typography.caption },
  reportCardContent: { color: '#F3F4F6', fontSize: tokens.typography.label },
  primaryButton: { backgroundColor: palette.primaryButton, borderRadius: tokens.radii.pill, paddingVertical: metrics.spacing(15), alignItems: 'center' },
  primaryButtonText: { color: palette.primaryButtonText, fontWeight: 'bold' },
  contactSection: { backgroundColor: palette.panel, borderRadius: tokens.radii.sm, padding: tokens.spacing.md, gap: tokens.spacing.sm },
  backButton: { backgroundColor: palette.secondaryButton, borderRadius: tokens.radii.pill, paddingVertical: tokens.spacing.md, alignItems: 'center' },
  backButtonText: { color: palette.secondaryButtonText, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: metrics.screenPadding },
  modalCard: { backgroundColor: palette.surface, borderRadius: tokens.radii.lg, padding: tokens.spacing.lg, maxHeight: '88%', width: '100%', maxWidth: metrics.modalMaxWidth, alignSelf: 'center' },
  modalTitle: { color: palette.text, fontSize: metrics.cardTitleSize, fontWeight: 'bold', textAlign: 'center', marginBottom: tokens.spacing.md },
  modalInfoText: { color: '#4B5563', fontSize: tokens.typography.body },
  pointDetailContent: { gap: tokens.spacing.xs, marginBottom: tokens.spacing.lg },
  galleryContent: { gap: tokens.spacing.sm },
  modalEmptyText: { color: '#6B7280', textAlign: 'center', fontSize: tokens.typography.body },
  galleryCard: { gap: metrics.spacing(6, 0.8) },
  galleryMeta: { color: '#6B7280', fontSize: tokens.typography.caption },
  galleryPhoto: { width: '100%', height: metrics.size(180), borderRadius: tokens.radii.sm, resizeMode: 'cover' },
});

export default CoordinatorEventDetailScreen;
