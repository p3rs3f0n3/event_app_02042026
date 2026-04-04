import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  createAdminStaffCategory,
  createAdminClient,
  createAdminCoordinator,
  createAdminStaff,
  findAdminClientByNit,
  findAdminCoordinatorByCedula,
  findAdminStaffByCedula,
  getAdminStaffCategories,
  getAdminClients,
  getAdminCoordinators,
  getAdminStaff,
  getColombiaCities,
  updateAdminClient,
  updateAdminCoordinator,
  updateAdminStaff,
} from '../api/api';
import UserProfileCard from '../components/UserProfileCard';
import { AppButton, ScreenShell, SectionTitle, StatusBadge, SurfaceCard } from '../components/ui';
import { getAppPalette, RADII, SHADOWS, SPACING } from '../theme/tokens';
import { getUserDisplayName } from '../utils/user';

const LOOKUP_INITIAL_STATE = {
  status: 'idle',
  message: '',
  result: null,
  auditLogs: [],
  searchedValue: '',
};

const INITIAL_CLIENT_FORM = {
  username: '',
  password: '',
  razonSocial: '',
  nit: '',
  contactFullName: '',
  contactRole: '',
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
  category: '',
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

const normalizeNitSearchValue = (value) => String(value || '').trim();
const normalizeDocumentSearchValue = (value) => String(value || '').trim();
const normalizeCategoryValue = (value) => String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();

const buildClientFormFromRecord = (client) => ({
  username: client?.username || '',
  password: '',
  razonSocial: client?.razonSocial || '',
  nit: client?.nit || '',
  contactFullName: client?.contactFullName || '',
  contactRole: client?.contactRole || '',
  phone: client?.phone || '',
  whatsappPhone: client?.whatsappPhone || '',
  email: client?.email || '',
});

const buildCoordinatorFormFromRecord = (coordinator) => ({
  username: coordinator?.username || '',
  password: '',
  fullName: coordinator?.fullName || '',
  cedula: coordinator?.cedula || '',
  address: coordinator?.address || '',
  phone: coordinator?.phone || '',
  whatsappPhone: coordinator?.whatsappPhone || '',
  email: coordinator?.email || '',
  city: coordinator?.city || '',
});

const buildStaffFormFromRecord = (staffMember) => ({
  fullName: staffMember?.fullName || '',
  cedula: staffMember?.cedula || '',
  city: staffMember?.city || '',
  category: staffMember?.category || '',
  clothingSize: staffMember?.clothingSize || '',
  shoeSize: staffMember?.shoeSize || '',
  measurements: staffMember?.measurements || '',
});

const getLookupTone = (status) => {
  if (status === 'exists') return 'warning';
  if (status === 'not-found') return 'success';
  if (status === 'error') return 'muted';
  return 'muted';
};

const formatAuditTimestamp = (value) => {
  if (!value) {
    return 'Sin fecha';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Sin fecha';
  }

  return date.toLocaleString('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
};

const getAuditActionLabel = (auditLog) => (auditLog.action === 'create' ? 'Alta registrada' : 'Actualización registrada');

const getAdminAuditSummary = ({ entityType, values, fallbackTitle }) => {
  if (!values) {
    return 'sin registro';
  }

  if (entityType === 'client') {
    return `${values.razonSocial || '-'} · ${values.contactFullName || '-'} · ${values.email || values.phone || 'sin dato'}`;
  }

  if (entityType === 'coordinator') {
    return `${values.fullName || fallbackTitle || '-'} · ${values.city || '-'} · ${values.email || values.phone || 'sin dato'}`;
  }

  return `${values.fullName || fallbackTitle || '-'} · ${values.city || '-'} · ${values.category || 'sin categoría'}`;
};

const AdminHomeScreen = ({ user, onLogout, appConfig, roleConfig }) => {
  const palette = getAppPalette(roleConfig?.theme || 'blue');
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [activeTab, setActiveTab] = useState('clients');
  const [cities, setCities] = useState([]);
  const [staffCategories, setStaffCategories] = useState([]);
  const [lists, setLists] = useState({ clients: [], coordinators: [], staff: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkingNit, setCheckingNit] = useState(false);
  const [checkingCoordinatorCedula, setCheckingCoordinatorCedula] = useState(false);
  const [checkingStaffCedula, setCheckingStaffCedula] = useState(false);
  const [feedback, setFeedback] = useState({ tone: 'muted', message: '' });
  const [showCityModal, setShowCityModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [cityTarget, setCityTarget] = useState(null);
  const [categorySearch, setCategorySearch] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [clientForm, setClientForm] = useState(INITIAL_CLIENT_FORM);
  const [clientLookup, setClientLookup] = useState(LOOKUP_INITIAL_STATE);
  const [coordinatorForm, setCoordinatorForm] = useState(INITIAL_COORDINATOR_FORM);
  const [coordinatorLookup, setCoordinatorLookup] = useState(LOOKUP_INITIAL_STATE);
  const [staffForm, setStaffForm] = useState(INITIAL_STAFF_FORM);
  const [staffLookup, setStaffLookup] = useState(LOOKUP_INITIAL_STATE);

  const applyFeedback = useCallback((tone, message) => {
    setFeedback({ tone, message });
  }, []);

  const resetClientForm = useCallback(() => {
    setClientForm(INITIAL_CLIENT_FORM);
    setClientLookup(LOOKUP_INITIAL_STATE);
  }, []);

  const resetCoordinatorForm = useCallback(() => {
    setCoordinatorForm(INITIAL_COORDINATOR_FORM);
    setCoordinatorLookup(LOOKUP_INITIAL_STATE);
  }, []);

  const resetStaffForm = useCallback(() => {
    setStaffForm(INITIAL_STAFF_FORM);
    setStaffLookup(LOOKUP_INITIAL_STATE);
  }, []);

  const isEditingClient = clientLookup.status === 'exists' && Boolean(clientLookup.result?.clientId);
  const isEditingCoordinator = coordinatorLookup.status === 'exists' && Boolean(coordinatorLookup.result?.id);
  const isEditingStaff = staffLookup.status === 'exists' && Boolean(staffLookup.result?.id);
  const canEditCoordinatorUserFields = !isEditingCoordinator || Boolean(coordinatorLookup.result?.userId);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [clientList, coordinatorList, staffList, categoryList, cityList] = await Promise.all([
        getAdminClients(),
        getAdminCoordinators(),
        getAdminStaff(),
        getAdminStaffCategories(),
        getColombiaCities(),
      ]);

      setLists({
        clients: Array.isArray(clientList) ? clientList : [],
        coordinators: Array.isArray(coordinatorList) ? coordinatorList : [],
        staff: Array.isArray(staffList) ? staffList : [],
      });
      setStaffCategories(Array.isArray(categoryList) ? categoryList : []);
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

  const filteredStaffCategories = useMemo(() => {
    if (!categorySearch.trim()) {
      return staffCategories;
    }

    const search = normalizeCategoryValue(categorySearch);
    return staffCategories.filter((category) => normalizeCategoryValue(category.name).includes(search) || normalizeCategoryValue(category.code).includes(search));
  }, [categorySearch, staffCategories]);

  const hasExactCategoryMatch = useMemo(() => staffCategories.some((category) => normalizeCategoryValue(category.name) === normalizeCategoryValue(categorySearch)), [categorySearch, staffCategories]);

  const openCategoryPicker = () => {
    setCategorySearch(staffForm.category || '');
    setShowCategoryModal(true);
  };

  const handleCategorySelection = (categoryName) => {
    setStaffForm((current) => ({ ...current, category: categoryName }));
    setCategorySearch(categoryName);
    setShowCategoryModal(false);
  };

  const handleCreateStaffCategory = async () => {
    const nextCategoryName = normalizeCategoryValue(categorySearch);
    if (!nextCategoryName) {
      applyFeedback('error', 'Primero escribí el nombre de la categoría.');
      return;
    }

    setCreatingCategory(true);
    try {
      const createdCategory = await createAdminStaffCategory(nextCategoryName);
      setStaffCategories((current) => {
        const nextItems = [...current, createdCategory];
        return nextItems.sort((left, right) => left.name.localeCompare(right.name, 'es'));
      });
      setStaffForm((current) => ({ ...current, category: createdCategory.name }));
      setCategorySearch(createdCategory.name);
      setShowCategoryModal(false);
      applyFeedback('success', `Categoría ${createdCategory.name} creada y seleccionada.`);
    } catch (error) {
      applyFeedback('error', typeof error === 'string' ? error : 'No se pudo crear la categoría.');
    } finally {
      setCreatingCategory(false);
    }
  };

  const submitClient = async () => {
    setSaving(true);
    try {
      const editingClientId = Number(clientLookup.result?.clientId || 0);

      if (editingClientId > 0) {
        const updated = await updateAdminClient(editingClientId, {
          ...clientForm,
          actorUserId: user?.id,
        });

        setLists((current) => ({
          clients: current.clients.map((client) => (Number(client.clientId) === editingClientId ? updated : client)),
          coordinators: current.coordinators,
          staff: current.staff,
        }));
        setClientForm(buildClientFormFromRecord(updated));
        setClientLookup({
          status: 'exists',
          message: 'Cliente recuperado en modo edición. Los cambios ya quedaron persistidos y trazados.',
          result: updated,
          auditLogs: Array.isArray(updated.auditLogs) ? updated.auditLogs : [],
          searchedValue: updated.nit || clientLookup.searchedValue,
        });
        applyFeedback('success', 'Cliente actualizado correctamente.');
      } else {
        const created = await createAdminClient({
          ...clientForm,
          actorUserId: user?.id,
        });
        setLists((current) => ({ clients: [created, ...current.clients], coordinators: current.coordinators, staff: current.staff }));
        resetClientForm();
        applyFeedback('success', 'Cliente creado correctamente.');
      }
    } catch (error) {
      applyFeedback('error', typeof error === 'string' ? error : 'No se pudo guardar el cliente.');
    } finally {
      setSaving(false);
    }
  };

  const handleNitChange = (value) => {
    setClientForm((current) => ({ ...current, nit: value }));

    if (clientLookup.status !== 'idle' && clientLookup.status !== 'exists') {
      setClientLookup((current) => ({
        ...LOOKUP_INITIAL_STATE,
        searchedValue: current.searchedValue,
      }));
    }
  };

  const checkClientNit = async () => {
    const nit = normalizeNitSearchValue(clientForm.nit);
    if (!nit) {
      setClientLookup({
        status: 'error',
        message: 'Primero ingresá un NIT para verificar.',
        result: null,
        auditLogs: [],
        searchedValue: '',
      });
      return;
    }

    setCheckingNit(true);

    try {
      const response = await findAdminClientByNit(nit);

      if (response?.exists && response?.client) {
        setClientForm((current) => ({
          ...buildClientFormFromRecord(response.client),
          password: current.password,
        }));
        setClientLookup({
          status: 'exists',
          message: 'Ese cliente ya existe. Entraste en modo edición para actualizar cualquier dato recuperado.',
          result: response.client,
          auditLogs: Array.isArray(response.auditLogs) ? response.auditLogs : [],
          searchedValue: nit,
        });
        applyFeedback('success', 'Cliente recuperado. Podés editarlo o cancelar para volver al modo alta.');
        return;
      }

      setClientForm((current) => ({ ...current, nit }));
      setClientLookup({
        status: 'not-found',
        message: 'No encontramos un cliente con ese NIT. Podés continuar con el alta.',
        result: null,
        auditLogs: [],
        searchedValue: nit,
      });
      applyFeedback('success', 'NIT disponible para alta de cliente.');
    } catch (error) {
      setClientLookup({
        status: 'error',
        message: typeof error === 'string' ? error : 'No pudimos verificar el NIT ahora.',
        result: null,
        auditLogs: [],
        searchedValue: nit,
      });
    } finally {
      setCheckingNit(false);
    }
  };

  const handleCoordinatorCedulaChange = (value) => {
    setCoordinatorForm((current) => ({ ...current, cedula: value }));

    if (coordinatorLookup.status !== 'idle') {
      setCoordinatorLookup((current) => ({
        ...LOOKUP_INITIAL_STATE,
        searchedValue: current.searchedValue,
      }));
    }
  };

  const checkCoordinatorCedula = async () => {
    const cedula = normalizeDocumentSearchValue(coordinatorForm.cedula);
    if (!cedula) {
      setCoordinatorLookup({
        status: 'error',
        message: 'Primero ingresá una cédula para verificar.',
        result: null,
        auditLogs: [],
        searchedValue: '',
      });
      return;
    }

    setCheckingCoordinatorCedula(true);

    try {
      const response = await findAdminCoordinatorByCedula(cedula);

      if (response?.exists && response?.coordinator) {
        setCoordinatorForm((current) => ({
          ...buildCoordinatorFormFromRecord(response.coordinator),
          password: current.password,
        }));
        setCoordinatorLookup({
          status: 'exists',
          message: 'Ese coordinador ya existe. Entraste en modo edición para actualizar cualquier dato recuperado.',
          result: response.coordinator,
          auditLogs: Array.isArray(response.auditLogs) ? response.auditLogs : [],
          searchedValue: cedula,
        });
        applyFeedback('success', 'Coordinador recuperado. Podés editarlo o cancelar para volver al modo alta.');
        return;
      }

      setCoordinatorForm((current) => ({ ...current, cedula }));
      setCoordinatorLookup({
        status: 'not-found',
        message: 'No encontramos un coordinador con esa cédula. Podés continuar con el alta.',
        result: null,
        auditLogs: [],
        searchedValue: cedula,
      });
      applyFeedback('success', 'Cédula disponible para alta de coordinador.');
    } catch (error) {
      setCoordinatorLookup({
        status: 'error',
        message: typeof error === 'string' ? error : 'No pudimos verificar la cédula ahora.',
        result: null,
        auditLogs: [],
        searchedValue: cedula,
      });
    } finally {
      setCheckingCoordinatorCedula(false);
    }
  };

  const submitCoordinator = async () => {
    setSaving(true);
    try {
      const editingCoordinatorId = Number(coordinatorLookup.result?.id || 0);

      if (editingCoordinatorId > 0) {
        const updated = await updateAdminCoordinator(editingCoordinatorId, {
          ...coordinatorForm,
          actorUserId: user?.id,
        });
        setLists((current) => ({
          clients: current.clients,
          coordinators: current.coordinators.map((coordinator) => (Number(coordinator.id) === editingCoordinatorId ? updated : coordinator)),
          staff: current.staff,
        }));
        setCoordinatorForm(buildCoordinatorFormFromRecord(updated));
        setCoordinatorLookup({
          status: 'exists',
          message: 'Coordinador recuperado en modo edición. Los cambios ya quedaron persistidos y trazados.',
          result: updated,
          auditLogs: Array.isArray(updated.auditLogs) ? updated.auditLogs : [],
          searchedValue: updated.cedula || coordinatorLookup.searchedValue,
        });
        applyFeedback('success', 'Coordinador actualizado correctamente.');
      } else {
        const created = await createAdminCoordinator({
          ...coordinatorForm,
          actorUserId: user?.id,
        });
        setLists((current) => ({ clients: current.clients, coordinators: [created, ...current.coordinators], staff: current.staff }));
        resetCoordinatorForm();
        applyFeedback('success', 'Coordinador creado correctamente.');
      }
    } catch (error) {
      applyFeedback('error', typeof error === 'string' ? error : 'No se pudo registrar el coordinador.');
    } finally {
      setSaving(false);
    }
  };

  const handleStaffCedulaChange = (value) => {
    setStaffForm((current) => ({ ...current, cedula: value }));

    if (staffLookup.status !== 'idle') {
      setStaffLookup((current) => ({
        ...LOOKUP_INITIAL_STATE,
        searchedValue: current.searchedValue,
      }));
    }
  };

  const checkStaffCedula = async () => {
    const cedula = normalizeDocumentSearchValue(staffForm.cedula);
    if (!cedula) {
      setStaffLookup({
        status: 'error',
        message: 'Primero ingresá una cédula para verificar.',
        result: null,
        auditLogs: [],
        searchedValue: '',
      });
      return;
    }

    setCheckingStaffCedula(true);

    try {
      const response = await findAdminStaffByCedula(cedula);

      if (response?.exists && response?.staff) {
        setStaffForm(buildStaffFormFromRecord(response.staff));
        setStaffLookup({
          status: 'exists',
          message: 'Esa persona de staff ya existe. Entraste en modo edición para actualizar cualquier dato recuperado.',
          result: response.staff,
          auditLogs: Array.isArray(response.auditLogs) ? response.auditLogs : [],
          searchedValue: cedula,
        });
        applyFeedback('success', 'Staff recuperado. Podés editarlo o cancelar para volver al modo alta.');
        return;
      }

      setStaffForm((current) => ({ ...current, cedula }));
      setStaffLookup({
        status: 'not-found',
        message: 'No encontramos staff con esa cédula. Podés continuar con el alta.',
        result: null,
        auditLogs: [],
        searchedValue: cedula,
      });
      applyFeedback('success', 'Cédula disponible para alta de staff.');
    } catch (error) {
      setStaffLookup({
        status: 'error',
        message: typeof error === 'string' ? error : 'No pudimos verificar la cédula ahora.',
        result: null,
        auditLogs: [],
        searchedValue: cedula,
      });
    } finally {
      setCheckingStaffCedula(false);
    }
  };

  const submitStaff = async () => {
    setSaving(true);
    try {
      const editingStaffId = Number(staffLookup.result?.id || 0);

      if (editingStaffId > 0) {
        const updated = await updateAdminStaff(editingStaffId, {
          ...staffForm,
          actorUserId: user?.id,
        });
        setLists((current) => ({
          clients: current.clients,
          coordinators: current.coordinators,
          staff: current.staff.map((staffMember) => (Number(staffMember.id) === editingStaffId ? updated : staffMember)),
        }));
        setStaffForm(buildStaffFormFromRecord(updated));
        setStaffLookup({
          status: 'exists',
          message: 'Staff recuperado en modo edición. Los cambios ya quedaron persistidos y trazados.',
          result: updated,
          auditLogs: Array.isArray(updated.auditLogs) ? updated.auditLogs : [],
          searchedValue: updated.cedula || staffLookup.searchedValue,
        });
        applyFeedback('success', 'Staff actualizado correctamente.');
      } else {
        const created = await createAdminStaff({
          ...staffForm,
          actorUserId: user?.id,
        });
        setLists((current) => ({ clients: current.clients, coordinators: current.coordinators, staff: [created, ...current.staff] }));
        resetStaffForm();
        applyFeedback('success', 'Staff creado correctamente.');
      }
    } catch (error) {
      applyFeedback('error', typeof error === 'string' ? error : 'No se pudo registrar el staff.');
    } finally {
      setSaving(false);
    }
  };

  const renderClientTab = () => (
    <View style={styles.tabContent}>
        <SurfaceCard style={styles.formCard}>
          <View style={styles.searchHeader}>
            <Text style={styles.cardTitle}>{isEditingClient ? 'Edición de cliente' : 'Alta de cliente'}</Text>
            <StatusBadge label={isEditingClient ? 'Modo actualización' : 'Modo alta'} tone={isEditingClient ? 'warning' : 'info'} />
          </View>
          <Text style={styles.helperText}>{isEditingClient ? 'Estás editando un cliente existente. Podés actualizar cualquier dato recuperado y dejar trazabilidad del cambio.' : 'Arrancá por el NIT. Lo verificamos y, si ya existe, autocompletamos la ficha.'}</Text>
        <View style={styles.lookupRow}>
          <View style={styles.lookupInputWrap}>
            <InputRow label="NIT" value={clientForm.nit} onChangeText={handleNitChange} placeholder="900123456 o 900123456-7" />
          </View>
          <View style={styles.lookupButtonWrap}>
            <AppButton title={checkingNit ? 'VERIFICANDO...' : 'VERIFICAR NIT'} onPress={checkClientNit} disabled={checkingNit || saving} />
          </View>
        </View>
        {clientLookup.status !== 'idle' ? (
          <View style={[
            styles.lookupCard,
            clientLookup.status === 'exists' ? styles.lookupCardExists : null,
            clientLookup.status === 'not-found' ? styles.lookupCardAvailable : null,
            clientLookup.status === 'error' ? styles.lookupCardError : null,
          ]}>
            <Text style={styles.lookupTitle}>
              {clientLookup.status === 'exists' ? 'Cliente existente' : clientLookup.status === 'not-found' ? 'NIT disponible' : 'Verificación pendiente'}
            </Text>
            <Text style={styles.lookupMessage}>{clientLookup.message}</Text>
            {clientLookup.result ? (
              <View style={styles.lookupResultBlock}>
                <Text style={styles.listTitle}>{clientLookup.result.razonSocial || clientLookup.result.fullName}</Text>
                <Text style={styles.listMeta}>{clientLookup.result.contactFullName}{clientLookup.result.contactRole ? ` · ${clientLookup.result.contactRole}` : ''}</Text>
                <Text style={styles.listMeta}>@{clientLookup.result.username}{clientLookup.result.nit ? ` · NIT ${clientLookup.result.nit}` : ''}</Text>
                <Text style={styles.listMeta}>{clientLookup.result.email || clientLookup.result.phone || 'Sin dato adicional'}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        <InputRow label="Razón social" value={clientForm.razonSocial} onChangeText={(value) => setClientForm((current) => ({ ...current, razonSocial: value }))} placeholder="Empresa SAS" />
        <InputRow label="Nombre del contacto" value={clientForm.contactFullName} onChangeText={(value) => setClientForm((current) => ({ ...current, contactFullName: value }))} placeholder="Nombre y apellido" />
        <InputRow label="Cargo del contacto" value={clientForm.contactRole} onChangeText={(value) => setClientForm((current) => ({ ...current, contactRole: value }))} placeholder="Brand Manager" />
        <InputRow label="Teléfono" value={clientForm.phone} onChangeText={(value) => setClientForm((current) => ({ ...current, phone: value }))} placeholder="3001234567" />
        <InputRow label="WhatsApp" value={clientForm.whatsappPhone} onChangeText={(value) => setClientForm((current) => ({ ...current, whatsappPhone: value }))} placeholder="Opcional" />
        <InputRow label="Email" value={clientForm.email} onChangeText={(value) => setClientForm((current) => ({ ...current, email: value }))} placeholder="cliente@empresa.com" />
        <InputRow label="Usuario" value={clientForm.username} onChangeText={(value) => setClientForm((current) => ({ ...current, username: value }))} placeholder="cliente.nuevo" />
        {!isEditingClient ? (
          <InputRow label="Contraseña" value={clientForm.password} onChangeText={(value) => setClientForm((current) => ({ ...current, password: value }))} placeholder="mínimo 8 caracteres" />
        ) : (
          <View style={styles.inlineNotice}>
            <Text style={styles.inlineNoticeText}>La contraseña no se cambia desde esta ficha. Esa acción pertenece al usuario autenticado en su bloque de perfil.</Text>
          </View>
        )}
        <View style={styles.formActionsRow}>
          {isEditingClient ? <AppButton title="CANCELAR" variant="secondary" style={styles.formActionButton} onPress={resetClientForm} disabled={saving} /> : null}
          <AppButton title={saving ? 'GUARDANDO...' : isEditingClient ? 'ACTUALIZAR' : 'CREAR CLIENTE'} style={styles.formActionButton} onPress={submitClient} disabled={saving} />
        </View>
      </SurfaceCard>

      {clientLookup.status !== 'idle' ? (
        <SurfaceCard>
          <View style={styles.searchHeader}>
            <Text style={styles.cardTitle}>Resultado de verificación</Text>
            <StatusBadge label={clientLookup.searchedValue || clientForm.nit || 'NIT'} tone={getLookupTone(clientLookup.status)} />
          </View>
          <Text style={styles.heroText}>
            {clientLookup.status === 'exists'
              ? 'Se muestra únicamente el cliente encontrado, con su historial reciente, para mantener foco, homogeneidad y trazabilidad.'
              : clientLookup.status === 'not-found'
                ? 'No hay coincidencias para ese NIT. El formulario queda listo para crear el cliente.'
                : 'No pudimos obtener un resultado usable para ese NIT.'}
          </Text>
          {clientLookup.result ? (
            <View style={styles.listCard}>
              <Text style={styles.listTitle}>{clientLookup.result.razonSocial || clientLookup.result.fullName}</Text>
              <Text style={styles.listMeta}>{clientLookup.result.contactFullName}{clientLookup.result.contactRole ? ` · ${clientLookup.result.contactRole}` : ''}</Text>
              <Text style={styles.listMeta}>@{clientLookup.result.username}{clientLookup.result.nit ? ` · NIT ${clientLookup.result.nit}` : ''}</Text>
              <Text style={styles.listMeta}>{clientLookup.result.email || clientLookup.result.phone || 'Sin dato adicional'}</Text>
            </View>
          ) : null}
          {clientLookup.status === 'exists' ? (
            <View style={styles.auditSection}>
              <Text style={styles.auditTitle}>Trazabilidad reciente</Text>
              {clientLookup.auditLogs?.length ? clientLookup.auditLogs.map((auditLog) => (
                <View key={auditLog.id || `${auditLog.action}-${auditLog.timestamp}`} style={styles.auditItem}>
                  <Text style={styles.auditItemTitle}>{auditLog.action === 'create' ? 'Alta registrada' : 'Actualización registrada'}</Text>
                  <Text style={styles.auditItemMeta}>{auditLog.actorFullName || auditLog.actorUsername || 'Sistema'} · {formatAuditTimestamp(auditLog.timestamp)}</Text>
                  <Text style={styles.auditItemDetail}>Antes: {auditLog.previousValues ? `${auditLog.previousValues.razonSocial || '-'} · ${auditLog.previousValues.contactFullName || '-'} · ${auditLog.previousValues.email || auditLog.previousValues.phone || 'sin dato'}` : 'sin registro previo'}</Text>
                  <Text style={styles.auditItemDetail}>Después: {auditLog.newValues ? `${auditLog.newValues.razonSocial || '-'} · ${auditLog.newValues.contactFullName || '-'} · ${auditLog.newValues.email || auditLog.newValues.phone || 'sin dato'}` : 'sin registro nuevo'}</Text>
                </View>
              )) : <Text style={styles.lookupMessage}>Todavía no hay movimientos auditados para este cliente.</Text>}
            </View>
          ) : null}
        </SurfaceCard>
      ) : null}
    </View>
  );

  const renderCoordinatorTab = () => (
    <View style={styles.tabContent}>
      <SurfaceCard style={styles.formCard}>
        <View style={styles.searchHeader}>
          <Text style={styles.cardTitle}>{isEditingCoordinator ? 'Edición de coordinador' : 'Alta de coordinador'}</Text>
          <StatusBadge label={isEditingCoordinator ? 'Modo actualización' : 'Modo alta'} tone={isEditingCoordinator ? 'warning' : 'info'} />
        </View>
        <Text style={styles.helperText}>{isEditingCoordinator ? 'Estás editando un coordinador existente. Podés actualizar cualquier dato recuperado y dejar trazabilidad del cambio.' : 'Arrancá por la cédula. La verificamos y, si ya existe, autocompletamos la ficha.'}</Text>
        <View style={styles.lookupRow}>
          <View style={styles.lookupInputWrap}>
            <InputRow label="Cédula" value={coordinatorForm.cedula} onChangeText={handleCoordinatorCedulaChange} placeholder="Documento" />
          </View>
          <View style={styles.lookupButtonWrap}>
            <AppButton title={checkingCoordinatorCedula ? 'VERIFICANDO...' : 'VERIFICAR CÉDULA'} onPress={checkCoordinatorCedula} disabled={checkingCoordinatorCedula || saving} />
          </View>
        </View>
        {coordinatorLookup.status !== 'idle' ? (
          <View style={[
            styles.lookupCard,
            coordinatorLookup.status === 'exists' ? styles.lookupCardExists : null,
            coordinatorLookup.status === 'not-found' ? styles.lookupCardAvailable : null,
            coordinatorLookup.status === 'error' ? styles.lookupCardError : null,
          ]}>
            <Text style={styles.lookupTitle}>
              {coordinatorLookup.status === 'exists' ? 'Coordinador existente' : coordinatorLookup.status === 'not-found' ? 'Cédula disponible' : 'Verificación pendiente'}
            </Text>
            <Text style={styles.lookupMessage}>{coordinatorLookup.message}</Text>
            {coordinatorLookup.result ? (
              <View style={styles.lookupResultBlock}>
                <Text style={styles.listTitle}>{coordinatorLookup.result.fullName}</Text>
                <Text style={styles.listMeta}>{coordinatorLookup.result.city} · {coordinatorLookup.result.cedula}</Text>
                <Text style={styles.listMeta}>{coordinatorLookup.result.username ? `@${coordinatorLookup.result.username}` : 'Sin usuario vinculado'}</Text>
                <Text style={styles.listMeta}>{coordinatorLookup.result.email || coordinatorLookup.result.phone || 'Sin dato adicional'}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        <InputRow label="Nombre completo" value={coordinatorForm.fullName} onChangeText={(value) => setCoordinatorForm((current) => ({ ...current, fullName: value }))} placeholder="Nombre y apellido" />
        <InputRow label="Dirección" value={coordinatorForm.address} onChangeText={(value) => setCoordinatorForm((current) => ({ ...current, address: value }))} placeholder="Dirección operativa" multiline />
        <InputRow label="Teléfono" value={coordinatorForm.phone} onChangeText={(value) => setCoordinatorForm((current) => ({ ...current, phone: value }))} placeholder="3001234567" />
        <InputRow label="WhatsApp" value={coordinatorForm.whatsappPhone} onChangeText={(value) => setCoordinatorForm((current) => ({ ...current, whatsappPhone: value }))} placeholder="Opcional" editable={canEditCoordinatorUserFields} />
        <InputRow label="Email" value={coordinatorForm.email} onChangeText={(value) => setCoordinatorForm((current) => ({ ...current, email: value }))} placeholder="coord@eventapp.local" editable={canEditCoordinatorUserFields} />
        <InputRow label="Ciudad" value={coordinatorForm.city} onPress={() => openCityPicker('coordinator')} placeholder="Seleccionar ciudad" />
        <InputRow label="Usuario" value={coordinatorForm.username} onChangeText={(value) => setCoordinatorForm((current) => ({ ...current, username: value }))} placeholder="coord.nuevo" editable={canEditCoordinatorUserFields} />
        {isEditingCoordinator && !canEditCoordinatorUserFields ? (
          <View style={styles.inlineNotice}>
            <Text style={styles.inlineNoticeText}>Este coordinador no tiene usuario vinculado. Desde esta edición sólo actualizás su ficha operativa; credenciales y contacto autenticado siguen fuera de alcance.</Text>
          </View>
        ) : null}
        {!isEditingCoordinator ? (
          <InputRow label="Contraseña" value={coordinatorForm.password} onChangeText={(value) => setCoordinatorForm((current) => ({ ...current, password: value }))} placeholder="mínimo 8 caracteres" />
        ) : (
          <View style={styles.inlineNotice}>
            <Text style={styles.inlineNoticeText}>La contraseña no se cambia desde esta ficha. Esa acción pertenece al usuario autenticado en su bloque de perfil.</Text>
          </View>
        )}
        <View style={styles.formActionsRow}>
          {isEditingCoordinator ? <AppButton title="CANCELAR" variant="secondary" style={styles.formActionButton} onPress={resetCoordinatorForm} disabled={saving} /> : null}
          <AppButton title={saving ? 'GUARDANDO...' : isEditingCoordinator ? 'ACTUALIZAR' : 'CREAR COORDINADOR'} style={styles.formActionButton} onPress={submitCoordinator} disabled={saving} />
        </View>
      </SurfaceCard>

      {coordinatorLookup.status !== 'idle' ? (
        <SurfaceCard>
          <View style={styles.searchHeader}>
            <Text style={styles.cardTitle}>Resultado de verificación</Text>
            <StatusBadge label={coordinatorLookup.searchedValue || coordinatorForm.cedula || 'Cédula'} tone={getLookupTone(coordinatorLookup.status)} />
          </View>
          <Text style={styles.heroText}>
            {coordinatorLookup.status === 'exists'
              ? 'Se muestra únicamente el coordinador encontrado, con su historial reciente, para mantener foco, homogeneidad y trazabilidad.'
              : coordinatorLookup.status === 'not-found'
                ? 'No hay coincidencias para esa cédula. El formulario queda listo para crear el coordinador.'
                : 'No pudimos obtener un resultado usable para esa cédula.'}
          </Text>
          {coordinatorLookup.result ? (
            <View style={styles.listCard}>
              <Text style={styles.listTitle}>{coordinatorLookup.result.fullName}</Text>
              <Text style={styles.listMeta}>{coordinatorLookup.result.city} · {coordinatorLookup.result.cedula}</Text>
              <Text style={styles.listMeta}>{coordinatorLookup.result.username ? `@${coordinatorLookup.result.username}` : 'Sin usuario vinculado'}</Text>
              <Text style={styles.listMeta}>{coordinatorLookup.result.email || coordinatorLookup.result.phone || 'Sin dato adicional'}</Text>
            </View>
          ) : null}
          {coordinatorLookup.status === 'exists' ? (
            <View style={styles.auditSection}>
              <Text style={styles.auditTitle}>Trazabilidad reciente</Text>
              {coordinatorLookup.auditLogs?.length ? coordinatorLookup.auditLogs.map((auditLog) => (
                <View key={auditLog.id || `${auditLog.action}-${auditLog.timestamp}`} style={styles.auditItem}>
                  <Text style={styles.auditItemTitle}>{getAuditActionLabel(auditLog)}</Text>
                  <Text style={styles.auditItemMeta}>{auditLog.actorFullName || auditLog.actorUsername || 'Sistema'} · {formatAuditTimestamp(auditLog.timestamp)}</Text>
                  <Text style={styles.auditItemDetail}>Antes: {getAdminAuditSummary({ entityType: 'coordinator', values: auditLog.previousValues, fallbackTitle: coordinatorLookup.result?.fullName })}</Text>
                  <Text style={styles.auditItemDetail}>Después: {getAdminAuditSummary({ entityType: 'coordinator', values: auditLog.newValues, fallbackTitle: coordinatorLookup.result?.fullName })}</Text>
                </View>
              )) : <Text style={styles.lookupMessage}>Todavía no hay movimientos auditados para este coordinador.</Text>}
            </View>
          ) : null}
        </SurfaceCard>
      ) : null}
    </View>
  );

  const renderStaffTab = () => (
    <View style={styles.tabContent}>
      <SurfaceCard style={styles.formCard}>
        <View style={styles.searchHeader}>
          <Text style={styles.cardTitle}>{isEditingStaff ? 'Edición de staff' : 'Alta de staff'}</Text>
          <StatusBadge label={isEditingStaff ? 'Modo actualización' : 'Modo alta'} tone={isEditingStaff ? 'warning' : 'info'} />
        </View>
        <Text style={styles.helperText}>{isEditingStaff ? 'Estás editando una persona de staff existente. Podés actualizar cualquier dato recuperado y dejar trazabilidad del cambio.' : 'Arrancá por la cédula. La verificamos y, si ya existe, autocompletamos la ficha.'}</Text>
        <View style={styles.lookupRow}>
          <View style={styles.lookupInputWrap}>
            <InputRow label="Cédula" value={staffForm.cedula} onChangeText={handleStaffCedulaChange} placeholder="Documento" />
          </View>
          <View style={styles.lookupButtonWrap}>
            <AppButton title={checkingStaffCedula ? 'VERIFICANDO...' : 'VERIFICAR CÉDULA'} onPress={checkStaffCedula} disabled={checkingStaffCedula || saving} />
          </View>
        </View>
        {staffLookup.status !== 'idle' ? (
          <View style={[
            styles.lookupCard,
            staffLookup.status === 'exists' ? styles.lookupCardExists : null,
            staffLookup.status === 'not-found' ? styles.lookupCardAvailable : null,
            staffLookup.status === 'error' ? styles.lookupCardError : null,
          ]}>
            <Text style={styles.lookupTitle}>
              {staffLookup.status === 'exists' ? 'Staff existente' : staffLookup.status === 'not-found' ? 'Cédula disponible' : 'Verificación pendiente'}
            </Text>
            <Text style={styles.lookupMessage}>{staffLookup.message}</Text>
            {staffLookup.result ? (
              <View style={styles.lookupResultBlock}>
                <Text style={styles.listTitle}>{staffLookup.result.fullName}</Text>
                <Text style={styles.listMeta}>{staffLookup.result.city} · {staffLookup.result.category}</Text>
                <Text style={styles.listMeta}>{staffLookup.result.cedula}</Text>
                <Text style={styles.listMeta}>{staffLookup.result.clothingSize || staffLookup.result.shoeSize || 'Sin talles cargados'}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        <InputRow label="Nombre completo" value={staffForm.fullName} onChangeText={(value) => setStaffForm((current) => ({ ...current, fullName: value }))} placeholder="Nombre y apellido" />
        <InputRow label="Ciudad" value={staffForm.city} onPress={() => openCityPicker('staff')} placeholder="Seleccionar ciudad" />
        <InputRow label="Categoría" value={staffForm.category} onPress={openCategoryPicker} placeholder="Buscar o crear categoría" />
        <Text style={styles.categoryHelperText}>Usamos catálogo administrable: buscás la categoría y, si no existe, la creás desde el mismo flujo.</Text>
        <InputRow label="Talla de ropa" value={staffForm.clothingSize} onChangeText={(value) => setStaffForm((current) => ({ ...current, clothingSize: value }))} placeholder="S, M, L..." />
        <InputRow label="Talla de calzado" value={staffForm.shoeSize} onChangeText={(value) => setStaffForm((current) => ({ ...current, shoeSize: value }))} placeholder="36, 37, 38..." />
        <InputRow label="Medidas" value={staffForm.measurements} onChangeText={(value) => setStaffForm((current) => ({ ...current, measurements: value }))} placeholder="Opcional" />
        <View style={styles.formActionsRow}>
          {isEditingStaff ? <AppButton title="CANCELAR" variant="secondary" style={styles.formActionButton} onPress={resetStaffForm} disabled={saving} /> : null}
          <AppButton title={saving ? 'GUARDANDO...' : isEditingStaff ? 'ACTUALIZAR' : 'CREAR STAFF'} style={styles.formActionButton} onPress={submitStaff} disabled={saving} />
        </View>
      </SurfaceCard>

      {staffLookup.status !== 'idle' ? (
        <SurfaceCard>
          <View style={styles.searchHeader}>
            <Text style={styles.cardTitle}>Resultado de verificación</Text>
            <StatusBadge label={staffLookup.searchedValue || staffForm.cedula || 'Cédula'} tone={getLookupTone(staffLookup.status)} />
          </View>
          <Text style={styles.heroText}>
            {staffLookup.status === 'exists'
              ? 'Se muestra únicamente la persona encontrada, con su historial reciente, para mantener foco, homogeneidad y trazabilidad.'
              : staffLookup.status === 'not-found'
                ? 'No hay coincidencias para esa cédula. El formulario queda listo para crear staff.'
                : 'No pudimos obtener un resultado usable para esa cédula.'}
          </Text>
          {staffLookup.result ? (
            <View style={styles.listCard}>
              <Text style={styles.listTitle}>{staffLookup.result.fullName}</Text>
              <Text style={styles.listMeta}>{staffLookup.result.city} · {staffLookup.result.category}</Text>
              <Text style={styles.listMeta}>{staffLookup.result.cedula}</Text>
              <Text style={styles.listMeta}>Ropa: {staffLookup.result.clothingSize || 'N/D'} · Calzado: {staffLookup.result.shoeSize || 'N/D'}</Text>
            </View>
          ) : null}
          {staffLookup.status === 'exists' ? (
            <View style={styles.auditSection}>
              <Text style={styles.auditTitle}>Trazabilidad reciente</Text>
              {staffLookup.auditLogs?.length ? staffLookup.auditLogs.map((auditLog) => (
                <View key={auditLog.id || `${auditLog.action}-${auditLog.timestamp}`} style={styles.auditItem}>
                  <Text style={styles.auditItemTitle}>{getAuditActionLabel(auditLog)}</Text>
                  <Text style={styles.auditItemMeta}>{auditLog.actorFullName || auditLog.actorUsername || 'Sistema'} · {formatAuditTimestamp(auditLog.timestamp)}</Text>
                  <Text style={styles.auditItemDetail}>Antes: {getAdminAuditSummary({ entityType: 'staff', values: auditLog.previousValues, fallbackTitle: staffLookup.result?.fullName })}</Text>
                  <Text style={styles.auditItemDetail}>Después: {getAdminAuditSummary({ entityType: 'staff', values: auditLog.newValues, fallbackTitle: staffLookup.result?.fullName })}</Text>
                </View>
              )) : <Text style={styles.lookupMessage}>Todavía no hay movimientos auditados para este staff.</Text>}
            </View>
          ) : null}
        </SurfaceCard>
      ) : null}
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
        subtitle={`Hola, ${getUserDisplayName(user)}. Desde acá podés gestionar altas administrativas, actualizar clientes existentes y mantener trazabilidad sin tocar los flujos operativos existentes.`}
      />

      <UserProfileCard user={user} palette={palette} title="Perfil administrativo" buttonLabel="MI CONTRASEÑA" buttonVariant="primary" />

      <SurfaceCard style={styles.heroCard}>
        <View style={styles.heroBadges}>
          <StatusBadge label={`${lists.clients.length} clientes`} tone="info" />
          <StatusBadge label={`${lists.coordinators.length} coordinadores`} tone="success" />
          <StatusBadge label={`${lists.staff.length} staff`} tone="warning" />
        </View>
        <Text style={styles.cardTitle}>Control de altas operativas</Text>
        <Text style={styles.heroText}>El módulo valida duplicados desde el identificador principal: NIT para clientes y cédula para coordinadores y staff. En los tres casos, el hallazgo permite pasar al modo actualización con historial visible y trazabilidad reciente.</Text>
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

      <Modal visible={showCategoryModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <SurfaceCard style={styles.modalCard}>
            <Text style={styles.cardTitle}>Buscar categoría de staff</Text>
            <TextInput
              style={[stylesShared.inputShell, stylesShared.textInput]}
              value={categorySearch}
              onChangeText={setCategorySearch}
              placeholder="Ej: PROTOCOLO, MERCADERISTAS..."
              placeholderTextColor="#94A3B8"
            />
            <ScrollView contentContainerStyle={styles.cityList}>
              {filteredStaffCategories.map((category) => (
                <Pressable key={category.id || category.code || category.name} style={[styles.categoryOption, staffForm.category === category.name && styles.categoryOptionActive]} onPress={() => handleCategorySelection(category.name)}>
                  <Text style={[styles.categoryOptionText, staffForm.category === category.name && styles.categoryOptionTextActive]}>{category.name}</Text>
                  <Text style={styles.categoryOptionCode}>{category.code}</Text>
                </Pressable>
              ))}
              {!filteredStaffCategories.length ? <Text style={styles.lookupMessage}>No encontramos categorías con ese criterio.</Text> : null}
            </ScrollView>
            {normalizeCategoryValue(categorySearch) && !hasExactCategoryMatch ? (
              <AppButton title={creatingCategory ? 'CREANDO...' : `CREAR ${normalizeCategoryValue(categorySearch)}`} onPress={handleCreateStaffCategory} disabled={creatingCategory} />
            ) : null}
            <AppButton title="CERRAR" variant="secondary" onPress={() => setShowCategoryModal(false)} />
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
  helperText: { color: palette.textMuted, lineHeight: 20 },
  cardTitle: { fontSize: 22, fontWeight: '800', color: palette.text },
  lookupRow: { gap: SPACING.sm },
  lookupInputWrap: { flex: 1 },
  lookupButtonWrap: { minWidth: 180 },
  lookupCard: {
    borderRadius: RADII.md,
    borderWidth: 1,
    padding: SPACING.md,
    gap: SPACING.xs,
    backgroundColor: palette.surfaceMuted,
    borderColor: palette.border,
  },
  lookupCardExists: { borderColor: '#F59E0B', backgroundColor: '#FFF7ED' },
  lookupCardAvailable: { borderColor: palette.successText, backgroundColor: palette.successBg },
  lookupCardError: { borderColor: palette.errorText, backgroundColor: palette.errorBg },
  lookupTitle: { color: palette.text, fontWeight: '800', fontSize: 16 },
  lookupMessage: { color: palette.textMuted, lineHeight: 20 },
  lookupResultBlock: { marginTop: SPACING.xs, gap: 4 },
  listCard: {
    borderRadius: RADII.md,
    backgroundColor: palette.surfaceMuted,
    padding: SPACING.md,
    gap: 4,
  },
  listTitle: { color: palette.text, fontSize: 16, fontWeight: '800' },
  listMeta: { color: palette.textMuted },
  searchHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: SPACING.sm },
  categoryHelperText: { color: palette.textMuted, marginTop: -SPACING.xs, lineHeight: 18 },
  categoryOption: {
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceMuted,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    gap: 4,
  },
  categoryOptionActive: { backgroundColor: '#FFF7ED', borderColor: '#FFB300' },
  categoryOptionText: { color: palette.text, fontWeight: '800' },
  categoryOptionTextActive: { color: '#1F2937' },
  categoryOptionCode: { color: palette.textMuted, fontSize: 12 },
  formActionsRow: { flexDirection: 'row', gap: SPACING.sm },
  formActionButton: { flex: 1 },
  inlineNotice: {
    borderRadius: RADII.md,
    backgroundColor: palette.surfaceMuted,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  inlineNoticeText: { color: palette.textMuted, lineHeight: 20 },
  auditSection: { marginTop: SPACING.md, gap: SPACING.sm },
  auditTitle: { color: palette.text, fontSize: 16, fontWeight: '800' },
  auditItem: {
    borderRadius: RADII.md,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: palette.border,
    padding: SPACING.md,
    gap: 4,
  },
  auditItemTitle: { color: palette.text, fontWeight: '800' },
  auditItemMeta: { color: palette.textMuted, fontSize: 12 },
  auditItemDetail: { color: palette.textMuted, lineHeight: 18 },
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
