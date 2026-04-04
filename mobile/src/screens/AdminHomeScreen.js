import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  createAdminClient,
  createAdminCoordinator,
  createAdminStaff,
  getAdminClients,
  getAdminCoordinators,
  getAdminStaff,
  getColombiaCities,
} from '../api/api';
import { AppButton, ScreenShell, SectionTitle, StatusBadge, SurfaceCard } from '../components/ui';
import { getAppPalette, RADII, SHADOWS, SPACING } from '../theme/tokens';
import { getUserDisplayName } from '../utils/user';

const STAFF_CATEGORIES = ['BARISTAS', 'IMPULSADORES', 'LOGISTICOS'];

const INITIAL_CLIENT_FORM = {
  username: '',
  password: '',
  fullName: '',
  phone: '',
  whatsappPhone: '',
  email: '',
};

const INITIAL_COORDINATOR_FORM = {
  username: '',
  password: '',
  fullName: '',
  cedula: '',
  address: '',
  phone: '',
  whatsappPhone: '',
  email: '',
  city: '',
};

const INITIAL_STAFF_FORM = {
  fullName: '',
  cedula: '',
  city: '',
  category: STAFF_CATEGORIES[0],
  clothingSize: '',
  shoeSize: '',
  measurements: '',
};

const TABS = [
  { key: 'clients', label: 'Clientes' },
  { key: 'coordinators', label: 'Coordinadores' },
  { key: 'staff', label: 'Staff' },
];

const InputRow = ({ label, value, onChangeText, placeholder, multiline = false, editable = true, onPress }) => (
  <View style={stylesShared.fieldWrap}>
    <Text style={stylesShared.fieldLabel}>{label}</Text>
    {onPress ? (
      <Pressable style={stylesShared.inputShell} onPress={onPress}>
        <Text style={[stylesShared.inputText, !value && stylesShared.placeholderText]}>{value || placeholder || 'Seleccionar'}</Text>
      </Pressable>
    ) : (
      <TextInput
        style={[stylesShared.inputShell, stylesShared.textInput, multiline && stylesShared.textArea]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        multiline={multiline}
        editable={editable}
      />
    )}
  </View>
);

const AdminHomeScreen = ({ user, onLogout, appConfig, roleConfig }) => {
  const palette = getAppPalette(roleConfig?.theme || 'blue');
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [activeTab, setActiveTab] = useState('clients');
  const [cities, setCities] = useState([]);
  const [lists, setLists] = useState({ clients: [], coordinators: [], staff: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({ tone: 'muted', message: '' });
  const [showCityModal, setShowCityModal] = useState(false);
  const [cityTarget, setCityTarget] = useState(null);
  const [clientForm, setClientForm] = useState(INITIAL_CLIENT_FORM);
  const [coordinatorForm, setCoordinatorForm] = useState(INITIAL_COORDINATOR_FORM);
  const [staffForm, setStaffForm] = useState(INITIAL_STAFF_FORM);

  const applyFeedback = useCallback((tone, message) => {
    setFeedback({ tone, message });
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [clientList, coordinatorList, staffList, cityList] = await Promise.all([
        getAdminClients(),
        getAdminCoordinators(),
        getAdminStaff(),
        getColombiaCities(),
      ]);

      setLists({
        clients: Array.isArray(clientList) ? clientList : [],
        coordinators: Array.isArray(coordinatorList) ? coordinatorList : [],
        staff: Array.isArray(staffList) ? staffList : [],
      });
      setCities(Array.isArray(cityList) ? cityList.filter((city) => !city?.isOther) : []);
    } catch (error) {
      applyFeedback('error', 'No pudimos cargar el módulo administrativo.');
    } finally {
      setLoading(false);
    }
  }, [applyFeedback]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const openCityPicker = (target) => {
    setCityTarget(target);
    setShowCityModal(true);
  };

  const handleCitySelection = (cityName) => {
    if (cityTarget === 'coordinator') {
      setCoordinatorForm((current) => ({ ...current, city: cityName }));
    }

    if (cityTarget === 'staff') {
      setStaffForm((current) => ({ ...current, city: cityName }));
    }

    setShowCityModal(false);
    setCityTarget(null);
  };

  const submitClient = async () => {
    setSaving(true);
    try {
      const created = await createAdminClient(clientForm);
      setLists((current) => ({ clients: [created, ...current.clients], coordinators: current.coordinators, staff: current.staff }));
      setClientForm(INITIAL_CLIENT_FORM);
      applyFeedback('success', 'Cliente creado correctamente.');
    } catch (error) {
      applyFeedback('error', typeof error === 'string' ? error : 'No se pudo registrar el cliente.');
    } finally {
      setSaving(false);
    }
  };

  const submitCoordinator = async () => {
    setSaving(true);
    try {
      const created = await createAdminCoordinator(coordinatorForm);
      setLists((current) => ({ clients: current.clients, coordinators: [created, ...current.coordinators], staff: current.staff }));
      setCoordinatorForm(INITIAL_COORDINATOR_FORM);
      applyFeedback('success', 'Coordinador creado correctamente.');
    } catch (error) {
      applyFeedback('error', typeof error === 'string' ? error : 'No se pudo registrar el coordinador.');
    } finally {
      setSaving(false);
    }
  };

  const submitStaff = async () => {
    setSaving(true);
    try {
      const created = await createAdminStaff(staffForm);
      setLists((current) => ({ clients: current.clients, coordinators: current.coordinators, staff: [created, ...current.staff] }));
      setStaffForm(INITIAL_STAFF_FORM);
      applyFeedback('success', 'Staff creado correctamente.');
    } catch (error) {
      applyFeedback('error', typeof error === 'string' ? error : 'No se pudo registrar el staff.');
    } finally {
      setSaving(false);
    }
  };

  const renderClientTab = () => (
    <View style={styles.tabContent}>
      <SurfaceCard style={styles.formCard}>
        <Text style={styles.cardTitle}>Alta de cliente</Text>
        <InputRow label="Usuario" value={clientForm.username} onChangeText={(value) => setClientForm((current) => ({ ...current, username: value }))} placeholder="cliente.nuevo" />
        <InputRow label="Contraseña" value={clientForm.password} onChangeText={(value) => setClientForm((current) => ({ ...current, password: value }))} placeholder="mínimo 8 caracteres" />
        <InputRow label="Nombre completo" value={clientForm.fullName} onChangeText={(value) => setClientForm((current) => ({ ...current, fullName: value }))} placeholder="Marca / contacto" />
        <InputRow label="Teléfono" value={clientForm.phone} onChangeText={(value) => setClientForm((current) => ({ ...current, phone: value }))} placeholder="3001234567" />
        <InputRow label="WhatsApp" value={clientForm.whatsappPhone} onChangeText={(value) => setClientForm((current) => ({ ...current, whatsappPhone: value }))} placeholder="Opcional" />
        <InputRow label="Email" value={clientForm.email} onChangeText={(value) => setClientForm((current) => ({ ...current, email: value }))} placeholder="cliente@empresa.com" />
        <AppButton title={saving ? 'GUARDANDO...' : 'CREAR CLIENTE'} onPress={submitClient} disabled={saving} />
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.cardTitle}>Clientes registrados</Text>
        {lists.clients.map((client) => (
          <View key={client.id} style={styles.listCard}>
            <Text style={styles.listTitle}>{client.fullName}</Text>
            <Text style={styles.listMeta}>@{client.username}</Text>
            <Text style={styles.listMeta}>{client.email || client.phone || 'Sin dato adicional'}</Text>
          </View>
        ))}
      </SurfaceCard>
    </View>
  );

  const renderCoordinatorTab = () => (
    <View style={styles.tabContent}>
      <SurfaceCard style={styles.formCard}>
        <Text style={styles.cardTitle}>Alta de coordinador</Text>
        <InputRow label="Usuario" value={coordinatorForm.username} onChangeText={(value) => setCoordinatorForm((current) => ({ ...current, username: value }))} placeholder="coord.nuevo" />
        <InputRow label="Contraseña" value={coordinatorForm.password} onChangeText={(value) => setCoordinatorForm((current) => ({ ...current, password: value }))} placeholder="mínimo 8 caracteres" />
        <InputRow label="Nombre completo" value={coordinatorForm.fullName} onChangeText={(value) => setCoordinatorForm((current) => ({ ...current, fullName: value }))} placeholder="Nombre y apellido" />
        <InputRow label="Cédula" value={coordinatorForm.cedula} onChangeText={(value) => setCoordinatorForm((current) => ({ ...current, cedula: value }))} placeholder="Documento" />
        <InputRow label="Dirección" value={coordinatorForm.address} onChangeText={(value) => setCoordinatorForm((current) => ({ ...current, address: value }))} placeholder="Dirección operativa" multiline />
        <InputRow label="Teléfono" value={coordinatorForm.phone} onChangeText={(value) => setCoordinatorForm((current) => ({ ...current, phone: value }))} placeholder="3001234567" />
        <InputRow label="WhatsApp" value={coordinatorForm.whatsappPhone} onChangeText={(value) => setCoordinatorForm((current) => ({ ...current, whatsappPhone: value }))} placeholder="Opcional" />
        <InputRow label="Email" value={coordinatorForm.email} onChangeText={(value) => setCoordinatorForm((current) => ({ ...current, email: value }))} placeholder="coord@eventapp.local" />
        <InputRow label="Ciudad" value={coordinatorForm.city} onPress={() => openCityPicker('coordinator')} placeholder="Seleccionar ciudad" />
        <AppButton title={saving ? 'GUARDANDO...' : 'CREAR COORDINADOR'} onPress={submitCoordinator} disabled={saving} />
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.cardTitle}>Coordinadores registrados</Text>
        {lists.coordinators.map((coordinator) => (
          <View key={coordinator.id} style={styles.listCard}>
            <Text style={styles.listTitle}>{coordinator.fullName}</Text>
            <Text style={styles.listMeta}>{coordinator.city} · {coordinator.cedula}</Text>
            <Text style={styles.listMeta}>{coordinator.username ? `@${coordinator.username}` : 'Sin usuario vinculado'}</Text>
          </View>
        ))}
      </SurfaceCard>
    </View>
  );

  const renderStaffTab = () => (
    <View style={styles.tabContent}>
      <SurfaceCard style={styles.formCard}>
        <Text style={styles.cardTitle}>Alta de staff</Text>
        <InputRow label="Nombre completo" value={staffForm.fullName} onChangeText={(value) => setStaffForm((current) => ({ ...current, fullName: value }))} placeholder="Nombre y apellido" />
        <InputRow label="Cédula" value={staffForm.cedula} onChangeText={(value) => setStaffForm((current) => ({ ...current, cedula: value }))} placeholder="Documento" />
        <InputRow label="Ciudad" value={staffForm.city} onPress={() => openCityPicker('staff')} placeholder="Seleccionar ciudad" />
        <View style={stylesShared.fieldWrap}>
          <Text style={stylesShared.fieldLabel}>Categoría</Text>
          <View style={styles.categoryRow}>
            {STAFF_CATEGORIES.map((category) => (
              <Pressable key={category} style={[styles.categoryChip, staffForm.category === category && styles.categoryChipActive]} onPress={() => setStaffForm((current) => ({ ...current, category }))}>
                <Text style={[styles.categoryChipText, staffForm.category === category && styles.categoryChipTextActive]}>{category}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <InputRow label="Talla de ropa" value={staffForm.clothingSize} onChangeText={(value) => setStaffForm((current) => ({ ...current, clothingSize: value }))} placeholder="S, M, L..." />
        <InputRow label="Talla de calzado" value={staffForm.shoeSize} onChangeText={(value) => setStaffForm((current) => ({ ...current, shoeSize: value }))} placeholder="36, 37, 38..." />
        <InputRow label="Medidas" value={staffForm.measurements} onChangeText={(value) => setStaffForm((current) => ({ ...current, measurements: value }))} placeholder="Opcional" />
        <AppButton title={saving ? 'GUARDANDO...' : 'CREAR STAFF'} onPress={submitStaff} disabled={saving} />
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.cardTitle}>Staff registrado</Text>
        {lists.staff.map((staffMember) => (
          <View key={staffMember.id} style={styles.listCard}>
            <Text style={styles.listTitle}>{staffMember.fullName}</Text>
            <Text style={styles.listMeta}>{staffMember.city} · {staffMember.category}</Text>
            <Text style={styles.listMeta}>{staffMember.cedula}</Text>
          </View>
        ))}
      </SurfaceCard>
    </View>
  );

  const renderActiveTab = () => {
    if (activeTab === 'coordinators') return renderCoordinatorTab();
    if (activeTab === 'staff') return renderStaffTab();
    return renderClientTab();
  };

  if (loading) {
    return (
      <ScreenShell palette={palette} contentContainerStyle={styles.loaderWrap}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loaderText}>Cargando módulo administrativo...</Text>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell palette={palette} contentContainerStyle={styles.content}>
      <SectionTitle
        kicker="Módulo administrador"
        title={appConfig?.appName || 'EventApp'}
        subtitle={`Hola, ${getUserDisplayName(user)}. Desde acá podés dar de alta clientes, coordinadores y staff sin tocar los flujos operativos existentes.`}
      />

      <SurfaceCard style={styles.heroCard}>
        <View style={styles.heroBadges}>
          <StatusBadge label={`${lists.clients.length} clientes`} tone="info" />
          <StatusBadge label={`${lists.coordinators.length} coordinadores`} tone="success" />
          <StatusBadge label={`${lists.staff.length} staff`} tone="warning" />
        </View>
        <Text style={styles.cardTitle}>Control de altas operativas</Text>
        <Text style={styles.heroText}>El módulo valida duplicados antes de guardar y deja los listados actualizados en la misma vista.</Text>
      </SurfaceCard>

      {feedback.message ? (
        <SurfaceCard style={[styles.feedbackCard, feedback.tone === 'error' ? styles.feedbackError : styles.feedbackSuccess]}>
          <Text style={styles.feedbackText}>{feedback.message}</Text>
        </SurfaceCard>
      ) : null}

      <View style={styles.tabRow}>
        {TABS.map((tab) => (
          <Pressable key={tab.key} style={[styles.tabButton, activeTab === tab.key && styles.tabButtonActive]} onPress={() => setActiveTab(tab.key)}>
            <Text style={[styles.tabButtonText, activeTab === tab.key && styles.tabButtonTextActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>

      {renderActiveTab()}

      <AppButton title="SALIR" variant="secondary" onPress={onLogout} />

      <Modal visible={showCityModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <SurfaceCard style={styles.modalCard}>
            <Text style={styles.cardTitle}>Seleccionar ciudad</Text>
            <ScrollView contentContainerStyle={styles.cityList}>
              {cities.map((city) => (
                <Pressable key={city.id} style={styles.cityOption} onPress={() => handleCitySelection(city.name)}>
                  <Text style={styles.cityOptionText}>{city.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <AppButton title="CERRAR" variant="secondary" onPress={() => setShowCityModal(false)} />
          </SurfaceCard>
        </View>
      </Modal>
    </ScreenShell>
  );
};

const stylesShared = StyleSheet.create({
  fieldWrap: { gap: SPACING.xs },
  fieldLabel: { color: '#223548', fontSize: 13, fontWeight: '800' },
  inputShell: {
    minHeight: 50,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: '#D7E0EA',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  textInput: { color: '#223548', paddingVertical: 14 },
  inputText: { color: '#223548' },
  placeholderText: { color: '#94A3B8' },
  textArea: { minHeight: 84, textAlignVertical: 'top' },
});

const createStyles = (palette) => StyleSheet.create({
  content: { gap: SPACING.lg },
  loaderWrap: { justifyContent: 'center', alignItems: 'center', gap: SPACING.md },
  loaderText: { color: '#FFFFFF', fontWeight: '700' },
  heroCard: { backgroundColor: palette.surfaceMuted },
  heroBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  heroText: { color: palette.textMuted, lineHeight: 20 },
  feedbackCard: { borderWidth: 1 },
  feedbackSuccess: { borderColor: palette.successText, backgroundColor: palette.successBg },
  feedbackError: { borderColor: palette.errorText, backgroundColor: palette.errorBg },
  feedbackText: { color: '#223548', fontWeight: '700' },
  tabRow: { flexDirection: 'row', gap: SPACING.sm },
  tabButton: {
    flex: 1,
    borderRadius: RADII.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabButtonActive: { backgroundColor: '#FFFFFF' },
  tabButtonText: { color: '#FFFFFF', fontWeight: '800' },
  tabButtonTextActive: { color: palette.text },
  tabContent: { gap: SPACING.lg },
  formCard: { gap: SPACING.md },
  cardTitle: { fontSize: 22, fontWeight: '800', color: palette.text },
  listCard: {
    borderRadius: RADII.md,
    backgroundColor: palette.surfaceMuted,
    padding: SPACING.md,
    gap: 4,
  },
  listTitle: { color: palette.text, fontSize: 16, fontWeight: '800' },
  listMeta: { color: palette.textMuted },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  categoryChip: {
    borderRadius: RADII.pill,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  categoryChipActive: { backgroundColor: '#FFB300', borderColor: '#FFB300' },
  categoryChipText: { color: palette.text, fontWeight: '700' },
  categoryChipTextActive: { color: '#1F2937' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  modalCard: { maxHeight: '80%', gap: SPACING.md, ...SHADOWS.floating },
  cityList: { gap: SPACING.sm },
  cityOption: {
    borderRadius: RADII.md,
    backgroundColor: palette.surfaceMuted,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
  },
  cityOptionText: { color: palette.text, fontWeight: '700' },
});

export default AdminHomeScreen;
