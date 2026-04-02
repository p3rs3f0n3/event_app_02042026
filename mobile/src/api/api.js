import axios from 'axios';

// Singleton for API URL Management
let apiInstance = null;
let currentBaseUrl = 'http://192.168.20.35:3001/api';

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
  console.log('📡 API URL updated to:', currentBaseUrl);
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
    throw error.response?.data?.message || 'Falla de conexión: Verifique IP del servidor';
  }
};

export const getAppConfig = async () => (await getAPI().get('/app-config')).data;
export const getEvents = async (createdByUserId) => (await getAPI().get('/events', { params: { createdByUserId } })).data;
export const getCoordinators = async (params = {}) => (await getAPI().get('/coordinators', { params })).data;
export const getStaff = async (params = {}) => (await getAPI().get('/staff', { params })).data;
export const getColombiaCities = async () => (await getAPI().get('/colombia-cities')).data;
export const addColombiaCity = async (name) => (await getAPI().post('/colombia-cities', { name })).data;
export const createEvent = async (data) => (await getAPI().post('/events', data)).data;
export const updateEvent = async (id, data) => (await getAPI().put(`/events/${id}`, data)).data;
export const inactivateEvent = async (id, data) => (await getAPI().post(`/events/${id}/inactivate`, data)).data;
