import apiClient from './apiClient';
import { getAssignedAvatar } from '../utils/avatar';
import { clearStoredUser, getStoredUserRaw, setStoredUserRaw } from './authPreferences';
import { clearSecureTokens, getSecureTokens, setSecureTokens } from './secureTokenStore';
import {
  clearRuntimeSession,
  getRuntimeAccessToken,
  getRuntimeRefreshToken,
  getRuntimeUserRaw,
  setRuntimeSession,
} from './sessionRuntime';

export type UserRole = 'ADMIN' | 'USER' | string;

export type AuthUser = {
  id?: string;
  name?: string;
  email: string;
  role: UserRole;
  image?: string;
  avatarUrl?: string;
  photoUrl?: string;
  profileImageDataUrl?: string;
};

type AuthPayload = {
  token: string;
  refreshToken?: string;
  user: AuthUser;
};

type LoginParams = {
  email: string;
  password: string;
};

type RegisterParams = {
  name: string;
  email: string;
  password: string;
};

const safeSetSession = async (
  token: string,
  user: AuthUser,
  options?: { persistTokens?: boolean; refreshToken?: string },
) => {
  const normalizedUser: AuthUser = {
    ...user,
    avatarUrl: getAssignedAvatar(user),
  };
  const userRaw = JSON.stringify(normalizedUser);
  setRuntimeSession({ accessToken: token, refreshToken: options?.refreshToken, userRaw });

  try {
    await setStoredUserRaw(userRaw);

    if (options?.persistTokens !== false) {
      await setSecureTokens({ accessToken: token, refreshToken: options?.refreshToken });
    } else {
      await clearSecureTokens();
    }
  } catch {
  }
};

const getAuthPayload = (data: any): AuthPayload => {
  if (data?.accessToken && data?.user) {
    return {
      token: data.accessToken,
      refreshToken: data.refreshToken,
      user: data.user,
    };
  }

  if (data?.data?.accessToken && data?.data?.user) {
    return {
      token: data.data.accessToken,
      refreshToken: data.data.refreshToken,
      user: data.data.user,
    };
  }

  if (data?.token && data?.user) {
    return { token: data.token, refreshToken: data.refreshToken, user: data.user };
  }

  if (data?.data?.token && data?.data?.user) {
    return { token: data.data.token, refreshToken: data.data.refreshToken, user: data.data.user };
  }

  throw new Error('Beklenmeyen auth response formatı.');
};

export const login = async (
  { email, password }: LoginParams,
  options?: { persistTokens?: boolean },
): Promise<AuthPayload> => {
  const response = await apiClient.post('/auth/login', { email, password });
  const authPayload = getAuthPayload(response.data);

  await safeSetSession(authPayload.token, authPayload.user, {
    persistTokens: options?.persistTokens ?? true,
    refreshToken: authPayload.refreshToken,
  });

  return authPayload;
};

export const loginWithGoogleIdToken = async (
  idToken: string,
  options?: { persistTokens?: boolean },
): Promise<AuthPayload> => {
  const response = await apiClient.post('/auth/google', { idToken });
  const authPayload = getAuthPayload(response.data);

  await safeSetSession(authPayload.token, authPayload.user, {
    persistTokens: options?.persistTokens ?? true,
    refreshToken: authPayload.refreshToken,
  });

  return authPayload;
};

export const register = async (
  { name, email, password }: RegisterParams,
  options?: { persistTokens?: boolean },
): Promise<AuthPayload> => {
  const response = await apiClient.post('/auth/register', {
    name,
    email,
    password,
    avatarUrl: getAssignedAvatar({ email, name }),
  });

  try {
    const authPayload = getAuthPayload(response.data);
    await safeSetSession(authPayload.token, authPayload.user, {
      persistTokens: options?.persistTokens ?? true,
      refreshToken: authPayload.refreshToken,
    });
    return authPayload;
  } catch {
    return login({ email, password }, { persistTokens: options?.persistTokens ?? true });
  }
};

export const getStoredSession = async (): Promise<AuthPayload | null> => {
  let token = getRuntimeAccessToken() ?? null;
  let refreshToken = getRuntimeRefreshToken() ?? null;
  let userRaw = getRuntimeUserRaw() ?? null;

  if (!token) {
    try {
      const secure = await getSecureTokens();
      token = secure?.accessToken || null;
      refreshToken = secure?.refreshToken || null;
    } catch {
      token = getRuntimeAccessToken() ?? null;
      refreshToken = getRuntimeRefreshToken() ?? null;
    }
  }

  if (!userRaw) {
    try {
      userRaw = await getStoredUserRaw();
    } catch {
      userRaw = getRuntimeUserRaw() ?? null;
    }
  }

  if (!token || !userRaw) {
    return null;
  }

  try {
    const user = JSON.parse(userRaw) as AuthUser;
    return { token, refreshToken: refreshToken || undefined, user };
  } catch {
    return null;
  }
};

export const setStoredUser = async (nextUser: AuthUser) => {
  const session = await getStoredSession();
  if (!session) {
    return;
  }

  await safeSetSession(session.token, nextUser, { persistTokens: true, refreshToken: session.refreshToken });
};

export const refreshSessionRequest = async (refreshToken: string): Promise<{ token: string; refreshToken?: string }> => {
  const response = await apiClient.post('/auth/refresh', { refreshToken });
  const data = response?.data?.data || response?.data || {};
  return {
    token: data?.accessToken || data?.token,
    refreshToken: data?.refreshToken || refreshToken,
  };
};

export const logout = async () => {
  clearRuntimeSession();

  try {
    await clearSecureTokens();
    await clearStoredUser();
  } catch {
  }
};
