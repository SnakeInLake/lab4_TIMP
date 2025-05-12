// src/services/api.ts
import axios from 'axios'; // Импорт значения (axios)
import type { AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios'; // Импорт типов

const API_URL = 'http://127.0.0.1:8000/api/v1';

export const UNAUTHORIZED_EVENT = 'unauthorized'; // Имя события

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Интерсептор запроса
apiClient.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers.set('Authorization', `Bearer ${token}`);
      }
      return config;
    },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error: AxiosError) => {
    if (error.response) {
      console.error('API Error Response:', error.response.data);
      console.error('Status Code:', error.response.status);

      if (error.response.status === 401) {
        localStorage.removeItem('accessToken');
        console.warn("Unauthorized! Dispatching 'unauthorized' event.");
        // --- Диспатчим кастомное событие ---
        window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
      }
    } else if (error.request) {
      console.error('Network Error:', error.request);
    } else {
      console.error('Error', error.message);
    }
    return Promise.reject(error);
  }
);

export default apiClient;