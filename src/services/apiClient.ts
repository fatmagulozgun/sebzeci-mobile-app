import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from 'react-native-config';
import { getSecureTokens } from './secureTokenStore';
import { getRuntimeAccessToken, getRuntimeRefreshToken, setRuntimeSession } from './sessionRuntime';
import { clearSecureTokens, setSecureTokens } from './secureTokenStore';

export const AUTH_TOKEN_KEY = 'auth_token';

export const API_BASE_URL = Config.API_BASE_URL || 'http://10.0.2.2:5000/api';
export const WEB_APP_BASE_URL = Config.WEB_APP_BASE_URL || 'http://10.0.2.2:5173';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

let authFailureHandler: (() => Promise<void> | void) | null = null;
let refreshPromise: Promise<string | null> | null = null;

type RetriableConfig = {
  _retry?: boolean;
  headers?: Record<string, any>;
  url?: string;
};

const AUTH_EXCLUDED_PATHS = ['/auth/login', '/auth/register', '/auth/google', '/auth/refresh'];

export function registerAuthFailureHandler(handler: (() => Promise<void> | void) | null) {
  authFailureHandler = handler;
}

function shouldSkipRefresh(url?: string) {
  if (!url) return false;
  return AUTH_EXCLUDED_PATHS.some(path => url.includes(path));
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const secureTokens = await getSecureTokens();
    const refreshToken = getRuntimeRefreshToken() || secureTokens?.refreshToken || null;

    if (!refreshToken) {
      return null;
    }

    const response = await refreshClient.post('/auth/refresh', { refreshToken });
    const data = response?.data?.data || response?.data || {};
    const nextAccessToken = data?.accessToken || data?.token;
    const nextRefreshToken = data?.refreshToken || refreshToken;

    if (!nextAccessToken) {
      return null;
    }

    setRuntimeSession({
      accessToken: nextAccessToken,
      refreshToken: nextRefreshToken,
    });
    await setSecureTokens({ accessToken: nextAccessToken, refreshToken: nextRefreshToken });
    return nextAccessToken;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

apiClient.interceptors.request.use(async config => {
  let token: string | null = getRuntimeAccessToken() || null;

  if (!token) {
    try {
      token = (await getSecureTokens())?.accessToken || null;
    } catch {
      token = null;
    }
  }

  if (!token) {
    try {
      token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    } catch {
      token = null;
    }
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = (error?.config || {}) as RetriableConfig;
    const status = Number(error?.response?.status || 0);
    const isUnauthorized = status === 401;

    if (!isUnauthorized || originalRequest._retry || shouldSkipRefresh(originalRequest.url)) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const nextToken = await refreshAccessToken();
      if (!nextToken) {
        throw new Error('Refresh token unavailable');
      }

      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${nextToken}`;
      return apiClient(originalRequest as any);
    } catch (refreshError) {
      await clearSecureTokens();
      setRuntimeSession({ accessToken: undefined, refreshToken: undefined, userRaw: undefined });
      if (authFailureHandler) {
        await authFailureHandler();
      }
      return Promise.reject(refreshError);
    }
  },
);

export default apiClient;
