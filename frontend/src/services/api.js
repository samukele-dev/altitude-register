import axios from 'axios';

// Import Firebase modules correctly
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { app } from '../config/firebase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Initialize Firebase services
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle response errors - Auto logout on 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      console.log('🔐 Session expired. Logging out...');
      
      // Clear local storage
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Show message
      toast.error('Your session has expired. Please log in again.', {
        duration: 3000,
        icon: '🔐'
      });
      
      // Redirect to login page
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);



// Auth services
export const authService = {
  login: (credentials) => api.post('/auth/login', credentials),
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },
  getCurrentUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },
  setUser: (user) => localStorage.setItem('user', JSON.stringify(user)),
  setToken: (token) => localStorage.setItem('token', token),
};

// Employee services
export const employeeService = {
  enroll: (data) => api.post('/enrollment/enroll', data),
  getAll: (params) => api.get('/enrollment/employees', { params }),
  getById: (id) => api.get(`/enrollment/employees/${id}`),
  update: (id, data) => api.put(`/enrollment/employees/${id}`, data),
  delete: (id) => api.delete(`/enrollment/employees/${id}`),
};

// Clock services
export const clockService = {
  clockInOut: (fingerprintData) => api.post('/clock', fingerprintData),
  getTodayStatus: () => api.get('/clock/today'),
  getLiveStatus: () => api.get('/clock/live'),
  getAttendance: (params) => api.get('/clock/attendance', { params }),
  verifyEmployeeId: (employeeId) => api.post('/clock/verify-employee-id', { employeeId }),
  verifyFingerprint: (data) => api.post('/clock/verify-fingerprint', data)
};


// Report services
export const reportService = {
  generateDaily: (date) => api.get('/reports/generate', { 
    params: { date },
    responseType: 'blob'  // Important for file download
  }),
  getHistory: (limit) => api.get('/reports/history', { params: { limit } }),
  getCampaigns: () => api.get('/reports/campaigns'),
  getTeams: (campaign) => api.get('/reports/teams', { params: { campaign } }),
  sendEmail: (data) => api.post('/reports/send-email', data)
};


export { db, auth, storage };
export default api;