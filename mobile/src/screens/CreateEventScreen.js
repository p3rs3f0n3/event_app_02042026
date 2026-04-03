import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView, Alert, Platform, Image, ActivityIndicator, Modal } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { createEvent, updateEvent, getClients, getCoordinators, getStaff, getColombiaCities, addColombiaCity } from '../api/api';
import { getAppPalette, RADII, SPACING } from '../theme/tokens';

const isOtherCityOption = (city) => Boolean(city?.isOther || String(city?.name || '').trim().toUpperCase() === 'OTRO');
const normalizeCityName = (value) => String(value || '').trim().toLowerCase();
const normalizeComparableValue = (value) => String(value || '').trim().toLowerCase();

const getClientDescription = (client) => [client?.username ? `@${client.username}` : null, client?.email || null].filter(Boolean).join(' · ');

const findMatchingClient = (clients, eventLike) => {
  const explicitClientId = Number(eventLike?.clientUserId);
  if (Number.isInteger(explicitClientId) && explicitClientId > 0) {
    return clients.find((client) => Number(client.id) === explicitClientId) || null;
  }

  const comparableClient = normalizeComparableValue(eventLike?.client);
  if (!comparableClient) {
    return null;
  }

  const matches = clients.filter((client) => [client.fullName, client.username, client.email].some((value) => normalizeComparableValue(value) === comparableClient));
  return matches.length === 1 ? matches[0] : null;
};

const createEmptyPoint = () => ({ establishment: '', address: '', contact: '', phone: '', startTime: null, endTime: null, coordinator: null, assignedStaff: [] });

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

const InputField = ({ styles, label, value, onChangeText, placeholder, editable = true, onPress }) => (
  <View style={styles.inputContainer}>
    <Text style={styles.label}>{label}</Text>
    {onPress ? (
      <TouchableOpacity onPress={onPress}>
        <Text style={[styles.input, !value && { color: 'rgba(255,255,255,0.5)' }]}>{value || placeholder}</Text>
      </TouchableOpacity>
    ) : (
      <TextInput style={styles.input} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="rgba(255,255,255,0.5)" editable={editable} />
    )}
    <View style={styles.divider} />
  </View>
);

const CreateEventScreen = ({ onBack, user, eventToEdit = null }) => {
  const palette = getAppPalette('green');
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [step, setStep] = useState(1);
  const [showPicker, setShowPicker] = useState(null);
  const [apiLists, setApiLists] = useState({ coordinators: [], staff: [], cities: [], clients: [] });
  const [loading, setLoading] = useState(true);
  const [eventData, setEventData] = useState({
    name: eventToEdit?.name || '', client: eventToEdit?.client || '', clientUserId: eventToEdit?.clientUserId || null,
    startDate: eventToEdit?.startDate ? new Date(eventToEdit.startDate) : null,
    endDate: eventToEdit?.endDate ? new Date(eventToEdit.endDate) : null,
    image: eventToEdit?.image || null, cities: eventToEdit?.cities || []
  });

  const [currentCityName, setCurrentCityName] = useState('');
  const [cityPoints, setCityPoints] = useState([]);
  const [editingCityIndex, setEditingCityIndex] = useState(null);
  const [isNewCity, setIsNewCity] = useState(false);
  const [manualCityName, setManualCityName] = useState('');
  const [showCitySearch, setShowCitySearch] = useState(false);
  const [showClientSearch, setShowClientSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [staffInDetail, setStaffInDetail] = useState(null);
  const categories = ['BARISTAS', 'IMPULSADORES', 'LOGISTICOS'];

  const [currentPoint, setCurrentPoint] = useState(createEmptyPoint());
  const selectedClient = useMemo(
    () => apiLists.clients.find((client) => Number(client.id) === Number(eventData.clientUserId)) || null,
    [apiLists.clients, eventData.clientUserId],
  );

  const resolvedCityName = (isNewCity ? manualCityName : currentCityName).trim();

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

    for (const city of buildDraftCities()) {
      if (normalizeCityName(city?.name) !== normalizeCityName(resolvedCityName)) {
        continue;
      }

      for (const point of Array.isArray(city?.points) ? city.points : []) {
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
    const fetchInitial = async () => {
      try {
        const [cities, clients] = await Promise.all([getColombiaCities(), getClients()]);
        setApiLists(prev => ({ ...prev, cities, clients }));
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

    if (Number(eventData.clientUserId) === Number(matchedClient.id) && eventData.client === matchedClient.fullName) {
      return;
    }

    setEventData((prev) => ({
      ...prev,
      client: matchedClient.fullName,
      clientUserId: matchedClient.id,
    }));
  }, [apiLists.clients, eventData]);

  useEffect(() => {
    if (eventToEdit?.isInactive) {
      Alert.alert('Evento inactivo', 'Este evento ya no admite edición', [{ text: 'OK', onPress: onBack }]);
    }
  }, [eventToEdit?.id, eventToEdit?.isInactive, onBack]);

  const validateEventMetadata = () => {
    if (!eventData.name || !eventData.client || !eventData.clientUserId || !eventData.startDate || !eventData.endDate || !eventData.image) {
      Alert.alert('Incompleto', 'Llene todos los campos técnicos y cargue foto'); return false;
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
    if (new Date(currentPoint.endTime).getTime() <= new Date(currentPoint.startTime).getTime()) {
      return Alert.alert('Error', 'Hora fin debe ser posterior a inicio');
    }
    setCityPoints([...cityPoints, currentPoint]);
    setCurrentPoint(createEmptyPoint());
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
      setCurrentCityName(''); setCityPoints([]); setEditingCityIndex(null); setIsNewCity(false); setManualCityName(''); setCurrentPoint(createEmptyPoint()); setSelectedCategory(null);
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
    if (type.includes('date')) setEventData({ ...eventData, [type === 'start_date' ? 'startDate' : 'endDate']: selectedDate });
    else setCurrentPoint({ ...currentPoint, [type === 'start_time' ? 'startTime' : 'endTime']: selectedDate, coordinator: null, assignedStaff: [] });
  };

  if (loading && step === 1) return <View style={styles.loading}><ActivityIndicator size="large" color="#FFF" /></View>;

  return (
    <SafeAreaView style={styles.container}> 
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>EVENTAPP</Text>
        
        {step === 1 && (
          <View style={styles.form}>
            <TouchableOpacity style={styles.imageSelector} onPress={async () => {
              let res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [16, 9], quality: 1 });
              if (!res.canceled) setEventData({ ...eventData, image: res.assets[0].uri });
            }}>{eventData.image ? <Image source={{ uri: eventData.image }} style={styles.selectedImage} /> : <View style={styles.photoPlaceholder}><Text style={styles.photoText}>FOTO EVENTO *</Text></View>}</TouchableOpacity>
            <InputField styles={styles} label="Evento *" value={eventData.name} onChangeText={(t) => setEventData({...eventData, name: t})} />
             <InputField styles={styles} label="Cliente *" value={selectedClient?.fullName || eventData.client} placeholder="Seleccionar cliente..." editable={false} onPress={() => setShowClientSearch(true)} />
             {selectedClient ? <Text style={styles.helperText}>{getClientDescription(selectedClient)}</Text> : null}
            <TouchableOpacity onPress={() => setShowPicker('start_date')}><InputField styles={styles} label="Inicio *" value={eventData.startDate?.toLocaleDateString() || 'Calendario...'} editable={false} /></TouchableOpacity>
            <TouchableOpacity onPress={() => setShowPicker('end_date')}><InputField styles={styles} label="Fin *" value={eventData.endDate?.toLocaleDateString() || 'Calendario...'} editable={false} /></TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => { if (validateEventMetadata()) setStep(2); }}><Text style={styles.actionText}>SIGUIENTE</Text></TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={onBack}><Text style={styles.actionText}>REGRESAR</Text></TouchableOpacity>
          </View>
        )}

        {step === 2 && (
          <View style={styles.form}>
            <InputField styles={styles} label="Ciudad *" value={resolvedCityName} placeholder={isNewCity ? 'Escriba la ciudad...' : 'Buscar...'} onChangeText={isNewCity ? setManualCityName : undefined} onPress={isNewCity ? undefined : () => setShowCitySearch(true)} />
            <TouchableOpacity style={styles.secondaryActionButton} onPress={() => setShowCitySearch(true)}>
              <Text style={styles.secondaryActionText}>{isNewCity ? 'CAMBIAR / BUSCAR CIUDAD' : 'BUSCAR CIUDAD'}</Text>
            </TouchableOpacity>
             <View style={styles.pointFrame}>
               <Text style={styles.pointTitle}>DATOS DEL PUNTO</Text>
               <InputField styles={styles} label="Nombre establecimiento *" value={currentPoint.establishment} onChangeText={(t) => setCurrentPoint({...currentPoint, establishment: t})} />
               <InputField styles={styles} label="Dirección *" value={currentPoint.address} onChangeText={(t) => setCurrentPoint({...currentPoint, address: t})} />
               <InputField styles={styles} label="Contacto *" value={currentPoint.contact} onChangeText={(t) => setCurrentPoint({...currentPoint, contact: t})} />
               <InputField styles={styles} label="Teléfono *" value={currentPoint.phone} onChangeText={(t) => setCurrentPoint({...currentPoint, phone: t})} />
               <TouchableOpacity onPress={() => setShowPicker('start_time')}><InputField styles={styles} label="Hora Inicio *" value={currentPoint.startTime?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || 'Tocar...'} editable={false} /></TouchableOpacity>
               <TouchableOpacity onPress={() => setShowPicker('end_time')}><InputField styles={styles} label="Hora Fin *" value={currentPoint.endTime?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || 'Tocar...'} editable={false} /></TouchableOpacity>
                <TouchableOpacity style={styles.assignButton} onPress={fetchCoordinatorsForCity}><Text style={styles.assignText}>{currentPoint.coordinator?.name ? `Coord: ${currentPoint.coordinator.name}` : 'ASIGNAR COORDINADOR *'}</Text></TouchableOpacity>
              <TouchableOpacity style={styles.addPointBtn} onPress={handleAddPoint}><Text style={styles.addPointText}>AÑADIR PUNTO</Text></TouchableOpacity>
            </View>
            <View style={styles.listPreview}>{cityPoints.map((p, i) => <View key={i} style={styles.previewRow}><Text style={styles.previewTxt}>✅ {p.establishment}</Text></View>)}
              {eventData.cities.map((c, i) => <TouchableOpacity key={i} style={[styles.previewRow, {backgroundColor: 'rgba(255,255,255,0.2)'}]} onPress={() => { setIsNewCity(false); setManualCityName(''); setCurrentCityName(c.name); setCityPoints(c.points); setEditingCityIndex(i); setCurrentPoint(createEmptyPoint()); setSelectedCategory(null); }}><Text style={styles.previewTxt}>🌆 {c.name}</Text></TouchableOpacity>)}</View>
            <View style={styles.footerButtons}><TouchableOpacity style={styles.footerBtn} onPress={() => setStep(1)}><Text style={styles.actionText}>ATRAS</Text></TouchableOpacity><TouchableOpacity style={styles.footerBtn} onPress={handleAddCity}><Text style={styles.actionText}>AGR CIUDAD</Text></TouchableOpacity></View>
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
                    <Text style={[styles.coordName, disabled && styles.disabledText]}>{coord.name}</Text>
                    {disabled && <Text style={styles.disabledHint}>{coord.unavailableReason || 'No disponible en este horario'}</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.actionButton} onPress={() => setStep(2)}><Text style={styles.actionText}>REINTENTAR</Text></TouchableOpacity>
          </View>
        )}

        {step === 4 && (
          <View style={styles.form}>
            <Text style={styles.stepTitle}>Apoyo - {currentPoint.coordinator?.name}</Text>
            <View style={styles.catWrap}>{categories.map(cat => (<TouchableOpacity key={cat} style={[styles.catItem, selectedCategory === cat && {backgroundColor: '#FFB300'}]} onPress={() => fetchStaffByCategory(cat)}><Text style={styles.catTxt}>{cat}</Text></TouchableOpacity>))}</View>
            <View style={styles.staffList}>
              {selectedCategory && apiLists.staff.map(item => {
                const exists = currentPoint.assignedStaff.find(p => p.id === item.id);
                const disabled = item.isAvailable === false && !exists;

                return (
                <View key={item.id} style={[styles.staffRow, exists && {backgroundColor: 'rgba(255,179,0,0.4)'}, disabled && styles.disabledCard]}>
                  <TouchableOpacity disabled={disabled} style={{flex: 1}} onPress={() => { if (disabled) return; setCurrentPoint({...currentPoint, assignedStaff: exists ? currentPoint.assignedStaff.filter(p => p.id !== item.id) : [...currentPoint.assignedStaff, item]}); }}>
                    <Text style={[styles.staffName, disabled && styles.disabledText]}>{item.name}</Text>
                    {disabled && <Text style={styles.disabledHint}>{item.unavailableReason || 'No disponible en este horario'}</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.dotsButton} onPress={() => setStaffInDetail(item)}>
                    <Text style={styles.dotsText}>•••</Text>
                  </TouchableOpacity>
                </View>
              )})}
            </View>
            <TouchableOpacity style={[styles.actionButton, {marginTop: 20}]} onPress={() => { setSelectedCategory(null); setStep(2); }}><Text style={styles.actionText}>TERMINAR</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, {backgroundColor: '#EEE'}]} onPress={() => setStep(3)}><Text style={styles.actionText}>ATRÁS</Text></TouchableOpacity>
          </View>
        )}

        {/* Modal Detalles Staff */}
        <Modal visible={!!staffInDetail} transparent animationType="slide">
          <View style={styles.overlayCenter}>
            <View style={styles.detailPopup}>
              {staffInDetail && (
                <>
                  <Image source={{ uri: staffInDetail.photo }} style={styles.detailPhoto} />
                  <Text style={styles.detailName}>{staffInDetail.name}</Text>
                  <Text style={styles.detailCategory}>{staffInDetail.category}</Text>
                  <View style={styles.gridInfo}>
                    <View style={styles.infoBox}><Text style={styles.infoLabel}>Talla Ropa</Text><Text style={styles.infoVal}>{staffInDetail.clothingSize}</Text></View>
                    <View style={styles.infoBox}><Text style={styles.infoLabel}>Zapatos</Text><Text style={styles.infoVal}>{staffInDetail.shoeSize}</Text></View>
                    <View style={styles.infoBox}><Text style={styles.infoLabel}>Medidas</Text><Text style={styles.infoVal}>{staffInDetail.measurements}</Text></View>
                  </View>
                  <TouchableOpacity style={styles.closeDetailBtn} onPress={() => setStaffInDetail(null)}><Text style={styles.closeDetailText}>CERRAR</Text></TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* Modal Ciudades */}
        <Modal visible={showCitySearch} transparent animationType="fade"><View style={styles.modalScrollOverlay}><View style={styles.modalPanel}><Text style={styles.modalTitle}>Filtrar ciudad</Text><TextInput style={styles.searchInput} placeholder="Buscar..." value={searchQuery} onChangeText={setSearchQuery} /><ScrollView style={{maxHeight: 400}}>
          {apiLists.cities.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).map(i => (<TouchableOpacity key={i.id} style={styles.cityItem} onPress={() => { setCurrentPoint((prev) => ({ ...prev, coordinator: null, assignedStaff: [] })); if (isOtherCityOption(i)) { setIsNewCity(true); setCurrentCityName(''); setManualCityName(''); } else { setIsNewCity(false); setCurrentCityName(i.name); setManualCityName(''); } setShowCitySearch(false); setSearchQuery(''); }}><Text style={styles.cityItemText}>{i.name}</Text></TouchableOpacity>))}
        </ScrollView><TouchableOpacity style={styles.closeBtn} onPress={() => setShowCitySearch(false)}><Text style={styles.closeBtnText}>CERRAR</Text></TouchableOpacity></View></View></Modal>
        <Modal visible={showClientSearch} transparent animationType="fade"><View style={styles.modalScrollOverlay}><View style={styles.modalPanel}><Text style={styles.modalTitle}>Seleccionar cliente</Text><TextInput style={styles.searchInput} placeholder="Buscar cliente..." value={clientSearchQuery} onChangeText={setClientSearchQuery} /><ScrollView style={{maxHeight: 400}}>
          {apiLists.clients.filter((client) => [client.fullName, client.username, client.email].some((value) => normalizeComparableValue(value).includes(normalizeComparableValue(clientSearchQuery)))).map((client) => (<TouchableOpacity key={client.id} style={styles.cityItem} onPress={() => { setEventData((prev) => ({ ...prev, client: client.fullName, clientUserId: client.id })); setShowClientSearch(false); setClientSearchQuery(''); }}><Text style={styles.cityItemText}>{client.fullName}</Text><Text style={styles.clientItemMeta}>{getClientDescription(client)}</Text></TouchableOpacity>))}
          {apiLists.clients.length === 0 ? <Text style={styles.emptyModalText}>No hay clientes disponibles.</Text> : null}
        </ScrollView><TouchableOpacity style={styles.closeBtn} onPress={() => { setShowClientSearch(false); setClientSearchQuery(''); }}><Text style={styles.closeBtnText}>CERRAR</Text></TouchableOpacity></View></View></Modal>
        {showPicker && <DateTimePicker value={(showPicker === 'start_time' ? currentPoint.startTime : showPicker === 'end_time' ? currentPoint.endTime : showPicker === 'start_date' ? eventData.startDate : eventData.endDate) || new Date()} mode={showPicker.includes('date') ? 'date' : 'time'} is24Hour={false} display="default" onChange={onPickerChange} />}
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.pageBg },
  loading: { flex: 1, backgroundColor: palette.pageBg, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: SPACING.xl, paddingBottom: 60 },
  title: { fontSize: 32, fontWeight: 'bold', color: palette.onHero, textAlign: 'center', marginBottom: 20 },
  form: { gap: 8 },
  imageSelector: { alignSelf: 'center', marginBottom: 15 },
  selectedImage: { width: 300, height: 160, borderRadius: RADII.sm, borderWidth: 2, borderColor: palette.onHero },
  photoPlaceholder: { width: 300, height: 160, backgroundColor: palette.panelStrong, justifyContent: 'center', alignItems: 'center', borderRadius: RADII.sm, borderStyle: 'dashed', borderWidth: 2, borderColor: palette.onHero },
  photoText: { fontSize: 11, fontWeight: 'bold', color: palette.onHero },
  inputContainer: { marginBottom: 10 },
  label: { color: palette.onHero, fontSize: 13, marginBottom: 2, fontWeight: 'bold' },
  input: { color: palette.onHero, fontSize: 16, paddingVertical: 5 },
  helperText: { color: palette.onHero, fontSize: 12, marginTop: -4, marginBottom: 8, opacity: 0.8 },
  divider: { height: 1, backgroundColor: palette.onHero, marginBottom: 8, opacity: 0.5 },
  pointFrame: { backgroundColor: palette.panel, padding: 15, borderRadius: RADII.sm, marginVertical: 8, borderLeftWidth: 4, borderLeftColor: palette.primaryButton },
  pointTitle: { color: palette.primaryButton, fontSize: 15, fontWeight: 'bold', marginBottom: 10 },
  assignButton: { backgroundColor: palette.panelStrong, paddingVertical: 12, borderRadius: RADII.sm, marginVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: palette.onHero },
  assignText: { fontSize: 13, color: palette.onHero, fontWeight: 'bold' },
  addPointBtn: { backgroundColor: palette.primaryButton, paddingVertical: 12, borderRadius: 25, alignItems: 'center' },
  addPointText: { color: palette.primaryButtonText, fontWeight: 'bold', fontSize: 14 },
  listPreview: { marginVertical: 15, gap: 6 },
  previewRow: { backgroundColor: palette.panelStrong, padding: 12, borderRadius: 8 },
  previewTxt: { color: palette.onHero },
  footerButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
  footerBtn: { backgroundColor: palette.secondaryButton, paddingVertical: 12, borderRadius: 30, width: '48%', alignItems: 'center' },
  actionButton: { backgroundColor: palette.secondaryButton, paddingVertical: 14, borderRadius: 30, alignItems: 'center', marginTop: 10 },
  secondaryActionButton: { borderWidth: 1, borderColor: palette.onHero, paddingVertical: 10, borderRadius: 30, alignItems: 'center', marginTop: 4 },
  actionText: { fontSize: 14, fontWeight: 'bold', color: palette.secondaryButtonText },
  secondaryActionText: { fontSize: 12, fontWeight: 'bold', color: palette.onHero },
  finalSaveBtn: { backgroundColor: palette.heroSoft, paddingVertical: 18, borderRadius: RADII.sm, alignItems: 'center', marginTop: 30 },
  finalSaveText: { color: palette.onHero, fontWeight: 'bold', fontSize: 18 },
  modalScrollOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 25 },
  modalPanel: { backgroundColor: palette.surface, borderRadius: 20, padding: 20, maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color: palette.text },
  searchInput: { backgroundColor: palette.surfaceMuted, padding: 12, borderRadius: RADII.sm, marginBottom: 15, fontSize: 16, color: palette.text },
  cityItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  cityItemText: { fontSize: 16, color: palette.text },
  clientItemMeta: { fontSize: 12, color: '#666', marginTop: 4 },
  emptyModalText: { color: palette.textMuted, textAlign: 'center', paddingVertical: 24 },
  closeBtn: { backgroundColor: palette.secondaryButton, paddingVertical: 12, borderRadius: RADII.sm, alignItems: 'center', marginTop: 15 },
  closeBtnText: { fontWeight: 'bold', color: palette.secondaryButtonText },
  coordCard: { backgroundColor: palette.surface, padding: 15, borderRadius: RADII.sm, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 15 },
  coordPhoto: { width: 60, height: 60, borderRadius: 30 },
  coordName: { fontSize: 16, fontWeight: 'bold', color: palette.text },
  disabledCard: { backgroundColor: '#C8C8C8', opacity: 0.7 },
  disabledPhoto: { opacity: 0.55 },
  disabledText: { color: '#666' },
  disabledHint: { color: '#666', fontSize: 12, marginTop: 4 },
  stepTitle: { fontSize: 22, fontWeight: 'bold', color: palette.onHero, textAlign: 'center', marginBottom: 20 },
  catWrap: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  catItem: { flex: 1, backgroundColor: palette.panelStrong, paddingVertical: 10, borderRadius: RADII.sm, alignItems: 'center', marginHorizontal: 4 },
  catTxt: { color: palette.onHero, fontSize: 10, fontWeight: 'bold' },
  staffList: { gap: 10 },
  staffRow: { backgroundColor: palette.panelStrong, padding: 15, borderRadius: RADII.sm, flexDirection: 'row', alignItems: 'center' },
  staffName: { color: palette.onHero, fontWeight: 'bold', fontSize: 15 },
  dotsButton: { padding: 10, backgroundColor: palette.panel, borderRadius: 20 },
  dotsText: { color: palette.onHero, fontWeight: 'bold', fontSize: 16 },
  overlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  detailPopup: { backgroundColor: palette.surface, width: '85%', borderRadius: 30, padding: 25, alignItems: 'center' },
  detailPhoto: { width: 120, height: 120, borderRadius: 60, marginBottom: 15, borderWidth: 3, borderColor: palette.heroSoft },
  detailName: { fontSize: 22, fontWeight: 'bold', color: palette.text },
  detailCategory: { fontSize: 14, color: '#666', marginBottom: 20, letterSpacing: 2 },
  gridInfo: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  infoBox: { alignItems: 'center', flex: 1 },
  infoLabel: { fontSize: 10, color: '#999', textTransform: 'uppercase' },
  infoVal: { fontSize: 16, fontWeight: 'bold', color: palette.text },
  closeDetailBtn: { backgroundColor: palette.heroSoft, width: '100%', paddingVertical: 15, borderRadius: 15, alignItems: 'center' },
  closeDetailText: { color: palette.onHero, fontWeight: 'bold' }
});

export default CreateEventScreen;
