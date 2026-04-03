import axios from 'axios';

// Singleton for API URL Management
let apiInstance = null;
const DEFAULT_API_URL = 'http://localhost:3001/api';
let currentBaseUrl = process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL;

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
    throw error.response?.data?.message || 'No se pudo conectar con el servicio';
  }
};

export const getAppConfig = async () => (await getAPI().get('/app-config')).data;
export const getEvents = async (createdByUserId) => (await getAPI().get('/events', { params: { createdByUserId } })).data;
export const getCoordinatorEvents = async (userId) => (await getAPI().get('/coordinator/events', { params: { userId } })).data;
export const getClientEvents = async (userId) => (await getAPI().get('/client/events', { params: { userId } })).data;
export const getClients = async () => (await getAPI().get('/clients')).data;
export const getCoordinators = async (params = {}) => (await getAPI().get('/coordinators', { params })).data;
export const getStaff = async (params = {}) => (await getAPI().get('/staff', { params })).data;
export const getColombiaCities = async () => (await getAPI().get('/colombia-cities')).data;
export const addColombiaCity = async (name) => (await getAPI().post('/colombia-cities', { name })).data;
export const createEvent = async (data) => (await getAPI().post('/events', data)).data;
export const updateEvent = async (id, data) => (await getAPI().put(`/events/${id}`, data)).data;
export const inactivateEvent = async (id, data) => (await getAPI().post(`/events/${id}/inactivate`, data)).data;
export const addCoordinatorEventPhoto = async (id, data) => (await getAPI().post(`/events/${id}/photos`, data)).data;
export const addCoordinatorEventReport = async (id, data) => (await getAPI().post(`/events/${id}/reports`, data)).data;
export const saveExecutiveEventReport = async (id, data) => (await getAPI().put(`/events/${id}/executive-report`, data)).data;
