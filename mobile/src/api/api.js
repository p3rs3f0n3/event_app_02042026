import axios from 'axios';

// Singleton for API URL Management
let apiInstance = null;
let currentBaseUrl = process.env.EXPO_PUBLIC_API_URL || '';

const extractApiErrorMessage = (error) => {
  const responseMessage = error?.response?.data?.message;
  if (responseMessage) {
    return responseMessage;
  }

  if (error?.message) {
    return error.message;
  }

  return 'No se pudo conectar con el servicio';
};

const withApiErrorHandling = async (request) => {
  try {
    return await request();
  } catch (error) {
    throw extractApiErrorMessage(error);
  }
};

const getAPI = () => {
  if (!apiInstance) {
    apiInstance = axios.create({ baseURL: currentBaseUrl });
  }
  return apiInstance;
};

// Update URL dynamically from the UI
export const setBaseUrl = (newUrl) => {
  currentBaseUrl = newUrl;
  apiInstance = axios.create({ baseURL: currentBaseUrl });
};

export const getBaseUrl = () => currentBaseUrl;

// API methods using the singleton
export const login = async (username, password) => {
  try {
    const res = await getAPI().post('/login', { username, password });
    return {
      ...res.data,
      username: res.data?.username || username,
    };
  } catch (error) {
    throw extractApiErrorMessage(error);
  }
};

export const changePassword = async ({ userId, currentPassword, newPassword }) => {
  try {
    return (await getAPI().post('/change-password', { userId, currentPassword, newPassword })).data;
  } catch (error) {
    throw extractApiErrorMessage(error);
  }
};

export const getAppConfig = async () => (await getAPI().get('/app-config')).data;
export const getEvents = async (createdByUserId) => (await getAPI().get('/events', { params: { createdByUserId } })).data;
export const getCoordinatorEvents = async (userId) => (await getAPI().get('/coordinator/events', { params: { userId } })).data;
export const getClientEvents = async (userId) => (await getAPI().get('/client/events', { params: { userId } })).data;
export const getClients = async (params = {}) => (await getAPI().get('/clients', { params })).data;
export const getAdminClients = async () => withApiErrorHandling(async () => (await getAPI().get('/admin/clients')).data);
export const findAdminClientByNit = async (nit) => withApiErrorHandling(async () => (await getAPI().get('/admin/clients/by-nit', { params: { nit } })).data);
export const createAdminClient = async (data) => withApiErrorHandling(async () => (await getAPI().post('/admin/clients', data)).data);
export const updateAdminClient = async (id, data) => withApiErrorHandling(async () => (await getAPI().put(`/admin/clients/${id}`, data)).data);
export const inactivateAdminClient = async (id, data) => withApiErrorHandling(async () => (await getAPI().post(`/admin/clients/${id}/inactivate`, data)).data);
export const getCoordinators = async (params = {}) => (await getAPI().get('/coordinators', { params })).data;
export const getAdminCoordinators = async () => withApiErrorHandling(async () => (await getAPI().get('/admin/coordinators')).data);
export const findAdminCoordinatorByCedula = async (cedula) => withApiErrorHandling(async () => (await getAPI().get('/admin/coordinators/by-cedula', { params: { cedula } })).data);
export const createAdminCoordinator = async (data) => withApiErrorHandling(async () => (await getAPI().post('/admin/coordinators', data)).data);
export const updateAdminCoordinator = async (id, data) => withApiErrorHandling(async () => (await getAPI().put(`/admin/coordinators/${id}`, data)).data);
export const inactivateAdminCoordinator = async (id, data) => withApiErrorHandling(async () => (await getAPI().post(`/admin/coordinators/${id}/inactivate`, data)).data);
export const getStaff = async (params = {}) => (await getAPI().get('/staff', { params })).data;
export const getStaffCategories = async (params = {}) => (await getAPI().get('/staff-categories', { params })).data;
export const getAdminStaff = async () => withApiErrorHandling(async () => (await getAPI().get('/admin/staff')).data);
export const findAdminStaffByCedula = async (cedula) => withApiErrorHandling(async () => (await getAPI().get('/admin/staff/by-cedula', { params: { cedula } })).data);
export const getAdminStaffCategories = async (params = {}) => withApiErrorHandling(async () => (await getAPI().get('/admin/staff-categories', { params })).data);
export const createAdminStaffCategory = async (name) => withApiErrorHandling(async () => (await getAPI().post('/admin/staff-categories', { name })).data);
export const createAdminStaff = async (data) => withApiErrorHandling(async () => (await getAPI().post('/admin/staff', data)).data);
export const updateAdminStaff = async (id, data) => withApiErrorHandling(async () => (await getAPI().put(`/admin/staff/${id}`, data)).data);
export const inactivateAdminStaff = async (id, data) => withApiErrorHandling(async () => (await getAPI().post(`/admin/staff/${id}/inactivate`, data)).data);
export const getColombiaCities = async () => (await getAPI().get('/colombia-cities')).data;
export const addColombiaCity = async (name) => (await getAPI().post('/colombia-cities', { name })).data;
export const createEvent = async (data) => (await getAPI().post('/events', data)).data;
export const updateEvent = async (id, data) => (await getAPI().put(`/events/${id}`, data)).data;
export const inactivateEvent = async (id, data) => (await getAPI().post(`/events/${id}/inactivate`, data)).data;
export const addCoordinatorEventPhoto = async (id, data) => (await getAPI().post(`/events/${id}/photos`, data)).data;
export const addCoordinatorEventReport = async (id, data) => (await getAPI().post(`/events/${id}/reports`, data)).data;
export const saveExecutiveEventReport = async (id, data) => (await getAPI().put(`/events/${id}/executive-report`, data)).data;
