/**
 * Helper to dynamically resolve server and socket URLs for both local development
 * and live production deployment (e.g. Vercel frontend + Render backend).
 */
export const getServerBaseUrl = () => {
  if (import.meta.env.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL.trim().replace(/\/+$/, '');
  }
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.trim().replace(/\/api\/?$/, '').replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    if (window.location.hostname.includes('vercel.app')) {
      return 'https://resqlink-backend-4bwq.onrender.com';
    }
    if (window.location.port === '5173') {
      // Local Vite dev proxy handles /uploads and /api
      return '';
    }
    return `http://${window.location.hostname}:3000`;
  }
  return 'https://resqlink-backend-4bwq.onrender.com';
};

export const getFileUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const serverUrl = getServerBaseUrl();
  return serverUrl ? `${serverUrl}${cleanPath}` : cleanPath;
};

export const getSocketUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL.trim();
  }
  if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
    return 'https://resqlink-backend-4bwq.onrender.com';
  }
  const serverBase = getServerBaseUrl();
  if (serverBase) return serverBase;
  if (typeof window !== 'undefined') {
    if (window.location.port === '5173') return window.location.origin;
    return `http://${window.location.hostname}:3000`;
  }
  return 'https://resqlink-backend-4bwq.onrender.com';
};

