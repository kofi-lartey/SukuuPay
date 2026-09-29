import axios from 'axios';

/**
 * The API routes are mounted under `/api` on the server, so the prefix belongs
 * here rather than in every service path.
 *
 * This fallback is the value that actually ships: there is no committed `.env`,
 * and a deployed static build cannot set env vars at build time from a file it
 * does not have. Keep it pointing at the deployed backend.
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://sukuupay-backend.onrender.com/api';

const clearSession = () => {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('refresh_token');
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
        
        const { accessToken, refreshToken: newRefreshToken } = response.data.tokens || {};
        if (!accessToken) {
          clearSession();
          return Promise.reject(refreshError);
        }

        localStorage.setItem('auth_token', accessToken);
        if (newRefreshToken) localStorage.setItem('refresh_token', newRefreshToken);

        // Replay the original request with the NEW token. This previously read
        // an undefined `token` variable, so every retried request went out as
        // `Bearer undefined`, failed with a second 401, and dropped the user
        // out of the app instead of refreshing transparently.
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        clearSession();
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;