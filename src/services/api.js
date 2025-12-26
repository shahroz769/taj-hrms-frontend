import axios from "axios";
import { store } from "@/redux/store";
import { login, logout } from "@/redux/slices/authSlice";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

// Flag to prevent multiple refresh requests
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request interceptor - Add auth token to requests
API.interceptors.request.use(
  (config) => {
    const token = store.getState().auth.accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle token refresh on 401
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If error is not 401 or request already retried, reject
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // If already refreshing, queue the request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return API(originalRequest);
        })
        .catch((err) => {
          return Promise.reject(err);
        });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      // Call refresh token endpoint
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/auth/refresh`,
        {},
        { withCredentials: true }
      );

      const { accessToken, user } = response.data;

      // Update token in store
      store.dispatch(login({ accessToken, user }));

      // Process queued requests
      processQueue(null, accessToken);

      // Retry original request with new token
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return API(originalRequest);
    } catch (refreshError) {
      // Refresh failed - logout user
      processQueue(refreshError, null);
      store.dispatch(logout());
      
      // Optionally redirect to login
      window.location.href = "/login";
      
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default API;
