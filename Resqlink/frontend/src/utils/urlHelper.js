/**
 * Helper to dynamically format image/file upload URLs.
 * Resolves relative paths (e.g. `/uploads/...`) against `import.meta.env.VITE_SERVER_URL`
 * or returns relative paths if hosted under the same domain.
 */
export const getFileUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  // If accessing from another device (LAN IP), always use relative URL so Vite proxy serves it
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return cleanPath;
  }
  
  const serverUrl = import.meta.env.VITE_SERVER_URL || '';
  if (serverUrl && !serverUrl.includes('localhost') && !serverUrl.includes('127.0.0.1')) {
    const cleanServerUrl = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl;
    return `${cleanServerUrl}${cleanPath}`;
  }
  
  return cleanPath;
};
