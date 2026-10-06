import axios from 'axios';

// Detect whether to use direct backend address, configured environment URL, or local proxy
const getBaseURL = () => {
  // If explicitly configured via environment variable (e.g. on Vercel deployment)
  const envUrl = import.meta.env.VITE_API_URL || (import.meta.env.VITE_SERVER_URL ? `${import.meta.env.VITE_SERVER_URL}/api` : null);
  if (envUrl) {
    const cleanUrl = envUrl.trim().replace(/\/+$/, '');
    return cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
  }

  // Local development fallback
  return '/api';
};

const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('resqlink_token') || localStorage.getItem('token') || localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
