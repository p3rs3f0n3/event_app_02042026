import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView, Alert, Platform, Image, ActivityIndicator, Modal, Linking } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { createEvent, updateEvent, getClients, getCoordinators, getStaff, getStaffCategories, getColombiaCities, addColombiaCity } from '../api/api';
import { getAppPalette, getResponsiveTokens } from '../theme/tokens';
import { useResponsiveMetrics } from '../utils/responsive';

const isOtherCityOption = (city) => Boolean(city?.isOther || String(city?.name || '').trim().toUpperCase() === 'OTRO');
const normalizeCityName = (value) => String(value || '').trim().toLowerCase();
const normalizeComparableValue = (value) => String(value || '').trim().toLowerCase();
const normalizePhoneValue = (value) => String(value || '').replace(/\D/g, '').slice(0, 10);
const getCoordinatorDisplayName = (coordinator) => coordinator?.name || coordinator?.fullName || 'Sin nombre';
const getStaffDisplayName = (staffMember) => staffMember?.name || staffMember?.fullName || 'Sin nombre';
const MAX_EVENT_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const getEventImagePreviewUri = (image) => (typeof image === 'string' ? image : image?.uri || null);

const startOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const getClientDescription = (client) => [client?.username ? `@${client.username}` : null, client?.contactFullName || null, client?.email || null].filter(Boolean).join(' · ');

const getClientLabel = (client) => client?.razonSocial || client?.fullName || client?.contactFullName || '';

const findMatchingClient = (clients, eventLike) => {
  const explicitClientId = Number(eventLike?.clientUserId);
  if (Number.isInteger(explicitClientId) && explicitClientId > 0) {
    return clients.find((client) => Number(client.userId || client.id) === explicitClientId) || null;
  }

  const explicitMasterClientId = Number(eventLike?.clientId);
  if (Number.isInteger(explicitMasterClientId) && explicitMasterClientId > 0) {
    return clients.find((client) => Number(client.clientId) === explicitMasterClientId) || null;
  }

  const comparableClient = normalizeComparableValue(eventLike?.client);
  if (!comparableClient) {
    return null;
  }

  const matches = clients.filter((client) => [client.fullName, client.razonSocial, client.contactFullName, client.username, client.email].some((value) => normalizeComparableValue(value) === comparableClient));
  return matches.length === 1 ? matches[0] : null;
};

const createEmptyPoint = () => ({ establishment: '', address: '', contact: '', phone: '', startTime: null, endTime: null, coordinator: null, assignedStaff: [], __originalRef: null });

const buildPointOriginalRef = ({ eventId, cityIndex, pointIndex }) => {
  const normalizedEventId = Number(eventId);
  const normalizedCityIndex = Number(cityIndex);
  const normalizedPointIndex = Number(pointIndex);

  if (!Number.isInteger(normalizedEventId) || normalizedEventId <= 0 || !Number.isInteger(normalizedCityIndex) || normalizedCityIndex < 0 || !Number.isInteger(normalizedPointIndex) || normalizedPointIndex < 0) {
    return null;
  }

  return {
    eventId: normalizedEventId,
    cityIndex: normalizedCityIndex,
    pointIndex: normalizedPointIndex,
  };
};

const attachOriginalRefsToCities = (cities, eventId) => (
  Array.isArray(cities)
    ? cities.map((city, cityIndex) => ({
      ...city,
      points: Array.isArray(city?.points)
        ? city.points.map((point, pointIndex) => ({
          ...point,
          __originalRef: point?.__originalRef || buildPointOriginalRef({ eventId, cityIndex, pointIndex }),
        }))
        : [],
    }))
    : []
);

const normalizePointForForm = (point) => ({
  establishment: point?.establishment || '',
  address: point?.address || '',
  contact: point?.contact || '',
  phone: normalizePhoneValue(point?.phone || ''),
  startTime: point?.startTime ? new Date(point.startTime) : null,
  endTime: point?.endTime ? new Date(point.endTime) : null,
  coordinator: point?.coordinator || null,
  assignedStaff: Array.isArray(point?.assignedStaff) ? point.assignedStaff : [],
  __originalRef: point?.__originalRef || null,
});

const formatPointTime = (value) => {
  if (!value) {
    return 'Sin dato';
  }

  const parsedDate = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return 'Sin dato';
  }

  return parsedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getAssignedStaffLabel = (point) => {
  const staffNames = Array.isArray(point?.assignedStaff)
    ? point.assignedStaff.map((staffMember) => staffMember?.name || staffMember?.fullName).filter(Boolean)
    : [];

  return staffNames.length ? staffNames.join(', ') : 'Sin staff asignado';
};

const getPointPreviewSummary = (point) => {
  const parts = [
    `Coordinador: ${getCoordinatorDisplayName(point?.coordinator)}`,
    `Staff: ${getAssignedStaffLabel(point)}`,
  ];

  return parts.join(' · ');
};

const buildInitialEventData = (eventToEdit = null) => ({
  name: eventToEdit?.name || '',
  client: eventToEdit?.client || '',
  clientId: eventToEdit?.clientId || null,
  clientUserId: eventToEdit?.clientUserId || null,
  startDate: eventToEdit?.startDate ? new Date(eventToEdit.startDate) : null,
  endDate: eventToEdit?.endDate ? new Date(eventToEdit.endDate) : null,
  image: eventToEdit?.image || null,
  cities: attachOriginalRefsToCities(eventToEdit?.cities, eventToEdit?.id),
});

const getUtcMinutes = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return (date.getUTCHours() * 60) + date.getUTCMinutes();
};

const hasTimeOverlap = (leftStart, leftEnd, rightStart, rightEnd) => {
  const leftStartMinutes = getUtcMinutes(leftStart);
  const leftEndMinutes = getUtcMinutes(leftEnd);
  const rightStartMinutes = getUtcMinutes(rightStart);
  const rightEndMinutes = getUtcMinutes(rightEnd);

  if ([leftStartMinutes, leftEndMinutes, rightStartMinutes, rightEndMinutes].some((value) => value === null)) {
    return false;
  }

  return leftStartMinutes < rightEndMinutes && rightStartMinutes < leftEndMinutes;
};

const InputField = ({ styles, label, value, onChangeText, placeholder, editable = true, onPress, keyboardType = 'default', maxLength, autoCapitalize = 'sentences' }) => (
  <View style={styles.inputContainer}>
    <Text style={styles.label}>{label}</Text>
    {onPress ? (
      <TouchableOpacity onPress={onPress}>
        <Text style={[styles.input, !value && { color: 'rgba(255,255,255,0.5)' }]}>{value || placeholder}</Text>
      </TouchableOpacity>
    ) : (
      <TextInput style={styles.input} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="rgba(255,255,255,0.5)" editable={editable} keyboardType={keyboardType} maxLength={maxLength} autoCapitalize={autoCapitalize} />
    )}
    <View style={styles.divider} />
  </View>
);

const CreateEventScreen = ({ onBack, user, eventToEdit = null }) => {
  const metrics = useResponsiveMetrics();
  const tokens = getResponsiveTokens(metrics);
  const palette = getAppPalette('green');
  const styles = useMemo(() => createStyles(palette, metrics, tokens), [palette, metrics, tokens]);
  const [step, setStep] = useState(1);
  const [showPicker, setShowPicker] = useState(null);
  const [apiLists, setApiLists] = useState({ coordinators: [], staff: [], cities: [], clients: [] });
  const [loading, setLoading] = useState(true);
  const [eventData, setEventData] = useState(() => buildInitialEventData(eventToEdit));

  const [currentCityName, setCurrentCityName] = useState('');
  const [cityPoints, setCityPoints] = useState([]);
  const [editingCityIndex, setEditingCityIndex] = useState(null);
  const [editingPointIndex, setEditingPointIndex] = useState(null);
  const [isNewCity, setIsNewCity] = useState(false);
  const [manualCityName, setManualCityName] = useState('');
  const [showCitySearch, setShowCitySearch] = useState(false);
  const [showClientSearch, setShowClientSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [clientSearchResults, setClientSearchResults] = useState([]);
  const [clientSearchLoading, setClientSearchLoading] = useState(false);
  const [showImageActions, setShowImageActions] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [staffInDetail, setStaffInDetail] = useState(null);
  const [pointInDetail, setPointInDetail] = useState(null);
  const [expandedStaffPhoto, setExpandedStaffPhoto] = useState(null);
  const [categories, setCategories] = useState([]);

  const [currentPoint, setCurrentPoint] = useState(createEmptyPoint());
  const isEditingEvent = Boolean(eventToEdit);
  const isEditingPoint = editingPointIndex !== null;
  const isEditingCity = editingCityIndex !== null;
  const minimumEventDate = useMemo(() => startOfToday(), []);
  const minimumEndDate = useMemo(() => {
    if (eventData.startDate instanceof Date && !Number.isNaN(eventData.startDate.getTime())) {
      const startDate = new Date(eventData.startDate);
      startDate.setHours(0, 0, 0, 0);
      return startDate < minimumEventDate ? minimumEventDate : startDate;
    }

    return minimumEventDate;
  }, [eventData.startDate, minimumEventDate]);
  const coordinatorButtonText = isEditingPoint
    ? 'ACTUALIZAR COORDINADOR *'
    : 'ASIGNAR COORDINADOR *';
  const pointActionText = isEditingPoint ? 'ACTUALIZAR PUNTO' : 'AÑADIR PUNTO';
  const cityActionText = isEditingCity ? 'ACTUALIZAR CIUDAD' : 'AGREGAR CIUDAD';
  const selectedClient = useMemo(
    () => apiLists.clients.find((client) => Number(client.clientId) === Number(eventData.clientId))
      || apiLists.clients.find((client) => Number(client.userId || client.id) === Number(eventData.clientUserId))
      || null,
    [apiLists.clients, eventData.clientId, eventData.clientUserId],
  );
  const eventImagePreviewUri = useMemo(() => getEventImagePreviewUri(eventData.image), [eventData.image]);

  const resolvedCityName = (isNewCity ? manualCityName : currentCityName).trim();
  const filteredCategories = useMemo(() => {
    const normalizedQuery = normalizeComparableValue(categorySearchQuery);

    if (!normalizedQuery) {
      return categories;
    }

    return categories.filter((category) => normalizeComparableValue(category).includes(normalizedQuery));
  }, [categories, categorySearchQuery]);

  const openGoogleMapsSearch = async () => {
    const query = currentPoint.address?.trim() || resolvedCityName || 'Colombia';
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

    try {
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Google Maps', 'No se pudo abrir la búsqueda externa en este dispositivo.');
    }
  };

  const launchEventImagePicker = async ({ allowsEditing = false } = {}) => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permiso requerido', 'Necesitas habilitar la galería para cargar la foto del evento.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing,
        quality: 1,
        base64: true,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];
      const mimeType = asset.mimeType || 'image/jpeg';
      const fileSize = Number(asset.fileSize || 0) || null;

      if (fileSize && fileSize > MAX_EVENT_IMAGE_SIZE_BYTES) {
        Alert.alert('Archivo demasiado grande', 'La foto del evento supera el límite de 10 MB.');
        return;
      }

      const uri = asset.base64 ? `data:${mimeType};base64,${asset.base64}` : asset.uri;

      setEventData((prev) => ({
        ...prev,
        image: {
          uri,
          mimeType,
          fileSize,
          fileName: asset.fileName || null,
          source: 'event',
        },
      }));
      setShowImageActions(true);
    } catch (error) {
      Alert.alert('Error', 'No se pudo abrir la galería en este dispositivo.');
    }
  };

  const handlePickEventImage = () => launchEventImagePicker({ allowsEditing: false });

  const handleEditEventImage = () => launchEventImagePicker({ allowsEditing: true });

  const handleUseEventImageAsIs = () => {
    setShowImageActions(false);
  };

  const handleRemoveEventImage = () => {
    setEventData((prev) => ({ ...prev, image: null }));
    setShowImageActions(false);
  };

  const searchClientsFromApi = async (query = '') => {
    setClientSearchLoading(true);
    try {
      const clients = await getClients(query ? { q: query } : {});
      setClientSearchResults(Array.isArray(clients) ? clients : []);
    } catch (error) {
      setClientSearchResults([]);
      Alert.alert('Error', 'No se pudo buscar clientes en la base de datos');
    } finally {
      setClientSearchLoading(false);
    }
  };

  const buildDraftCities = () => {
    const draftCities = [...eventData.cities];

    if (!resolvedCityName) {
      return draftCities;
    }

    if (editingCityIndex !== null) {
      draftCities[editingCityIndex] = { name: resolvedCityName, points: cityPoints };
      return draftCities;
    }

    if (cityPoints.length > 0) {
      draftCities.push({ name: resolvedCityName, points: cityPoints });
    }

    return draftCities;
  };

  const getLocalAvailability = () => {
    const coordinatorIds = new Set();
    const staffIds = new Set();

    if (!resolvedCityName || !currentPoint.startTime || !currentPoint.endTime) {
      return { coordinatorIds, staffIds };
    }

    for (const [cityIndex, city] of buildDraftCities().entries()) {
      if (normalizeCityName(city?.name) !== normalizeCityName(resolvedCityName)) {
        continue;
      }

      const points = Array.isArray(city?.points) ? city.points : [];

      for (let index = 0; index < points.length; index += 1) {
        if (editingCityIndex !== null && editingPointIndex !== null && cityIndex === editingCityIndex && index === editingPointIndex) {
          continue;
        }

        const point = points[index];
        if (!hasTimeOverlap(point?.startTime, point?.endTime, currentPoint.startTime, currentPoint.endTime)) {
          continue;
        }

        const coordinatorId = Number(point?.coordinator?.id);
        if (Number.isInteger(coordinatorId) && coordinatorId > 0) {
          coordinatorIds.add(coordinatorId);
        }

        for (const staffMember of Array.isArray(point?.assignedStaff) ? point.assignedStaff : []) {
          const staffId = Number(staffMember?.id);
          if (Number.isInteger(staffId) && staffId > 0) {
            staffIds.add(staffId);
          }
        }
      }
    }

    return { coordinatorIds, staffIds };
  };

  useEffect(() => {
    setStep(1);
    setShowPicker(null);
    setEventData(buildInitialEventData(eventToEdit));
    setCurrentCityName('');
    setCityPoints([]);
    setEditingCityIndex(null);
    setEditingPointIndex(null);
    setIsNewCity(false);
    setManualCityName('');
    setShowCitySearch(false);
    setShowClientSearch(false);
    setSearchQuery('');
    setClientSearchQuery('');
    setShowImageActions(false);
    setSelectedCategory(null);
    setCategorySearchQuery('');
    setStaffInDetail(null);
    setPointInDetail(null);
    setExpandedStaffPhoto(null);
    setCurrentPoint(createEmptyPoint());
  }, [eventToEdit?.id]);

  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const [cities, clients, staffCategories] = await Promise.all([getColombiaCities(), getClients(), getStaffCategories()]);
        setApiLists(prev => ({ ...prev, cities, clients }));
        setClientSearchResults(Array.isArray(clients) ? clients : []);
        setCategories(Array.isArray(staffCategories) ? staffCategories.map((category) => category.name) : []);
      } catch (error) { Alert.alert('Error', 'No se cargaron ciudades'); } finally { setLoading(false); }
    };
    fetchInitial();
  }, []);

  useEffect(() => {
    if (apiLists.clients.length === 0) {
      return;
    }

    const matchedClient = findMatchingClient(apiLists.clients, eventData);
    if (!matchedClient) {
      return;
    }

    const nextClientLabel = getClientLabel(matchedClient);
    if (Number(eventData.clientUserId) === Number(matchedClient.userId || matchedClient.id) && Number(eventData.clientId) === Number(matchedClient.clientId) && eventData.client === nextClientLabel) {
      return;
    }

    setEventData((prev) => ({
      ...prev,
      client: nextClientLabel,
      clientId: matchedClient.clientId || null,
      clientUserId: matchedClient.userId || matchedClient.id,
    }));
  }, [apiLists.clients, eventData]);

  useEffect(() => {
    if (!showClientSearch) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      searchClientsFromApi(clientSearchQuery.trim());
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [clientSearchQuery, showClientSearch]);

  useEffect(() => {
    if (eventToEdit?.isInactive) {
      Alert.alert('Evento inactivo', 'Este evento ya no admite edición', [{ text: 'OK', onPress: onBack }]);
    }
  }, [eventToEdit?.id, eventToEdit?.isInactive, onBack]);

  const validateEventMetadata = () => {
    if (!eventData.name || !eventData.client || !eventData.clientUserId || !eventData.startDate || !eventData.endDate || !eventData.image) {
      Alert.alert('Incompleto', 'Llene todos los campos técnicos y cargue foto'); return false;
    }
    if (new Date(eventData.startDate) < minimumEventDate) {
      Alert.alert('Fecha inválida', 'La fecha de inicio no puede ser anterior a hoy'); return false;
    }
    if (new Date(eventData.endDate) < minimumEndDate) {
      Alert.alert('Fecha inválida', 'La fecha fin no puede ser anterior a la fecha de inicio'); return false;
    }
    if (new Date(eventData.endDate) <= new Date(eventData.startDate)) {
      Alert.alert('Fecha Inválida', 'La fecha fin debe ser posterior'); return false;
    }
    return true;
  };

  const handleAddPoint = () => {
    if (!currentPoint.establishment || !currentPoint.address || !currentPoint.contact || !currentPoint.phone || !currentPoint.coordinator || !currentPoint.startTime || !currentPoint.endTime) {
      return Alert.alert('Error', 'Complete establecimiento, dirección, contacto, teléfono, horarios y coordinador');
    }
    if (currentPoint.phone.length > 10) {
      return Alert.alert('Error', 'El teléfono de contacto no puede superar 10 dígitos');
    }
    if (new Date(currentPoint.endTime).getTime() <= new Date(currentPoint.startTime).getTime()) {
      return Alert.alert('Error', 'Hora fin debe ser posterior a inicio');
    }
    const normalizedPoint = {
      ...currentPoint,
      phone: normalizePhoneValue(currentPoint.phone),
    };

    if (editingPointIndex !== null) {
      setCityPoints(cityPoints.map((point, index) => (index === editingPointIndex ? normalizedPoint : point)));
      setEditingPointIndex(null);
    } else {
      setCityPoints([...cityPoints, normalizedPoint]);
    }

    setCurrentPoint(createEmptyPoint());
    handleClearCategorySelection();
  };

  const handleAddCity = async () => {
    try {
      let cityName = resolvedCityName;
      if (isNewCity) {
        if (!cityName) return Alert.alert('Error', 'Indique ciudad');
        const newCity = await addColombiaCity(cityName);
        cityName = newCity.name;
        setApiLists((prev) => ({ ...prev, cities: [...prev.cities.filter((city) => !isOtherCityOption(city)), newCity, ...prev.cities.filter((city) => isOtherCityOption(city))] }));
      }
      if (!cityName || cityPoints.length === 0) return Alert.alert('Error', 'Faltan ciudad o puntos');
      const updated = [...eventData.cities];
      if (editingCityIndex !== null) updated[editingCityIndex] = { name: cityName, points: cityPoints };
      else updated.push({ name: cityName, points: cityPoints });
      setEventData({ ...eventData, cities: updated });
      setCurrentCityName(''); setCityPoints([]); setEditingCityIndex(null); setEditingPointIndex(null); setIsNewCity(false); setManualCityName(''); setCurrentPoint(createEmptyPoint()); handleClearCategorySelection();
    } catch (error) {
      Alert.alert('Error', error?.message || 'No se pudo registrar la ciudad');
    }
  };

  const handleFinalSave = async () => {
    if (!validateEventMetadata()) return;
    try {
      let finalCities = [...eventData.cities];
      if (resolvedCityName && cityPoints.length > 0) {
         let cityName = resolvedCityName;
         if (isNewCity) {
            const newCity = await addColombiaCity(cityName);
            cityName = newCity.name;
            setApiLists((prev) => ({ ...prev, cities: [...prev.cities.filter((city) => !isOtherCityOption(city)), newCity, ...prev.cities.filter((city) => isOtherCityOption(city))] }));
          }
          if (editingCityIndex !== null) finalCities[editingCityIndex] = { name: cityName, points: cityPoints }; else finalCities.push({ name: cityName, points: cityPoints });
      }
      if (finalCities.length === 0) return Alert.alert('Error', 'El evento debe tener contenido');
      const payload = { ...eventData, createdByUserId: user?.id, cities: finalCities };
      if (eventToEdit) await updateEvent(eventToEdit.id, payload); else await createEvent(payload);
      Alert.alert('Éxito', 'Evento registrado'); onBack();
    } catch (e) { Alert.alert('Error', e?.response?.data?.message || 'No se pudo conectar al API'); }
  };

  const validateAvailabilityContext = () => {
    if (!resolvedCityName) {
      Alert.alert('Error', 'Defina la ciudad');
      return false;
    }

    if (!currentPoint.startTime || !currentPoint.endTime) {
      Alert.alert('Error', 'Defina hora inicio y fin antes de asignar');
      return false;
    }

    if (!eventData.startDate || !eventData.endDate) {
      Alert.alert('Error', 'Defina fechas del evento antes de asignar');
      return false;
    }

    return true;
  };

  const fetchCoordinatorsForCity = async () => {
    if (!validateAvailabilityContext()) {
      return;
    }

    setLoading(true);
    try {
      const localAvailability = getLocalAvailability();
      const coords = await getCoordinators({
        city: resolvedCityName,
        startTime: currentPoint.startTime?.toISOString?.() || currentPoint.startTime,
        endTime: currentPoint.endTime?.toISOString?.() || currentPoint.endTime,
        eventStartDate: eventData.startDate?.toISOString?.() || eventData.startDate,
        eventEndDate: eventData.endDate?.toISOString?.() || eventData.endDate,
        excludeEventId: currentPoint.__originalRef?.eventId,
        excludeCityIndex: currentPoint.__originalRef?.cityIndex,
        excludePointIndex: currentPoint.__originalRef?.pointIndex,
        selectedCoordinatorId: currentPoint.coordinator?.id,
      });
      setApiLists(prev => ({
        ...prev,
        coordinators: coords.map((coord) => {
          const coordinatorId = Number(coord.id);
          const isSelected = Number(currentPoint.coordinator?.id) === coordinatorId;
          const locallyUnavailable = localAvailability.coordinatorIds.has(coordinatorId) && !isSelected;

          return {
            ...coord,
            isAvailable: Boolean(coord.isAvailable !== false) && !locallyUnavailable,
            unavailableReason: locallyUnavailable ? 'Ocupado en otro punto de esta ciudad para este evento' : coord.unavailableReason,
          };
        }),
      }));
      setStep(3);
    } catch (e) { Alert.alert('Error', 'No hay coordinadores'); } finally { setLoading(false); }
  };

  const fetchStaffByCategory = async (category) => {
    if (!validateAvailabilityContext()) {
      return;
    }

    setLoading(true);
    try {
      const localAvailability = getLocalAvailability();
      const selectedStaffIds = currentPoint.assignedStaff.map((item) => item.id).join(',');
      const res = await getStaff({
        city: resolvedCityName,
        category,
        startTime: currentPoint.startTime?.toISOString?.() || currentPoint.startTime,
        endTime: currentPoint.endTime?.toISOString?.() || currentPoint.endTime,
        eventStartDate: eventData.startDate?.toISOString?.() || eventData.startDate,
        eventEndDate: eventData.endDate?.toISOString?.() || eventData.endDate,
        excludeEventId: currentPoint.__originalRef?.eventId,
        excludeCityIndex: currentPoint.__originalRef?.cityIndex,
        excludePointIndex: currentPoint.__originalRef?.pointIndex,
        selectedStaffIds,
      });
      setApiLists(prev => ({
        ...prev,
        staff: res.map((item) => {
          const staffId = Number(item.id);
          const isSelected = currentPoint.assignedStaff.some((person) => Number(person.id) === staffId);
          const locallyUnavailable = localAvailability.staffIds.has(staffId) && !isSelected;

          return {
            ...item,
            isAvailable: Boolean(item.isAvailable !== false) && !locallyUnavailable,
            unavailableReason: locallyUnavailable ? 'Ocupado en otro punto de esta ciudad para este evento' : item.unavailableReason,
          };
        }),
      }));
      setSelectedCategory(category);
    } catch (e) { Alert.alert('Error', 'No hay personal'); } finally { setLoading(false); }
  };

  const onPickerChange = (event, selectedDate) => {
    const type = showPicker; setShowPicker(null); if (!selectedDate) return;
    if (type.includes('date')) {
      const normalizedDate = new Date(selectedDate);
      normalizedDate.setHours(0, 0, 0, 0);
      const fallbackMinimumDate = type === 'end_date' ? minimumEndDate : minimumEventDate;
      const safeDate = normalizedDate < fallbackMinimumDate ? fallbackMinimumDate : normalizedDate;
      setEventData({ ...eventData, [type === 'start_date' ? 'startDate' : 'endDate']: safeDate });
    }
      else {
        setCurrentPoint({ ...currentPoint, [type === 'start_time' ? 'startTime' : 'endTime']: selectedDate, coordinator: null, assignedStaff: [] });
        handleClearCategorySelection();
      }
  };

  const handleSelectPointForEdit = (point, pointIndex) => {
    setCurrentPoint(normalizePointForForm(point));
    setEditingPointIndex(pointIndex);
    handleClearCategorySelection();
  };

  const handleSelectCityForEdit = (city, cityIndex) => {
    setIsNewCity(false);
    setManualCityName('');
    setCurrentCityName(city.name);
    setCityPoints(Array.isArray(city.points) ? city.points : []);
    setEditingCityIndex(cityIndex);
    setEditingPointIndex(null);
    setCurrentPoint(createEmptyPoint());
    handleClearCategorySelection();
  };

  const handleSelectCategory = (category) => {
    setCategorySearchQuery(category);
    fetchStaffByCategory(category);
  };

  const handleClearCategorySelection = () => {
    setSelectedCategory(null);
    setCategorySearchQuery('');
    setApiLists((prev) => ({ ...prev, staff: [] }));
  };

  if (loading && step === 1) return <View style={styles.loading}><ActivityIndicator size="large" color="#FFF" /></View>;

  return (
    <SafeAreaView style={styles.container}> 
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>EVENTAPP</Text>
        
        {step === 1 && (
          <View style={styles.form}>
            <View style={styles.imageCard}>
              <TouchableOpacity style={styles.imageSelector} onPress={handlePickEventImage}>
                {eventImagePreviewUri ? <Image source={{ uri: eventImagePreviewUri }} style={styles.selectedImage} /> : <View style={styles.photoPlaceholder}><Text style={styles.photoText}>FOTO EVENTO *</Text></View>}
              </TouchableOpacity>
              <Text style={styles.helperText}>{eventImagePreviewUri ? 'Vista previa lista. Puedes usar la foto tal cual, volver a abrir la galería para editarla o recortarla, o quitarla.' : 'Elige una foto desde la galería para continuar con la carga.'}</Text>
              {eventImagePreviewUri ? (
                <>
                  {showImageActions ? (
                    <View style={styles.imageActionsCard}>
                      <Text style={styles.imageActionsTitle}>¿Qué quieres hacer con esta foto?</Text>
                      <TouchableOpacity style={styles.secondaryActionButton} onPress={handleUseEventImageAsIs}>
                        <Text style={styles.secondaryActionText}>USAR FOTO TAL CUAL</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.secondaryActionButton} onPress={handleEditEventImage}>
                        <Text style={styles.secondaryActionText}>EDITAR / RECORTAR</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.imageRemoveLink} onPress={handleRemoveEventImage}>
                        <Text style={styles.imageRemoveText}>Cancelar / quitar foto</Text>
                      </TouchableOpacity>
                      <Text style={styles.helperText}>Si eliges editar, el sistema vuelve a abrir la galería con recorte habilitado.</Text>
                    </View>
                  ) : (
                    <View style={styles.imageActionsInline}>
                      <TouchableOpacity style={styles.secondaryActionButton} onPress={handlePickEventImage}>
                        <Text style={styles.secondaryActionText}>CAMBIAR FOTO</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.secondaryActionButton} onPress={handleEditEventImage}>
                        <Text style={styles.secondaryActionText}>EDITAR / RECORTAR</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.imageRemoveLink} onPress={handleRemoveEventImage}>
                        <Text style={styles.imageRemoveText}>Quitar foto</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              ) : null}
            </View>
             <InputField styles={styles} label="Cliente *" value={selectedClient?.fullName || eventData.client} placeholder="Buscar por NIT o nombre..." editable={false} onPress={() => setShowClientSearch(true)} />
             {selectedClient ? <Text style={styles.helperText}>{getClientDescription(selectedClient)}{selectedClient?.nit ? ` · NIT ${selectedClient.nit}` : ''}</Text> : <Text style={styles.helperText}>Busca clientes desde la base por NIT o nombre.</Text>}
            <InputField styles={styles} label="Nombre de evento *" value={eventData.name} onChangeText={(t) => setEventData({...eventData, name: t})} />
            <TouchableOpacity onPress={() => setShowPicker('start_date')}><InputField styles={styles} label="Inicio *" value={eventData.startDate?.toLocaleDateString() || 'Calendario...'} editable={false} /></TouchableOpacity>
            <TouchableOpacity onPress={() => setShowPicker('end_date')}><InputField styles={styles} label="Fin *" value={eventData.endDate?.toLocaleDateString() || 'Calendario...'} editable={false} /></TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => { if (validateEventMetadata()) setStep(2); }}><Text style={styles.actionText}>SIGUIENTE</Text></TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={onBack}><Text style={styles.actionText}>REGRESAR</Text></TouchableOpacity>
          </View>
        )}

        {step === 2 && (
          <View style={styles.form}>
             <InputField styles={styles} label="Ciudad *" value={resolvedCityName} placeholder={isNewCity ? 'Escribe la ciudad...' : 'Buscar...'} onChangeText={isNewCity ? setManualCityName : undefined} onPress={isNewCity ? undefined : () => setShowCitySearch(true)} />
            <TouchableOpacity style={styles.secondaryActionButton} onPress={() => setShowCitySearch(true)}>
              <Text style={styles.secondaryActionText}>{isNewCity ? 'CAMBIAR / BUSCAR CIUDAD' : 'BUSCAR CIUDAD'}</Text>
            </TouchableOpacity>
              <View style={styles.pointFrame}>
                <Text style={styles.pointTitle}>DATOS DEL PUNTO</Text>
                <InputField styles={styles} label="Nombre establecimiento *" value={currentPoint.establishment} onChangeText={(t) => setCurrentPoint({...currentPoint, establishment: t})} />
                <InputField styles={styles} label="Dirección *" value={currentPoint.address} onChangeText={(t) => setCurrentPoint({...currentPoint, address: t})} />
                <Text style={styles.helperText}>Puedes escribir la dirección manualmente, pegar un enlace o abrir una búsqueda externa en Google Maps.</Text>
                <TouchableOpacity style={styles.secondaryActionButton} onPress={openGoogleMapsSearch}><Text style={styles.secondaryActionText}>BUSCAR EN GOOGLE MAPS</Text></TouchableOpacity>
                <InputField styles={styles} label="Contacto Punto de Venta *" value={currentPoint.contact} onChangeText={(t) => setCurrentPoint({...currentPoint, contact: t})} />
                <InputField styles={styles} label="Telefono Contacto *" value={currentPoint.phone} onChangeText={(t) => setCurrentPoint({...currentPoint, phone: normalizePhoneValue(t)})} keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'} maxLength={10} autoCapitalize="none" />
                <Text style={styles.helperText}>Solo números, máximo 10 dígitos.</Text>
                  <TouchableOpacity onPress={() => setShowPicker('start_time')}><InputField styles={styles} label="Hora Inicio *" value={currentPoint.startTime?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || 'Seleccionar...'} editable={false} /></TouchableOpacity>
                 <TouchableOpacity onPress={() => setShowPicker('end_time')}><InputField styles={styles} label="Hora Fin *" value={currentPoint.endTime?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || 'Seleccionar...'} editable={false} /></TouchableOpacity>
                 <TouchableOpacity style={styles.assignButton} onPress={fetchCoordinatorsForCity}><Text style={styles.assignText}>{coordinatorButtonText}</Text></TouchableOpacity>
                 {currentPoint.coordinator ? <Text style={styles.helperText}>Coordinador seleccionado: {getCoordinatorDisplayName(currentPoint.coordinator)}</Text> : null}
                 {currentPoint.assignedStaff.length ? <Text style={styles.helperText}>Staff asignado: {getAssignedStaffLabel(currentPoint)}</Text> : null}
               <TouchableOpacity style={styles.addPointBtn} onPress={handleAddPoint}><Text style={styles.addPointText}>{pointActionText}</Text></TouchableOpacity>
             </View>
             <View style={styles.listPreview}>{cityPoints.map((p, i) => <TouchableOpacity key={i} style={styles.previewRow} onPress={() => (isEditingEvent ? handleSelectPointForEdit(p, i) : setPointInDetail({ point: p, cityName: resolvedCityName }))}><Text style={styles.previewTxt}>✅ {p.establishment}</Text><Text style={styles.previewMeta}>{getPointPreviewSummary(p)}</Text><Text style={styles.previewHint}>{isEditingEvent ? 'Toca para cargar este punto y editarlo' : 'Toca para ver el detalle del punto'}</Text></TouchableOpacity>)}
              {eventData.cities.map((c, i) => <TouchableOpacity key={i} style={[styles.previewRow, {backgroundColor: 'rgba(255,255,255,0.2)'}]} onPress={() => handleSelectCityForEdit(c, i)}><Text style={styles.previewTxt}>🌆 {c.name}</Text><Text style={styles.previewHint}>{editingCityIndex === i ? 'Ciudad en edición' : 'Toca para cargar la ciudad y sus puntos'}</Text></TouchableOpacity>)}</View>
            <View style={styles.footerButtons}><TouchableOpacity style={styles.footerBtn} onPress={() => setStep(1)}><Text style={styles.actionText}>ATRAS</Text></TouchableOpacity><TouchableOpacity style={styles.footerBtn} onPress={handleAddCity}><Text style={styles.actionText}>{cityActionText}</Text></TouchableOpacity></View>
            <TouchableOpacity style={styles.finalSaveBtn} onPress={handleFinalSave}><Text style={styles.finalSaveText}>{eventToEdit ? 'GUARDAR EVENTO' : 'CREAR EVENTO'}</Text></TouchableOpacity>
          </View>
        )}

        {step === 3 && (
          <View style={styles.form}>
            <Text style={styles.stepTitle}>Coordinar en {resolvedCityName}</Text>
            {apiLists.coordinators.map(coord => {
              const disabled = coord.isAvailable === false;
              return (
                <TouchableOpacity key={coord.id} disabled={disabled} style={[styles.coordCard, disabled && styles.disabledCard]} onPress={() => { if (disabled) return; setCurrentPoint({...currentPoint, coordinator: coord}); setStep(4); }}>
                  <Image source={{ uri: coord.photo }} style={[styles.coordPhoto, disabled && styles.disabledPhoto]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.coordName, disabled && styles.disabledText]}>{getCoordinatorDisplayName(coord)}</Text>
                    {disabled && <Text style={styles.disabledHint}>{coord.unavailableReason || 'No disponible en este horario'}</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.actionButton} onPress={() => setStep(2)}><Text style={styles.actionText}>REGRESAR</Text></TouchableOpacity>
          </View>
        )}

        {step === 4 && (
          <View style={styles.form}>
            <Text style={styles.stepTitle}>Apoyo - {getCoordinatorDisplayName(currentPoint.coordinator)}</Text>
            <View style={styles.categoryPanel}>
              <Text style={styles.sectionLabel}>1. Elige una categoría</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar categoría..."
                placeholderTextColor={palette.textMuted}
                value={categorySearchQuery}
                onChangeText={setCategorySearchQuery}
              />
              {!categories.length ? <Text style={styles.helperText}>No hay categorías disponibles para esta ciudad todavía.</Text> : null}
              {!!categories.length && !filteredCategories.length ? <Text style={styles.helperText}>No encontramos categorías con ese criterio.</Text> : null}
              <ScrollView style={styles.categoryResults} nestedScrollEnabled>
                {filteredCategories.map((cat) => (
                  <TouchableOpacity key={cat} style={[styles.categoryOption, selectedCategory === cat && styles.categoryOptionActive]} onPress={() => handleSelectCategory(cat)}>
                    <Text style={[styles.categoryOptionText, selectedCategory === cat && styles.categoryOptionTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            {selectedCategory ? (
              <View style={styles.selectedCategoryBar}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionLabel}>2. Staff disponible</Text>
                  <Text style={styles.selectedCategoryText}>{selectedCategory}</Text>
                  {currentPoint.assignedStaff.length ? <Text style={styles.helperText}>Seleccionado: {getAssignedStaffLabel(currentPoint)}</Text> : null}
                </View>
                <TouchableOpacity style={styles.categoryClearButton} onPress={handleClearCategorySelection}>
                  <Text style={styles.categoryClearButtonText}>CAMBIAR</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.helperText}>Selecciona una categoría para ver el staff asociado.</Text>
            )}
            <View style={styles.staffList}>
              {selectedCategory && apiLists.staff.map(item => {
                const exists = currentPoint.assignedStaff.find(p => p.id === item.id);
                const disabled = item.isAvailable === false && !exists;

                return (
                <View key={item.id} style={[styles.staffRow, exists && {backgroundColor: 'rgba(255,179,0,0.4)'}, disabled && styles.disabledCard]}>
                  <TouchableOpacity disabled={disabled} style={{flex: 1}} onPress={() => { if (disabled) return; setCurrentPoint({...currentPoint, assignedStaff: exists ? currentPoint.assignedStaff.filter(p => p.id !== item.id) : [...currentPoint.assignedStaff, item]}); }}>
                    <Text style={[styles.staffName, disabled && styles.disabledText]}>{getStaffDisplayName(item)}</Text>
                    {disabled && <Text style={styles.disabledHint}>{item.unavailableReason || 'No disponible en este horario'}</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.dotsButton} onPress={() => setStaffInDetail(item)}>
                    <Text style={styles.dotsText}>•••</Text>
                  </TouchableOpacity>
                </View>
              )})}
              {selectedCategory && !apiLists.staff.length ? <Text style={styles.helperText}>No hay staff disponible para esta categoría en el rango indicado.</Text> : null}
            </View>
            <TouchableOpacity style={[styles.actionButton, {marginTop: 20}]} onPress={() => { handleClearCategorySelection(); setStep(2); }}><Text style={styles.actionText}>TERMINAR</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, {backgroundColor: '#EEE'}]} onPress={() => setStep(3)}><Text style={styles.actionText}>ATRÁS</Text></TouchableOpacity>
          </View>
        )}

        {/* Modal Detalles Staff */}
        <Modal visible={!!pointInDetail} transparent animationType="slide">
          <View style={styles.overlayCenter}>
            <ScrollView style={styles.detailPopup} contentContainerStyle={styles.detailPopupContent} showsVerticalScrollIndicator={false}>
              {pointInDetail ? (
                <>
                  <Text style={styles.detailName}>{pointInDetail.point?.establishment || 'Punto sin nombre'}</Text>
                  <Text style={styles.detailCategory}>{pointInDetail.cityName || 'Sin ciudad'}</Text>
                  <View style={styles.detailInfoList}>
                    <View style={styles.detailInfoRow}><Text style={styles.infoLabel}>Establecimiento</Text><Text style={styles.infoVal}>{pointInDetail.point?.establishment || 'Sin dato'}</Text></View>
                    <View style={styles.detailInfoRow}><Text style={styles.infoLabel}>Dirección</Text><Text style={styles.infoVal}>{pointInDetail.point?.address || 'Sin dato'}</Text></View>
                    <View style={styles.detailInfoRow}><Text style={styles.infoLabel}>Contacto punto de venta</Text><Text style={styles.infoVal}>{pointInDetail.point?.contact || 'Sin dato'}</Text></View>
                    <View style={styles.detailInfoRow}><Text style={styles.infoLabel}>Teléfono contacto</Text><Text style={styles.infoVal}>{pointInDetail.point?.phone || 'Sin dato'}</Text></View>
                    <View style={styles.detailInfoRow}><Text style={styles.infoLabel}>Hora inicio</Text><Text style={styles.infoVal}>{formatPointTime(pointInDetail.point?.startTime)}</Text></View>
                    <View style={styles.detailInfoRow}><Text style={styles.infoLabel}>Hora fin</Text><Text style={styles.infoVal}>{formatPointTime(pointInDetail.point?.endTime)}</Text></View>
                    <View style={styles.detailInfoRow}><Text style={styles.infoLabel}>Coordinador</Text><Text style={styles.infoVal}>{pointInDetail.point?.coordinator?.name || pointInDetail.point?.coordinator?.fullName || 'Sin dato'}</Text></View>
                    <View style={styles.detailInfoRow}><Text style={styles.infoLabel}>Staff asignado</Text><Text style={styles.infoVal}>{getAssignedStaffLabel(pointInDetail.point)}</Text></View>
                  </View>
                  <TouchableOpacity style={styles.closeDetailBtn} onPress={() => setPointInDetail(null)}><Text style={styles.closeDetailText}>CERRAR</Text></TouchableOpacity>
                </>
              ) : null}
            </ScrollView>
          </View>
        </Modal>
        <Modal visible={!!staffInDetail} transparent animationType="slide">
          <View style={styles.overlayCenter}>
            <ScrollView style={styles.detailPopup} contentContainerStyle={styles.detailPopupContent} showsVerticalScrollIndicator={false}>
              {staffInDetail && (
                <>
                  <TouchableOpacity onPress={() => setExpandedStaffPhoto(staffInDetail.photo)}>
                    <Image source={{ uri: staffInDetail.photo }} style={styles.detailPhoto} />
                  </TouchableOpacity>
                  <Text style={styles.helperTextDark}>Toca la foto para verla más grande.</Text>
                  <Text style={styles.detailName}>{getStaffDisplayName(staffInDetail)}</Text>
                  <Text style={styles.detailCategory}>{staffInDetail.category || 'Sin categoría'}</Text>
                  <View style={styles.detailInfoList}>
                    <View style={styles.detailInfoRow}><Text style={styles.infoLabel}>Cédula</Text><Text style={styles.infoVal}>{staffInDetail.cedula || 'Sin dato'}</Text></View>
                    <View style={styles.detailInfoRow}><Text style={styles.infoLabel}>Ciudad</Text><Text style={styles.infoVal}>{staffInDetail.city || 'Sin dato'}</Text></View>
                    <View style={styles.detailInfoRow}><Text style={styles.infoLabel}>Categoría</Text><Text style={styles.infoVal}>{staffInDetail.category || 'Sin dato'}</Text></View>
                    <View style={styles.detailInfoRow}><Text style={styles.infoLabel}>Sexo</Text><Text style={styles.infoVal}>{staffInDetail.sexo || 'Sin dato'}</Text></View>
                    <View style={styles.detailInfoRow}><Text style={styles.infoLabel}>Talla Camisa</Text><Text style={styles.infoVal}>{staffInDetail.shirtSize || staffInDetail.clothingSize || 'Sin dato'}</Text></View>
                    <View style={styles.detailInfoRow}><Text style={styles.infoLabel}>Talla Pantalón</Text><Text style={styles.infoVal}>{staffInDetail.pantsSize || staffInDetail.clothingSize || 'Sin dato'}</Text></View>
                    <View style={styles.detailInfoRow}><Text style={styles.infoLabel}>Zapatos</Text><Text style={styles.infoVal}>{staffInDetail.shoeSize || 'Sin dato'}</Text></View>
                    {staffInDetail.sexo === 'mujer' ? (
                      <View style={styles.detailInfoRow}><Text style={styles.infoLabel}>Medidas</Text><Text style={styles.infoVal}>{`Busto ${staffInDetail.busto || 'N/D'} · Cintura ${staffInDetail.cintura || 'N/D'} · Cadera ${staffInDetail.cadera || 'N/D'}`}</Text></View>
                    ) : (
                      <View style={styles.detailInfoRow}><Text style={styles.infoLabel}>Medidas</Text><Text style={styles.infoVal}>{staffInDetail.sexo === 'hombre' ? 'No aplica' : (staffInDetail.measurements || 'Sin dato')}</Text></View>
                    )}
                  </View>
                  <TouchableOpacity style={styles.closeDetailBtn} onPress={() => setStaffInDetail(null)}><Text style={styles.closeDetailText}>CERRAR</Text></TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </Modal>
        <Modal visible={!!expandedStaffPhoto} transparent animationType="fade">
          <View style={styles.overlayCenter}>
            <TouchableOpacity style={styles.photoPreviewOverlay} activeOpacity={1} onPress={() => setExpandedStaffPhoto(null)}>
              {expandedStaffPhoto ? <Image source={{ uri: expandedStaffPhoto }} style={styles.expandedPhoto} resizeMode="contain" /> : null}
              <Text style={styles.photoPreviewHint}>Toca para cerrar</Text>
            </TouchableOpacity>
          </View>
        </Modal>

        {/* Modal Ciudades */}
        <Modal visible={showCitySearch} transparent animationType="fade"><View style={styles.modalScrollOverlay}><View style={styles.modalPanel}><Text style={styles.modalTitle}>Filtrar ciudad</Text><TextInput style={styles.searchInput} placeholder="Buscar..." value={searchQuery} onChangeText={setSearchQuery} /><ScrollView style={styles.modalResults}>
          {apiLists.cities.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).map(i => (<TouchableOpacity key={i.id} style={styles.cityItem} onPress={() => { setEditingPointIndex(null); setCurrentPoint(createEmptyPoint()); handleClearCategorySelection(); if (isOtherCityOption(i)) { setIsNewCity(true); setCurrentCityName(''); setManualCityName(''); } else { setIsNewCity(false); setCurrentCityName(i.name); setManualCityName(''); } setShowCitySearch(false); setSearchQuery(''); }}><Text style={styles.cityItemText}>{i.name}</Text></TouchableOpacity>))}
        </ScrollView><TouchableOpacity style={styles.closeBtn} onPress={() => setShowCitySearch(false)}><Text style={styles.closeBtnText}>CERRAR</Text></TouchableOpacity></View></View></Modal>
        <Modal visible={showClientSearch} transparent animationType="fade"><View style={styles.modalScrollOverlay}><View style={styles.modalPanel}><Text style={styles.modalTitle}>Seleccionar cliente</Text><TextInput style={styles.searchInput} placeholder="Buscar por NIT o nombre..." value={clientSearchQuery} onChangeText={setClientSearchQuery} /><Text style={styles.modalHelperText}>La búsqueda consulta la base de datos.</Text><ScrollView style={styles.modalResults}>
          {clientSearchLoading ? <ActivityIndicator style={styles.modalLoader} size="small" color={palette.primaryButton} /> : null}
          {clientSearchResults.map((client) => (<TouchableOpacity key={client.clientId || client.id} style={styles.cityItem} onPress={() => { setEventData((prev) => ({ ...prev, client: getClientLabel(client), clientId: client.clientId || null, clientUserId: client.userId || client.id })); setShowClientSearch(false); setClientSearchQuery(''); }}><Text style={styles.cityItemText}>{getClientLabel(client)}</Text><Text style={styles.clientItemMeta}>{client.nit ? `NIT ${client.nit} · ` : ''}{getClientDescription(client)}</Text></TouchableOpacity>))}
          {!clientSearchLoading && clientSearchResults.length === 0 ? <Text style={styles.emptyModalText}>No encontramos clientes con ese NIT o nombre.</Text> : null}
        </ScrollView><TouchableOpacity style={styles.closeBtn} onPress={() => { setShowClientSearch(false); setClientSearchQuery(''); }}><Text style={styles.closeBtnText}>CERRAR</Text></TouchableOpacity></View></View></Modal>
        {showPicker && <DateTimePicker value={(showPicker === 'start_time' ? currentPoint.startTime : showPicker === 'end_time' ? currentPoint.endTime : showPicker === 'start_date' ? eventData.startDate : eventData.endDate) || new Date()} mode={showPicker.includes('date') ? 'date' : 'time'} is24Hour={false} display="default" onChange={onPickerChange} minimumDate={showPicker === 'start_date' ? minimumEventDate : showPicker === 'end_date' ? minimumEndDate : undefined} />}
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (palette, metrics, tokens) => StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.pageBg },
  loading: { flex: 1, backgroundColor: palette.pageBg, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: tokens.layout.screenPadding, paddingBottom: metrics.spacing(60) },
  title: { fontSize: metrics.heroTitleSize, fontWeight: 'bold', color: palette.onHero, textAlign: 'center', marginBottom: tokens.spacing.lg },
  form: { gap: tokens.spacing.xs },
  imageCard: { backgroundColor: palette.panel, borderRadius: tokens.radii.sm, padding: tokens.spacing.md, marginBottom: tokens.spacing.xs },
  imageSelector: { alignSelf: 'center', marginBottom: metrics.spacing(15), width: '100%', maxWidth: Math.min(metrics.contentMaxWidth, metrics.size(320, 0.95)) },
  selectedImage: { width: '100%', maxWidth: Math.min(metrics.contentMaxWidth, metrics.size(320, 0.95)), height: metrics.size(160), borderRadius: tokens.radii.sm, borderWidth: 2, borderColor: palette.onHero },
  photoPlaceholder: { width: '100%', maxWidth: Math.min(metrics.contentMaxWidth, metrics.size(320, 0.95)), height: metrics.size(160), backgroundColor: palette.panelStrong, justifyContent: 'center', alignItems: 'center', borderRadius: tokens.radii.sm, borderStyle: 'dashed', borderWidth: 2, borderColor: palette.onHero },
  photoText: { fontSize: metrics.font(11, 0.75), fontWeight: 'bold', color: palette.onHero },
  imageActionsCard: { backgroundColor: palette.panelStrong, borderRadius: tokens.radii.sm, padding: tokens.spacing.sm + metrics.spacing(2), gap: tokens.spacing.xs },
  imageActionsInline: { gap: tokens.spacing.xs },
  imageActionsTitle: { color: palette.onHero, fontSize: tokens.typography.label, fontWeight: 'bold' },
  imageRemoveLink: { alignSelf: 'flex-start', paddingVertical: 4 },
  imageRemoveText: { color: palette.onHero, fontSize: tokens.typography.caption, fontWeight: 'bold', textDecorationLine: 'underline' },
  inputContainer: { marginBottom: metrics.spacing(10) },
  label: { color: palette.onHero, fontSize: tokens.typography.label, marginBottom: 2, fontWeight: 'bold' },
  input: { color: palette.onHero, fontSize: tokens.typography.bodyLg, paddingVertical: metrics.spacing(5, 0.75) },
  helperText: { color: palette.onHero, fontSize: tokens.typography.caption, marginTop: -4, marginBottom: tokens.spacing.xs, opacity: 0.8 },
  divider: { height: 1, backgroundColor: palette.onHero, marginBottom: tokens.spacing.xs, opacity: 0.5 },
  pointFrame: { backgroundColor: palette.panel, padding: metrics.spacing(15), borderRadius: tokens.radii.sm, marginVertical: tokens.spacing.xs, borderLeftWidth: 4, borderLeftColor: palette.primaryButton },
  pointTitle: { color: palette.primaryButton, fontSize: metrics.font(15, 0.85), fontWeight: 'bold', marginBottom: metrics.spacing(10) },
  assignButton: { backgroundColor: palette.panelStrong, paddingVertical: tokens.spacing.sm + metrics.spacing(2), borderRadius: tokens.radii.sm, marginVertical: metrics.spacing(10), alignItems: 'center', borderWidth: 1, borderColor: palette.onHero },
  assignText: { fontSize: tokens.typography.label, color: palette.onHero, fontWeight: 'bold' },
  addPointBtn: { backgroundColor: palette.primaryButton, paddingVertical: tokens.spacing.sm + metrics.spacing(2), borderRadius: tokens.radii.pill, alignItems: 'center' },
  addPointText: { color: palette.primaryButtonText, fontWeight: 'bold', fontSize: tokens.typography.body },
  listPreview: { marginVertical: metrics.spacing(15), gap: metrics.spacing(6, 0.8) },
  previewRow: { backgroundColor: palette.panelStrong, padding: tokens.spacing.sm + metrics.spacing(2), borderRadius: metrics.radius(8, 0.6) },
  previewTxt: { color: palette.onHero, fontSize: tokens.typography.body },
  previewMeta: { color: palette.onHero, opacity: 0.9, fontSize: metrics.font(11, 0.75), marginTop: metrics.spacing(4, 0.75) },
  previewHint: { color: palette.onHero, opacity: 0.7, fontSize: metrics.font(11, 0.75), marginTop: metrics.spacing(4, 0.75) },
  footerButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm, marginTop: metrics.spacing(15) },
  footerBtn: { backgroundColor: palette.secondaryButton, paddingVertical: tokens.spacing.sm + metrics.spacing(2), borderRadius: tokens.radii.pill, alignItems: 'center', flexGrow: 1, flexBasis: metrics.compactWidth ? '100%' : 0 },
  actionButton: { backgroundColor: palette.secondaryButton, paddingVertical: tokens.spacing.md, borderRadius: tokens.radii.pill, alignItems: 'center', marginTop: metrics.spacing(10) },
  secondaryActionButton: { borderWidth: 1, borderColor: palette.onHero, paddingVertical: metrics.spacing(10), borderRadius: tokens.radii.pill, alignItems: 'center', marginTop: metrics.spacing(4, 0.75) },
  actionText: { fontSize: tokens.typography.body, fontWeight: 'bold', color: palette.secondaryButtonText },
  secondaryActionText: { fontSize: tokens.typography.caption, fontWeight: 'bold', color: palette.onHero },
  finalSaveBtn: { backgroundColor: palette.heroSoft, paddingVertical: metrics.spacing(18), borderRadius: tokens.radii.sm, alignItems: 'center', marginTop: metrics.spacing(30) },
  finalSaveText: { color: palette.onHero, fontWeight: 'bold', fontSize: metrics.font(18, 0.9) },
  modalScrollOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: metrics.screenPadding },
  modalPanel: { backgroundColor: palette.surface, borderRadius: tokens.radii.lg, padding: tokens.spacing.lg, maxHeight: '88%', width: '100%', maxWidth: metrics.modalMaxWidth, alignSelf: 'center' },
  modalTitle: { fontSize: metrics.font(18, 0.9), fontWeight: 'bold', marginBottom: metrics.spacing(15), textAlign: 'center', color: palette.text },
  modalHelperText: { color: palette.textMuted, textAlign: 'center', marginBottom: metrics.spacing(10), fontSize: tokens.typography.caption },
  modalLoader: { marginVertical: 12 },
  modalResults: { maxHeight: Math.max(metrics.size(220, 0.95), Math.min(metrics.size(400, 0.95), Math.round(metrics.height * 0.45))) },
  searchInput: { backgroundColor: palette.surfaceMuted, padding: tokens.spacing.sm + metrics.spacing(2), borderRadius: tokens.radii.sm, marginBottom: metrics.spacing(15), fontSize: tokens.typography.bodyLg, color: palette.text },
  cityItem: { paddingVertical: metrics.spacing(15), borderBottomWidth: 1, borderBottomColor: '#EEE' },
  cityItemText: { fontSize: tokens.typography.bodyLg, color: palette.text },
  clientItemMeta: { fontSize: tokens.typography.caption, color: '#666', marginTop: metrics.spacing(4, 0.75) },
  emptyModalText: { color: palette.textMuted, textAlign: 'center', paddingVertical: 24 },
  closeBtn: { backgroundColor: palette.secondaryButton, paddingVertical: tokens.spacing.sm + metrics.spacing(2), borderRadius: tokens.radii.sm, alignItems: 'center', marginTop: metrics.spacing(15) },
  closeBtnText: { fontWeight: 'bold', color: palette.secondaryButtonText },
  coordCard: { backgroundColor: palette.surface, padding: metrics.spacing(15), borderRadius: tokens.radii.sm, marginBottom: tokens.spacing.sm, flexDirection: 'row', alignItems: 'center', gap: metrics.spacing(15) },
  coordPhoto: { width: metrics.size(60), height: metrics.size(60), borderRadius: metrics.radius(30) },
  coordName: { fontSize: tokens.typography.bodyLg, fontWeight: 'bold', color: palette.text },
  disabledCard: { backgroundColor: '#C8C8C8', opacity: 0.7 },
  disabledPhoto: { opacity: 0.55 },
  disabledText: { color: '#666' },
  disabledHint: { color: '#666', fontSize: tokens.typography.caption, marginTop: metrics.spacing(4, 0.75) },
  stepTitle: { fontSize: metrics.font(22, 0.95), fontWeight: 'bold', color: palette.onHero, textAlign: 'center', marginBottom: tokens.spacing.lg },
  categoryPanel: { backgroundColor: palette.panel, borderRadius: tokens.radii.sm, padding: tokens.spacing.md, gap: tokens.spacing.sm, marginBottom: tokens.spacing.md },
  sectionLabel: { color: palette.onHero, fontSize: tokens.typography.label, fontWeight: 'bold' },
  categoryResults: { maxHeight: metrics.size(220) },
  categoryOption: { backgroundColor: palette.panelStrong, borderRadius: tokens.radii.sm, paddingVertical: tokens.spacing.sm + metrics.spacing(2), paddingHorizontal: tokens.spacing.md, marginBottom: tokens.spacing.xs },
  categoryOptionActive: { backgroundColor: '#FFB300' },
  categoryOptionText: { color: palette.onHero, fontSize: tokens.typography.label, fontWeight: 'bold' },
  categoryOptionTextActive: { color: '#222' },
  selectedCategoryBar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spacing.sm, marginBottom: tokens.spacing.sm },
  selectedCategoryText: { color: palette.onHero, fontSize: metrics.font(18, 0.9), fontWeight: 'bold' },
  categoryClearButton: { backgroundColor: palette.panelStrong, borderRadius: metrics.radius(20), paddingVertical: metrics.spacing(10), paddingHorizontal: tokens.spacing.md, width: metrics.compactWidth ? '100%' : undefined },
  categoryClearButtonText: { color: palette.onHero, fontSize: metrics.font(11, 0.75), fontWeight: 'bold' },
  staffList: { gap: tokens.spacing.sm },
  staffRow: { backgroundColor: palette.panelStrong, padding: metrics.spacing(15), borderRadius: tokens.radii.sm, flexDirection: 'row', alignItems: 'center' },
  staffName: { color: palette.onHero, fontWeight: 'bold', fontSize: metrics.font(15, 0.85) },
  dotsButton: { padding: metrics.spacing(10), backgroundColor: palette.panel, borderRadius: metrics.radius(20) },
  dotsText: { color: palette.onHero, fontWeight: 'bold', fontSize: tokens.typography.bodyLg },
  overlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  detailPopup: { backgroundColor: palette.surface, width: '100%', maxWidth: metrics.modalMaxWidth, maxHeight: '88%', borderRadius: tokens.radii.lg, padding: tokens.spacing.lg },
  detailPopupContent: { alignItems: 'center', paddingBottom: metrics.spacing(28), flexGrow: 1 },
  detailPhoto: { width: metrics.size(120), height: metrics.size(120), borderRadius: metrics.radius(60), marginBottom: metrics.spacing(15), borderWidth: 3, borderColor: palette.heroSoft },
  helperTextDark: { color: palette.textMuted, fontSize: tokens.typography.caption, marginTop: -4, marginBottom: tokens.spacing.sm },
  detailName: { fontSize: metrics.font(22, 0.95), fontWeight: 'bold', color: palette.text },
  detailCategory: { fontSize: tokens.typography.body, color: '#666', marginBottom: tokens.spacing.lg, letterSpacing: 2 },
  detailInfoList: { width: '100%', gap: tokens.spacing.sm, marginBottom: metrics.spacing(25) },
  detailInfoRow: { backgroundColor: palette.surfaceMuted, borderRadius: tokens.radii.sm, paddingHorizontal: tokens.spacing.md, paddingVertical: tokens.spacing.sm + metrics.spacing(2) },
  infoLabel: { fontSize: metrics.font(10, 0.7), color: '#999', textTransform: 'uppercase' },
  infoVal: { fontSize: tokens.typography.bodyLg, fontWeight: 'bold', color: palette.text, marginTop: metrics.spacing(4, 0.75) },
  closeDetailBtn: { backgroundColor: palette.heroSoft, width: '100%', paddingVertical: metrics.spacing(15), borderRadius: metrics.radius(15), alignItems: 'center' },
  closeDetailText: { color: palette.onHero, fontWeight: 'bold' },
  photoPreviewOverlay: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', padding: metrics.screenPadding },
  expandedPhoto: { width: '100%', height: '80%' },
  photoPreviewHint: { color: '#FFF', marginTop: 16, fontWeight: 'bold' },
});

export default CreateEventScreen;
