import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import {
  createAdminStaffCategory,
  createAdminClient,
  createAdminCoordinator,
  createAdminStaff,
  findAdminClientByNit,
  findAdminCoordinatorByCedula,
  findAdminStaffByCedula,
  inactivateAdminClient,
  inactivateAdminCoordinator,
  inactivateAdminStaff,
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
  sexo: '',
  shirtSize: '',
  pantsSize: '',
  shoeSize: '',
  busto: '',
  cintura: '',
  cadera: '',
};

const STAFF_SEXO_OPTIONS = [
  { value: 'mujer', label: 'Mujer' },
  { value: 'hombre', label: 'Hombre' },
];

const TABS = [
  { key: 'clients', label: 'Clientes' },
  { key: 'coordinators', label: 'Coordinadores' },
  { key: 'staff', label: 'Staff' },
];

const MAX_ADMIN_STAFF_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;

const InputRow = ({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  editable = true,
  onPress,
  keyboardType = 'default',
  maxLength,
}) => (
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
        keyboardType={keyboardType}
        maxLength={maxLength}
      />
    )}
  </View>
);

const normalizeNitSearchValue = (value) => String(value || '').trim();
const normalizeDocumentSearchValue = (value) => String(value || '').trim();
const normalizeCategoryValue = (value) => String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();
const normalizePhoneValue = (value) => String(value || '').replace(/\D/g, '').slice(0, 10);
const normalizeEmailValue = (value) => String(value || '').trim().toLowerCase();
const normalizeStaffSizeInputValue = (value) => String(value || '').replace(/[^A-Za-z0-9./\-\s]/g, '').slice(0, 10);
const isValidEmailValue = (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const hasTextValue = (value) => String(value || '').trim().length > 0;
const isValidStaffMeasurementValue = (value) => !value || /^\d{1,3}([.,]\d{1,2})?$/.test(String(value || '').trim());

const getStaffSizeSummary = (staffMember) => {
  const shirtSize = staffMember?.shirtSize || staffMember?.clothingSize || 'N/D';
  const pantsSize = staffMember?.pantsSize || staffMember?.clothingSize || 'N/D';
  const shoeSize = staffMember?.shoeSize || 'N/D';

  if (shirtSize === 'N/D' && pantsSize === 'N/D' && shoeSize === 'N/D') {
    return 'Sin talles cargados';
  }

  return `Camisa ${shirtSize} · Pantalón ${pantsSize} · Calzado ${shoeSize}`;
};

const getClientCreateValidationMessage = (form) => {
  if (!hasTextValue(form.nit)) return 'El NIT es obligatorio en el alta.';
  if (!hasTextValue(form.razonSocial)) return 'La razón social es obligatoria en el alta.';
  if (!hasTextValue(form.contactFullName)) return 'El nombre del contacto es obligatorio en el alta.';
  if (!hasTextValue(form.contactRole)) return 'El cargo del contacto es obligatorio en el alta.';
  if (!hasTextValue(form.phone)) return 'El número celular es obligatorio en el alta.';
  if (!hasTextValue(form.whatsappPhone)) return 'El WhatsApp es obligatorio en el alta.';
  if (!hasTextValue(form.email)) return 'El email es obligatorio en el alta.';
  if (!hasTextValue(form.username)) return 'El usuario es obligatorio en el alta.';
  if (!hasTextValue(form.password)) return 'La contraseña es obligatoria en el alta.';
  return null;
};

const getCoordinatorCreateValidationMessage = (form) => {
  if (!hasTextValue(form.cedula)) return 'La cédula es obligatoria en el alta.';
  if (!hasTextValue(form.fullName)) return 'El nombre completo es obligatorio en el alta.';
  if (!hasTextValue(form.address)) return 'La dirección es obligatoria en el alta.';
  if (!hasTextValue(form.phone)) return 'El teléfono es obligatorio en el alta.';
  if (!hasTextValue(form.whatsappPhone)) return 'El WhatsApp es obligatorio en el alta.';
  if (!hasTextValue(form.email)) return 'El email es obligatorio en el alta.';
  if (!hasTextValue(form.city)) return 'La ciudad es obligatoria en el alta.';
  if (!hasTextValue(form.username)) return 'El usuario es obligatorio en el alta.';
  if (!hasTextValue(form.password)) return 'La contraseña es obligatoria en el alta.';
  return null;
};

const getStaffValidationMessage = (form) => {
  if (!hasTextValue(form.cedula)) return 'La cédula es obligatoria.';
  if (!hasTextValue(form.fullName)) return 'El nombre completo es obligatorio.';
  if (!hasTextValue(form.city)) return 'La ciudad es obligatoria.';
  if (!hasTextValue(form.category)) return 'La categoría es obligatoria.';
  if (!hasTextValue(form.sexo)) return 'El sexo es obligatorio.';

  if (form.sexo === 'mujer') {
    if (!hasTextValue(form.busto)) return 'El busto es obligatorio cuando el sexo es mujer.';
    if (!hasTextValue(form.cintura)) return 'La cintura es obligatoria cuando el sexo es mujer.';
    if (!hasTextValue(form.cadera)) return 'La cadera es obligatoria cuando el sexo es mujer.';
    if (!isValidStaffMeasurementValue(form.busto)) return 'El busto debe ser una medida simple válida.';
    if (!isValidStaffMeasurementValue(form.cintura)) return 'La cintura debe ser una medida simple válida.';
    if (!isValidStaffMeasurementValue(form.cadera)) return 'La cadera debe ser una medida simple válida.';
  }

  return null;
};

const buildClientFormFromRecord = (client) => ({
  username: client?.username || '',
  password: '',
  razonSocial: client?.razonSocial || '',
  nit: client?.nit || '',
  contactFullName: client?.contactFullName || '',
  contactRole: client?.contactRole || '',
  phone: normalizePhoneValue(client?.phone),
  whatsappPhone: normalizePhoneValue(client?.whatsappPhone),
  email: normalizeEmailValue(client?.email),
});

const buildCoordinatorFormFromRecord = (coordinator) => ({
  username: coordinator?.username || '',
  password: '',
  fullName: coordinator?.fullName || '',
  cedula: coordinator?.cedula || '',
  address: coordinator?.address || '',
  phone: normalizePhoneValue(coordinator?.phone),
  whatsappPhone: normalizePhoneValue(coordinator?.whatsappPhone),
  email: normalizeEmailValue(coordinator?.email),
  city: coordinator?.city || '',
});

const buildStaffFormFromRecord = (staffMember) => ({
  fullName: staffMember?.fullName || '',
  cedula: staffMember?.cedula || '',
  city: staffMember?.city || '',
  category: staffMember?.category || '',
  sexo: staffMember?.sexo || '',
  shirtSize: staffMember?.shirtSize || staffMember?.clothingSize || '',
  pantsSize: staffMember?.pantsSize || staffMember?.clothingSize || '',
  shoeSize: staffMember?.shoeSize || '',
  busto: staffMember?.busto || '',
  cintura: staffMember?.cintura || '',
  cadera: staffMember?.cadera || '',
});

const getStaffPhotoPreviewUri = ({ draftPhoto, staffLookup }) => draftPhoto?.uri || staffLookup.result?.photo || null;

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

const getAuditActionLabel = (auditLog) => {
  if (auditLog.action === 'create') return 'Alta registrada';
  if (auditLog.action === 'inactivate') return 'Inactivación registrada';
  return 'Actualización registrada';
};

const getEntityStatusLabel = (record) => (record?.isActive === false ? 'INACTIVO' : 'ACTIVO');
const getEntityStatusTone = (record) => (record?.isActive === false ? 'warning' : 'success');
const countInactiveRecords = (records = []) => records.filter((record) => record?.isActive === false).length;

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
  const [staffPhotoDraft, setStaffPhotoDraft] = useState(null);

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
    setStaffPhotoDraft(null);
  }, []);

  const isEditingClient = clientLookup.status === 'exists' && Boolean(clientLookup.result?.clientId);
  const isEditingCoordinator = coordinatorLookup.status === 'exists' && Boolean(coordinatorLookup.result?.id);
  const isEditingStaff = staffLookup.status === 'exists' && Boolean(staffLookup.result?.id);
  const shouldRequestDetailedMeasurements = staffForm.sexo === 'mujer';
  const canEditCoordinatorUserFields = !isEditingCoordinator || Boolean(coordinatorLookup.result?.userId);
  const staffPhotoPreviewUri = getStaffPhotoPreviewUri({ draftPhoto: staffPhotoDraft, staffLookup });
  const inactiveCounts = useMemo(() => ({
    clients: countInactiveRecords(lists.clients),
    coordinators: countInactiveRecords(lists.coordinators),
    staff: countInactiveRecords(lists.staff),
  }), [lists]);

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

  useEffect(() => {
    setFeedback({ tone: 'muted', message: '' });
  }, [activeTab]);

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
      applyFeedback('error', 'Primero escribe el nombre de la categoría.');
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
    if (!isEditingClient) {
      const validationMessage = getClientCreateValidationMessage(clientForm);
      if (validationMessage) {
        applyFeedback('error', validationMessage);
        return;
      }
    }

    const normalizedEmail = normalizeEmailValue(clientForm.email);
    if (!isValidEmailValue(normalizedEmail)) {
      applyFeedback('error', 'Ingresa un correo electrónico válido.');
      return;
    }

    setSaving(true);
    try {
      const editingClientId = Number(clientLookup.result?.clientId || 0);

      if (editingClientId > 0) {
        const updated = await updateAdminClient(editingClientId, {
          ...clientForm,
          email: normalizedEmail,
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
          email: normalizedEmail,
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

  const handleInactivateClient = () => {
    const editingClientId = Number(clientLookup.result?.clientId || 0);
    if (editingClientId <= 0 || clientLookup.result?.isActive === false) {
      return;
    }

    Alert.alert(
      'Inactivar cliente',
      'Este cliente dejará de iniciar sesión y de aparecer en los flujos operativos. El registro NO se borra.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Inactivar',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              const updated = await inactivateAdminClient(editingClientId, { actorUserId: user?.id });
              setLists((current) => ({
                clients: current.clients.map((client) => (Number(client.clientId) === editingClientId ? updated : client)),
                coordinators: current.coordinators,
                staff: current.staff,
              }));
              setClientForm(buildClientFormFromRecord(updated));
              setClientLookup({
                status: 'exists',
                message: 'Cliente inactivado. Conservamos el registro y la trazabilidad, pero ya no participa en los flujos activos.',
                result: updated,
                auditLogs: Array.isArray(updated.auditLogs) ? updated.auditLogs : [],
                searchedValue: updated.nit || clientLookup.searchedValue,
              });
              applyFeedback('success', 'Cliente inactivado correctamente.');
            } catch (error) {
              applyFeedback('error', typeof error === 'string' ? error : 'No se pudo inactivar el cliente.');
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
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

  const handleClientPhoneChange = (field, value) => {
    const normalizedPhone = normalizePhoneValue(value);
    setClientForm((current) => ({ ...current, [field]: normalizedPhone }));
  };

  const handleCoordinatorPhoneChange = (field, value) => {
    const normalizedPhone = normalizePhoneValue(value);
    setCoordinatorForm((current) => ({ ...current, [field]: normalizedPhone }));
  };

  const checkClientNit = async () => {
    const nit = normalizeNitSearchValue(clientForm.nit);
    if (!nit) {
      setClientLookup({
        status: 'error',
        message: 'Primero ingresa un NIT para verificar.',
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
          message: 'Ese cliente ya existe. Ahora estás en modo de edición para actualizar cualquier dato recuperado.',
          result: response.client,
          auditLogs: Array.isArray(response.auditLogs) ? response.auditLogs : [],
          searchedValue: nit,
        });
        applyFeedback('success', 'Cliente recuperado. Puedes editarlo o cancelar para volver al modo de alta.');
        return;
      }

      setClientForm((current) => ({ ...current, nit }));
      setClientLookup({
        status: 'not-found',
        message: 'No encontramos un cliente con ese NIT. Puedes continuar con el alta.',
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
        message: 'Primero ingresa una cédula para verificar.',
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
          message: 'Ese coordinador ya existe. Ahora estás en modo de edición para actualizar cualquier dato recuperado.',
          result: response.coordinator,
          auditLogs: Array.isArray(response.auditLogs) ? response.auditLogs : [],
          searchedValue: cedula,
        });
        applyFeedback('success', 'Coordinador recuperado. Puedes editarlo o cancelar para volver al modo de alta.');
        return;
      }

      setCoordinatorForm((current) => ({ ...current, cedula }));
      setCoordinatorLookup({
        status: 'not-found',
        message: 'No encontramos un coordinador con esa cédula. Puedes continuar con el alta.',
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
    if (!isEditingCoordinator) {
      const validationMessage = getCoordinatorCreateValidationMessage(coordinatorForm);
      if (validationMessage) {
        applyFeedback('error', validationMessage);
        return;
      }
    }

    const normalizedEmail = normalizeEmailValue(coordinatorForm.email);
    if (!isValidEmailValue(normalizedEmail)) {
      applyFeedback('error', 'Ingresa un correo electrónico válido.');
      return;
    }

    setSaving(true);
    try {
      const editingCoordinatorId = Number(coordinatorLookup.result?.id || 0);

      if (editingCoordinatorId > 0) {
        const updated = await updateAdminCoordinator(editingCoordinatorId, {
          ...coordinatorForm,
          email: normalizedEmail,
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
          email: normalizedEmail,
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

  const handleInactivateCoordinator = () => {
    const editingCoordinatorId = Number(coordinatorLookup.result?.id || 0);
    if (editingCoordinatorId <= 0 || coordinatorLookup.result?.isActive === false) {
      return;
    }

    Alert.alert(
      'Inactivar coordinador',
      'Este coordinador dejará de iniciar sesión y de estar disponible para asignaciones. El registro NO se borra.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Inactivar',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              const updated = await inactivateAdminCoordinator(editingCoordinatorId, { actorUserId: user?.id });
              setLists((current) => ({
                clients: current.clients,
                coordinators: current.coordinators.map((coordinator) => (Number(coordinator.id) === editingCoordinatorId ? updated : coordinator)),
                staff: current.staff,
              }));
              setCoordinatorForm(buildCoordinatorFormFromRecord(updated));
              setCoordinatorLookup({
                status: 'exists',
                message: 'Coordinador inactivado. Conservamos la ficha y la auditoría, pero ya no puede operar ni asignarse.',
                result: updated,
                auditLogs: Array.isArray(updated.auditLogs) ? updated.auditLogs : [],
                searchedValue: updated.cedula || coordinatorLookup.searchedValue,
              });
              applyFeedback('success', 'Coordinador inactivado correctamente.');
            } catch (error) {
              applyFeedback('error', typeof error === 'string' ? error : 'No se pudo inactivar el coordinador.');
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
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
        message: 'Primero ingresa una cédula para verificar.',
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
        setStaffPhotoDraft(null);
        setStaffLookup({
          status: 'exists',
          message: 'Esa persona de staff ya existe. Ahora estás en modo de edición para actualizar cualquier dato recuperado.',
          result: response.staff,
          auditLogs: Array.isArray(response.auditLogs) ? response.auditLogs : [],
          searchedValue: cedula,
        });
        applyFeedback('success', 'Staff recuperado. Puedes editarlo o cancelar para volver al modo de alta.');
        return;
      }

      setStaffForm((current) => ({ ...current, cedula }));
      setStaffLookup({
        status: 'not-found',
        message: 'No encontramos staff con esa cédula. Puedes continuar con el alta.',
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

  const handlePickStaffPhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permiso requerido', 'Necesitas habilitar la galería para seleccionar una foto de staff.');
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

      if (fileSize && fileSize > MAX_ADMIN_STAFF_PHOTO_SIZE_BYTES) {
        Alert.alert('Archivo demasiado grande', 'La foto supera el límite de 10 MB.');
        return;
      }

      const uri = asset.base64 ? `data:${mimeType};base64,${asset.base64}` : asset.uri;

      setStaffPhotoDraft({
        uri,
        mimeType,
        fileSize,
        fileName: asset.fileName || null,
        source: 'admin',
      });
      applyFeedback('success', 'Foto lista para guardar con el alta de staff.');
    } catch (error) {
      Alert.alert('Error', 'No se pudo seleccionar la foto ahora.');
    }
  };

  const handleClearStaffPhotoDraft = () => {
    setStaffPhotoDraft(null);
    applyFeedback('success', isEditingStaff ? 'Se descartó el cambio de foto pendiente.' : 'Se quitó la foto seleccionada.');
  };

  const handleStaffSexoChange = (sexo) => {
    setStaffForm((current) => ({
      ...current,
      sexo,
      busto: sexo === 'mujer' ? current.busto : '',
      cintura: sexo === 'mujer' ? current.cintura : '',
      cadera: sexo === 'mujer' ? current.cadera : '',
    }));
  };

  const handleStaffMeasurementChange = (field, value) => {
    const normalizedValue = String(value || '').replace(/[^\d.,]/g, '').slice(0, 6);
    setStaffForm((current) => ({ ...current, [field]: normalizedValue }));
  };

  const submitStaff = async () => {
    const validationMessage = getStaffValidationMessage(staffForm);
    if (validationMessage) {
      applyFeedback('error', validationMessage);
      return;
    }

    setSaving(true);
    try {
      const editingStaffId = Number(staffLookup.result?.id || 0);

      if (editingStaffId > 0) {
        const updated = await updateAdminStaff(editingStaffId, {
          ...staffForm,
          actorUserId: user?.id,
          ...(staffPhotoDraft ? { photo: staffPhotoDraft } : {}),
        });
        setLists((current) => ({
          clients: current.clients,
          coordinators: current.coordinators,
          staff: current.staff.map((staffMember) => (Number(staffMember.id) === editingStaffId ? updated : staffMember)),
        }));
        setStaffForm(buildStaffFormFromRecord(updated));
        setStaffPhotoDraft(null);
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
          ...(staffPhotoDraft ? { photo: staffPhotoDraft } : {}),
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

  const handleInactivateStaff = () => {
    const editingStaffId = Number(staffLookup.result?.id || 0);
    if (editingStaffId <= 0 || staffLookup.result?.isActive === false) {
      return;
    }

    Alert.alert(
      'Inactivar staff',
      'Esta persona dejará de aparecer para asignaciones activas. El registro NO se borra.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Inactivar',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              const updated = await inactivateAdminStaff(editingStaffId, { actorUserId: user?.id });
              setLists((current) => ({
                clients: current.clients,
                coordinators: current.coordinators,
                staff: current.staff.map((staffMember) => (Number(staffMember.id) === editingStaffId ? updated : staffMember)),
              }));
              setStaffForm(buildStaffFormFromRecord(updated));
              setStaffPhotoDraft(null);
              setStaffLookup({
                status: 'exists',
                message: 'Staff inactivado. Conservamos la ficha y la trazabilidad, pero deja de estar disponible operativamente.',
                result: updated,
                auditLogs: Array.isArray(updated.auditLogs) ? updated.auditLogs : [],
                searchedValue: updated.cedula || staffLookup.searchedValue,
              });
              applyFeedback('success', 'Staff inactivado correctamente.');
            } catch (error) {
              applyFeedback('error', typeof error === 'string' ? error : 'No se pudo inactivar el staff.');
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  const renderClientTab = () => (
    <View style={styles.tabContent}>
      <SurfaceCard style={styles.formCard}>
        <View style={styles.searchHeader}>
          <Text style={styles.cardTitle}>{isEditingClient ? 'Edición de cliente' : 'Alta de cliente'}</Text>
          <StatusBadge label={isEditingClient ? 'Modo actualización' : 'Modo alta'} tone={isEditingClient ? 'warning' : 'info'} />
        </View>
        <Text style={styles.helperText}>{isEditingClient ? 'Estás editando un cliente existente. Puedes actualizar cualquier dato recuperado y dejar trazabilidad del cambio.' : 'Comienza por el NIT. Lo verificamos y, si ya existe, autocompletamos la ficha. En alta, todos los campos visibles son obligatorios.'}</Text>
        <View style={styles.lookupRow}>
          <View style={styles.lookupInputWrap}>
            <InputRow label={`NIT${!isEditingClient ? ' *' : ''}`} value={clientForm.nit} onChangeText={handleNitChange} placeholder="900123456 o 900123456-7" />
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
                <StatusBadge label={getEntityStatusLabel(clientLookup.result)} tone={getEntityStatusTone(clientLookup.result)} />
                <Text style={styles.listTitle}>{clientLookup.result.razonSocial || clientLookup.result.fullName}</Text>
                <Text style={styles.listMeta}>{clientLookup.result.contactFullName}{clientLookup.result.contactRole ? ` · ${clientLookup.result.contactRole}` : ''}</Text>
                <Text style={styles.listMeta}>@{clientLookup.result.username}{clientLookup.result.nit ? ` · NIT ${clientLookup.result.nit}` : ''}</Text>
                <Text style={styles.listMeta}>{clientLookup.result.email || clientLookup.result.phone || 'Sin dato adicional'}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        {isEditingClient && clientLookup.result?.isActive === false ? (
          <View style={styles.inlineNotice}>
            <Text style={styles.inlineNoticeText}>Este cliente está INACTIVO. Conserva historial y auditoría, pero no puede autenticarse ni entrar a flujos operativos.</Text>
          </View>
        ) : null}
        <InputRow label={`Razón social${!isEditingClient ? ' *' : ''}`} value={clientForm.razonSocial} onChangeText={(value) => setClientForm((current) => ({ ...current, razonSocial: value }))} placeholder="Empresa SAS" />
        <InputRow label={`Nombre del contacto${!isEditingClient ? ' *' : ''}`} value={clientForm.contactFullName} onChangeText={(value) => setClientForm((current) => ({ ...current, contactFullName: value }))} placeholder="Nombre y apellido" />
        <InputRow label={`Cargo del contacto${!isEditingClient ? ' *' : ''}`} value={clientForm.contactRole} onChangeText={(value) => setClientForm((current) => ({ ...current, contactRole: value }))} placeholder="Brand Manager" />
        <InputRow label={`Número Celular${!isEditingClient ? ' *' : ''}`} value={clientForm.phone} onChangeText={(value) => handleClientPhoneChange('phone', value)} placeholder="3001234567" keyboardType="number-pad" maxLength={10} />
        <InputRow label={`WhatsApp${!isEditingClient ? ' *' : ''}`} value={clientForm.whatsappPhone} onChangeText={(value) => handleClientPhoneChange('whatsappPhone', value)} placeholder="3001234567" keyboardType="number-pad" maxLength={10} />
        <InputRow label={`Email${!isEditingClient ? ' *' : ''}`} value={clientForm.email} onChangeText={(value) => setClientForm((current) => ({ ...current, email: normalizeEmailValue(value) }))} placeholder="cliente@empresa.com" keyboardType="email-address" />
        <InputRow label={`Usuario${!isEditingClient ? ' *' : ''}`} value={clientForm.username} onChangeText={(value) => setClientForm((current) => ({ ...current, username: value }))} placeholder="cliente.nuevo" />
        {!isEditingClient ? (
          <InputRow label="Contraseña *" value={clientForm.password} onChangeText={(value) => setClientForm((current) => ({ ...current, password: value }))} placeholder="mínimo 8 caracteres" />
        ) : (
          <View style={styles.inlineNotice}>
            <Text style={styles.inlineNoticeText}>La contraseña no se cambia desde esta ficha. Esa acción pertenece al usuario autenticado en su bloque de perfil.</Text>
          </View>
        )}
        <View style={styles.formActionsRow}>
          {isEditingClient ? <AppButton title="CANCELAR" variant="secondary" style={styles.formActionButton} onPress={resetClientForm} disabled={saving} /> : null}
          <AppButton title={saving ? 'GUARDANDO...' : isEditingClient ? 'ACTUALIZAR' : 'CREAR CLIENTE'} style={styles.formActionButton} onPress={submitClient} disabled={saving} />
        </View>
        {isEditingClient ? (
          <AppButton
            title={clientLookup.result?.isActive === false ? 'CLIENTE INACTIVO' : 'INACTIVAR CLIENTE'}
            variant="secondary"
            style={styles.inactivateButton}
            onPress={handleInactivateClient}
            disabled={saving || clientLookup.result?.isActive === false}
          />
        ) : null}
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
              <StatusBadge label={getEntityStatusLabel(clientLookup.result)} tone={getEntityStatusTone(clientLookup.result)} />
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
                  <Text style={styles.auditItemTitle}>{getAuditActionLabel(auditLog)}</Text>
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
        <Text style={styles.helperText}>{isEditingCoordinator ? 'Estás editando un coordinador existente. Puedes actualizar cualquier dato recuperado y dejar trazabilidad del cambio.' : 'Comienza por la cédula. La verificamos y, si ya existe, autocompletamos la ficha. En alta, todos los campos visibles son obligatorios.'}</Text>
        <View style={styles.lookupRow}>
          <View style={styles.lookupInputWrap}>
            <InputRow label={`Cédula${!isEditingCoordinator ? ' *' : ''}`} value={coordinatorForm.cedula} onChangeText={handleCoordinatorCedulaChange} placeholder="Documento" />
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
                <StatusBadge label={getEntityStatusLabel(coordinatorLookup.result)} tone={getEntityStatusTone(coordinatorLookup.result)} />
                <Text style={styles.listTitle}>{coordinatorLookup.result.fullName}</Text>
                <Text style={styles.listMeta}>{coordinatorLookup.result.city} · {coordinatorLookup.result.cedula}</Text>
                <Text style={styles.listMeta}>{coordinatorLookup.result.username ? `@${coordinatorLookup.result.username}` : 'Sin usuario vinculado'}</Text>
                <Text style={styles.listMeta}>{coordinatorLookup.result.email || coordinatorLookup.result.phone || 'Sin dato adicional'}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        {isEditingCoordinator && coordinatorLookup.result?.isActive === false ? (
          <View style={styles.inlineNotice}>
            <Text style={styles.inlineNoticeText}>Este coordinador está INACTIVO. Conserva su historial, pero ya no puede autenticarse ni ser asignado.</Text>
          </View>
        ) : null}
        <InputRow label={`Nombre completo${!isEditingCoordinator ? ' *' : ''}`} value={coordinatorForm.fullName} onChangeText={(value) => setCoordinatorForm((current) => ({ ...current, fullName: value }))} placeholder="Nombre y apellido" />
        <InputRow label={`Dirección${!isEditingCoordinator ? ' *' : ''}`} value={coordinatorForm.address} onChangeText={(value) => setCoordinatorForm((current) => ({ ...current, address: value }))} placeholder="Dirección operativa" multiline />
        <InputRow label={`Teléfono${!isEditingCoordinator ? ' *' : ''}`} value={coordinatorForm.phone} onChangeText={(value) => handleCoordinatorPhoneChange('phone', value)} placeholder="3001234567" keyboardType="number-pad" maxLength={10} />
        <InputRow label={`WhatsApp${!isEditingCoordinator ? ' *' : ''}`} value={coordinatorForm.whatsappPhone} onChangeText={(value) => handleCoordinatorPhoneChange('whatsappPhone', value)} placeholder="3001234567" editable={canEditCoordinatorUserFields} keyboardType="number-pad" maxLength={10} />
        <InputRow label={`Email${!isEditingCoordinator ? ' *' : ''}`} value={coordinatorForm.email} onChangeText={(value) => setCoordinatorForm((current) => ({ ...current, email: normalizeEmailValue(value) }))} placeholder="coord@eventapp.local" editable={canEditCoordinatorUserFields} keyboardType="email-address" />
        <InputRow label={`Ciudad${!isEditingCoordinator ? ' *' : ''}`} value={coordinatorForm.city} onPress={() => openCityPicker('coordinator')} placeholder="Seleccionar ciudad" />
        <InputRow label={`Usuario${!isEditingCoordinator ? ' *' : ''}`} value={coordinatorForm.username} onChangeText={(value) => setCoordinatorForm((current) => ({ ...current, username: value }))} placeholder="coord.nuevo" editable={canEditCoordinatorUserFields} />
        {isEditingCoordinator && !canEditCoordinatorUserFields ? (
          <View style={styles.inlineNotice}>
            <Text style={styles.inlineNoticeText}>Este coordinador no tiene usuario vinculado. Desde esta edición sólo actualizás su ficha operativa; credenciales y contacto autenticado siguen fuera de alcance.</Text>
          </View>
        ) : null}
        {!isEditingCoordinator ? (
          <InputRow label="Contraseña *" value={coordinatorForm.password} onChangeText={(value) => setCoordinatorForm((current) => ({ ...current, password: value }))} placeholder="mínimo 8 caracteres" />
        ) : (
          <View style={styles.inlineNotice}>
            <Text style={styles.inlineNoticeText}>La contraseña no se cambia desde esta ficha. Esa acción pertenece al usuario autenticado en su bloque de perfil.</Text>
          </View>
        )}
        <View style={styles.formActionsRow}>
          {isEditingCoordinator ? <AppButton title="CANCELAR" variant="secondary" style={styles.formActionButton} onPress={resetCoordinatorForm} disabled={saving} /> : null}
          <AppButton title={saving ? 'GUARDANDO...' : isEditingCoordinator ? 'ACTUALIZAR' : 'CREAR COORDINADOR'} style={styles.formActionButton} onPress={submitCoordinator} disabled={saving} />
        </View>
        {isEditingCoordinator ? (
          <AppButton
            title={coordinatorLookup.result?.isActive === false ? 'COORDINADOR INACTIVO' : 'INACTIVAR COORDINADOR'}
            variant="secondary"
            style={styles.inactivateButton}
            onPress={handleInactivateCoordinator}
            disabled={saving || coordinatorLookup.result?.isActive === false}
          />
        ) : null}
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
              <StatusBadge label={getEntityStatusLabel(coordinatorLookup.result)} tone={getEntityStatusTone(coordinatorLookup.result)} />
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
        <Text style={styles.helperText}>{isEditingStaff ? 'Estás editando una persona de staff existente. Puedes actualizar cualquier dato recuperado y dejar trazabilidad del cambio.' : 'Comienza por la cédula. La verificamos y, si ya existe, autocompletamos la ficha.'}</Text>
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
                <StatusBadge label={getEntityStatusLabel(staffLookup.result)} tone={getEntityStatusTone(staffLookup.result)} />
                <Text style={styles.listTitle}>{staffLookup.result.fullName}</Text>
                <Text style={styles.listMeta}>{staffLookup.result.city} · {staffLookup.result.category}</Text>
                <Text style={styles.listMeta}>{staffLookup.result.cedula} · Sexo: {staffLookup.result.sexo || 'Sin dato'}</Text>
                <Text style={styles.listMeta}>{getStaffSizeSummary(staffLookup.result)}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        {isEditingStaff && staffLookup.result?.isActive === false ? (
          <View style={styles.inlineNotice}>
            <Text style={styles.inlineNoticeText}>Esta persona de staff está INACTIVA. Conserva la ficha y la auditoría, pero deja de figurar para asignaciones activas.</Text>
          </View>
        ) : null}
        <View style={styles.photoCard}>
          <Text style={styles.photoCardTitle}>Foto de perfil opcional</Text>
          <Pressable style={styles.photoPreviewShell} onPress={handlePickStaffPhoto}>
            {staffPhotoPreviewUri ? (
              <Image source={{ uri: staffPhotoPreviewUri }} style={styles.photoPreviewImage} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Text style={styles.photoPlaceholderText}>SIN FOTO</Text>
              </View>
            )}
          </Pressable>
          <Text style={styles.photoHelperText}>
            {staffPhotoDraft
              ? 'Vista previa lista. Se va a guardar en forma persistente cuando confirmes el alta o la actualización.'
              : isEditingStaff
                ? 'Si quieres reemplazar la foto actual, elige otra imagen. Si no haces cambios, se conserva la existente.'
                : 'Puedes agregar una foto ahora, verla antes de guardar y quitarla si cambias de idea.'}
          </Text>
          <View style={styles.photoActionsRow}>
            <AppButton title={staffPhotoPreviewUri ? 'CAMBIAR FOTO' : 'SELECCIONAR FOTO'} style={styles.photoActionButton} onPress={handlePickStaffPhoto} disabled={saving} />
            {staffPhotoDraft ? (
              <AppButton title="QUITAR" variant="secondary" style={styles.photoActionButton} onPress={handleClearStaffPhotoDraft} disabled={saving} />
            ) : null}
          </View>
        </View>
        <InputRow label="Nombre completo" value={staffForm.fullName} onChangeText={(value) => setStaffForm((current) => ({ ...current, fullName: value }))} placeholder="Nombre y apellido" />
        <InputRow label="Ciudad" value={staffForm.city} onPress={() => openCityPicker('staff')} placeholder="Seleccionar ciudad" />
        <InputRow label="Categoría" value={staffForm.category} onPress={openCategoryPicker} placeholder="Buscar o crear categoría" />
        <Text style={styles.categoryHelperText}>Usamos un catálogo administrable: buscas la categoría y, si no existe, la creas desde el mismo flujo.</Text>
        <View style={stylesShared.fieldWrap}>
          <Text style={stylesShared.fieldLabel}>Sexo</Text>
          <View style={styles.segmentedRow}>
            {STAFF_SEXO_OPTIONS.map((option) => {
              const isSelected = staffForm.sexo === option.value;
              return (
                <Pressable key={option.value} style={[styles.segmentedButton, isSelected ? styles.segmentedButtonActive : null]} onPress={() => handleStaffSexoChange(option.value)}>
                  <Text style={[styles.segmentedButtonText, isSelected ? styles.segmentedButtonTextActive : null]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <InputRow label="Talla de camisa" value={staffForm.shirtSize} onChangeText={(value) => setStaffForm((current) => ({ ...current, shirtSize: normalizeStaffSizeInputValue(value) }))} placeholder="S, M, L..." />
        <InputRow label="Talla de pantalón" value={staffForm.pantsSize} onChangeText={(value) => setStaffForm((current) => ({ ...current, pantsSize: normalizeStaffSizeInputValue(value) }))} placeholder="S, M, L..." />
        <InputRow label="Talla de calzado" value={staffForm.shoeSize} onChangeText={(value) => setStaffForm((current) => ({ ...current, shoeSize: value }))} placeholder="36, 37, 38..." />
        {shouldRequestDetailedMeasurements ? (
          <>
            <InputRow label="Busto" value={staffForm.busto} onChangeText={(value) => handleStaffMeasurementChange('busto', value)} placeholder="90" keyboardType="decimal-pad" maxLength={6} />
            <InputRow label="Cintura" value={staffForm.cintura} onChangeText={(value) => handleStaffMeasurementChange('cintura', value)} placeholder="60" keyboardType="decimal-pad" maxLength={6} />
            <InputRow label="Cadera" value={staffForm.cadera} onChangeText={(value) => handleStaffMeasurementChange('cadera', value)} placeholder="90" keyboardType="decimal-pad" maxLength={6} />
          </>
        ) : (
          <View style={styles.inlineNotice}>
            <Text style={styles.inlineNoticeText}>Las medidas detalladas solo se solicitan cuando el sexo es mujer.</Text>
          </View>
        )}
        <View style={styles.formActionsRow}>
          {isEditingStaff ? <AppButton title="CANCELAR" variant="secondary" style={styles.formActionButton} onPress={resetStaffForm} disabled={saving} /> : null}
          <AppButton title={saving ? 'GUARDANDO...' : isEditingStaff ? 'ACTUALIZAR' : 'CREAR STAFF'} style={styles.formActionButton} onPress={submitStaff} disabled={saving} />
        </View>
        {isEditingStaff ? (
          <AppButton
            title={staffLookup.result?.isActive === false ? 'STAFF INACTIVO' : 'INACTIVAR STAFF'}
            variant="secondary"
            style={styles.inactivateButton}
            onPress={handleInactivateStaff}
            disabled={saving || staffLookup.result?.isActive === false}
          />
        ) : null}
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
              <StatusBadge label={getEntityStatusLabel(staffLookup.result)} tone={getEntityStatusTone(staffLookup.result)} />
              <Text style={styles.listTitle}>{staffLookup.result.fullName}</Text>
              <Text style={styles.listMeta}>{staffLookup.result.city} · {staffLookup.result.category}</Text>
              <Text style={styles.listMeta}>{staffLookup.result.cedula} · Sexo: {staffLookup.result.sexo || 'Sin dato'}</Text>
              <Text style={styles.listMeta}>{getStaffSizeSummary(staffLookup.result)}</Text>
              <Text style={styles.listMeta}>{staffLookup.result.sexo === 'mujer' ? `Busto ${staffLookup.result.busto || 'N/D'} · Cintura ${staffLookup.result.cintura || 'N/D'} · Cadera ${staffLookup.result.cadera || 'N/D'}` : 'Medidas detalladas no aplican para hombre.'}</Text>
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
        subtitle={`Hola, ${getUserDisplayName(user)}. Desde este panel puedes gestionar altas, actualizaciones e inactivaciones administrativas sin borrar registros y manteniendo la trazabilidad sin romper los flujos vigentes.`}
      />

      <UserProfileCard user={user} palette={palette} title="Perfil administrativo" buttonLabel="MI CONTRASEÑA" buttonVariant="primary" />

      <SurfaceCard style={styles.heroCard}>
        <View style={styles.heroBadges}>
          <StatusBadge label={`${lists.clients.length} clientes`} tone="info" />
          <StatusBadge label={`${lists.coordinators.length} coordinadores`} tone="success" />
          <StatusBadge label={`${lists.staff.length} staff`} tone="warning" />
        </View>
        <Text style={styles.cardTitle}>Control administrativo con persistencia real</Text>
        <Text style={styles.heroText}>El módulo valida duplicados por NIT o cédula, permite pasar a modo actualización con historial visible y ahora también inactiva sin borrar. Inactivos actuales: {inactiveCounts.clients} clientes, {inactiveCounts.coordinators} coordinadores y {inactiveCounts.staff} staff.</Text>
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
  segmentedRow: { flexDirection: 'row', gap: SPACING.sm },
  segmentedButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
  segmentedButtonActive: {
    borderColor: palette.primaryButton,
    backgroundColor: palette.surfaceMuted,
  },
  segmentedButtonText: { color: palette.textMuted, fontWeight: '700' },
  segmentedButtonTextActive: { color: palette.text, fontWeight: '800' },
  photoCard: {
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceMuted,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  photoCardTitle: { color: palette.text, fontWeight: '800', fontSize: 15 },
  photoPreviewShell: { alignSelf: 'center' },
  photoPreviewImage: { width: 180, height: 180, borderRadius: RADII.md, backgroundColor: '#E2E8F0' },
  photoPlaceholder: {
    width: 180,
    height: 180,
    borderRadius: RADII.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: palette.border,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: { color: palette.textMuted, fontWeight: '800' },
  photoHelperText: { color: palette.textMuted, lineHeight: 19 },
  photoActionsRow: { flexDirection: 'row', gap: SPACING.sm },
  photoActionButton: { flex: 1 },
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
  inactivateButton: { marginTop: SPACING.xs },
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
