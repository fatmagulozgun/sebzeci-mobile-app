import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

import apiClient, { AUTH_TOKEN_KEY, registerAuthFailureHandler } from '../services/apiClient';
import type { AuthUser } from '../services/authService';
import {
  login as loginApi,
  logout as logoutApi,
  register as registerApi,
  loginWithGoogleIdToken,
  refreshSessionRequest,
} from '../services/authService';
import { obtainGoogleIdToken } from '../services/googleSignInFlow';
import {
  getLastEmail,
  getRememberMePreference,
  getStoredUserRaw,
  setLastEmail,
  setRememberMePreference,
  setStoredUserRaw,
} from '../services/authPreferences';
import { clearSecureTokens, getSecureTokens, setSecureTokens } from '../services/secureTokenStore';
import { getRuntimeAccessToken, getRuntimeRefreshToken, getRuntimeUserRaw, setRuntimeSession } from '../services/sessionRuntime';
import { clearRememberedCredentials, setRememberedCredentials } from '../services/rememberedCredentialsStore';
import { isJwtExpired } from '../utils/jwt';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type AuthState = {
  status: AuthStatus;
  user: AuthUser | null;
  lastEmail: string;
  rememberMe: boolean;
  isInitializing: boolean;
  isRestoringSession: boolean;
  authResolved: boolean;
};

type SignInParams = {
  email: string;
  password: string;
  rememberMe: boolean;
};

type SignUpParams = {
  name: string;
  email: string;
  password: string;
  rememberMe: boolean;
};

type SignInWithGoogleParams = {
  rememberMe: boolean;
};

type AuthContextValue = AuthState & {
  login: (params: SignInParams) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  updateUser: (nextUser: AuthUser) => Promise<void>;
  signIn: (params: SignInParams) => Promise<void>;
  signUp: (params: SignUpParams) => Promise<void>;
  signInWithGoogle: (params: SignInWithGoogleParams) => Promise<void>;
  signOut: () => Promise<void>;
  refreshFromServer: () => Promise<void>;
};

const DEFAULT_REMEMBER_ME = true;

export const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

async function migrateLegacyTokenIfNeeded() {
  try {
    const existing = await getSecureTokens();
    if (existing?.accessToken) return;
    const legacy = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    if (!legacy) return;
    await setSecureTokens({ accessToken: legacy });
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: 'loading',
    user: null,
    lastEmail: '',
    rememberMe: DEFAULT_REMEMBER_ME,
    isInitializing: true,
    isRestoringSession: true,
    authResolved: false,
  });
  const restoreRunRef = React.useRef(0);

  const updateUser = useCallback(async (nextUser: AuthUser) => {
    const accessToken = getRuntimeAccessToken();
    if (!accessToken) return;
    const userRaw = JSON.stringify(nextUser);
    await setStoredUserRaw(userRaw);
    setRuntimeSession({ accessToken, refreshToken: getRuntimeRefreshToken(), userRaw });
    setState(prev => ({ ...prev, user: nextUser }));
  }, []);

  const refreshSession = useCallback(async () => {
    const runtimeRefreshToken = getRuntimeRefreshToken();
    const secure = await getSecureTokens();
    const refreshToken = runtimeRefreshToken || secure?.refreshToken;
    if (!refreshToken) {
      return false;
    }

    try {
      const refreshed = await refreshSessionRequest(refreshToken);
      if (!refreshed?.token) {
        return false;
      }
      await setSecureTokens({
        accessToken: refreshed.token,
        refreshToken: refreshed.refreshToken || refreshToken,
      });
      setRuntimeSession({
        accessToken: refreshed.token,
        refreshToken: refreshed.refreshToken || refreshToken,
        userRaw: getRuntimeUserRaw(),
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  const restoreSession = useCallback(async () => {
    const runId = ++restoreRunRef.current;
    setState(prev => ({
      ...prev,
      status: 'loading',
      isRestoringSession: true,
      isInitializing: !prev.authResolved,
      authResolved: false,
    }));
    const [rememberPref, email] = await Promise.all([getRememberMePreference(), getLastEmail()]);
    const rememberMe = rememberPref ?? DEFAULT_REMEMBER_ME;

    if (runId !== restoreRunRef.current) return;
    setState(prev => ({ ...prev, rememberMe, lastEmail: email }));

    if (rememberMe) {
      await migrateLegacyTokenIfNeeded();
    } else {
      await clearSecureTokens();
      await clearRememberedCredentials();
      try {
        await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
      } catch {
      }
    }

    const secure = rememberMe ? await getSecureTokens() : null;
    let accessToken = secure?.accessToken || null;
    const cachedUserRaw = await getStoredUserRaw();
    let cachedUser: AuthUser | null = null;
    if (cachedUserRaw) {
      try {
        cachedUser = JSON.parse(cachedUserRaw) as AuthUser;
      } catch {
        cachedUser = null;
      }
    }

    if (!accessToken && !cachedUserRaw) {
      setRuntimeSession({ accessToken: undefined, refreshToken: undefined, userRaw: undefined });
      if (runId !== restoreRunRef.current) return;
      setState(prev => ({
        ...prev,
        status: 'unauthenticated',
        user: null,
        isInitializing: false,
        isRestoringSession: false,
        authResolved: true,
      }));
      return;
    }

    if (accessToken && isJwtExpired(accessToken)) {
      const refreshed = await refreshSession();
      if (!refreshed) {
        await clearSecureTokens();
        setRuntimeSession({ accessToken: undefined, refreshToken: undefined, userRaw: undefined });
        if (runId !== restoreRunRef.current) return;
        setState(prev => ({
          ...prev,
          status: 'unauthenticated',
          user: null,
          isInitializing: false,
          isRestoringSession: false,
          authResolved: true,
        }));
        return;
      }
      accessToken = getRuntimeAccessToken() || null;
    }

    setRuntimeSession({
      accessToken: accessToken || undefined,
      refreshToken: secure?.refreshToken,
      userRaw: cachedUserRaw || undefined,
    });
    if (runId !== restoreRunRef.current) return;
    setState(prev => ({ ...prev, status: 'authenticated', user: cachedUser }));

    if (!accessToken) {
      if (runId !== restoreRunRef.current) return;
      setState(prev => ({
        ...prev,
        status: 'unauthenticated',
        user: null,
        isInitializing: false,
        isRestoringSession: false,
        authResolved: true,
      }));
      return;
    }

    try {      
      const meResponse = await apiClient.get('/auth/me');
      const serverUser = meResponse?.data?.data as AuthUser | undefined;
      if (serverUser) {
        const userRaw = JSON.stringify(serverUser);
        await setStoredUserRaw(userRaw);
        setRuntimeSession({ accessToken, refreshToken: secure?.refreshToken, userRaw });
        if (runId !== restoreRunRef.current) return;
        setState(prev => ({
          ...prev,
          status: 'authenticated',
          user: serverUser,
          isInitializing: false,
          isRestoringSession: false,
          authResolved: true,
        }));
        return;
      }
    } catch {
    }

    if (runId !== restoreRunRef.current) return;
    setState(prev => ({
      ...prev,
      status: 'authenticated',
      user: prev.user ?? cachedUser ?? null,
      isInitializing: false,
      isRestoringSession: false,
      authResolved: true,
    }));
  }, [refreshSession]);

  useEffect(() => {
    restoreSession()
      .catch(() => {
        setState(prev => ({
          ...prev,
          status: 'unauthenticated',
          user: null,
          isInitializing: false,
          isRestoringSession: false,
          authResolved: true,
        }));
      });
  }, [restoreSession]);

  const signIn = useCallback(async ({ email, password, rememberMe }: SignInParams) => {
    restoreRunRef.current += 1;
    const normalizedEmail = (email || '').trim();
    await setLastEmail(normalizedEmail);
    await setRememberMePreference(rememberMe);
    if (rememberMe) {
      await setRememberedCredentials(normalizedEmail, password);
    } else {
      await clearRememberedCredentials();
    }

    setState(prev => ({ ...prev, rememberMe, lastEmail: normalizedEmail }));

    const payload = await loginApi({ email: normalizedEmail, password }, { persistTokens: rememberMe });
    setRuntimeSession({
      accessToken: payload.token,
      refreshToken: payload.refreshToken,
      userRaw: JSON.stringify(payload.user),
    });

    setState(prev => ({
      ...prev,
      status: 'authenticated',
      user: payload.user,
      isInitializing: false,
      isRestoringSession: false,
      authResolved: true,
    }));
  }, []);

  const signUp = useCallback(async ({ name, email, password, rememberMe }: SignUpParams) => {
    restoreRunRef.current += 1;
    const normalizedEmail = (email || '').trim();
    await setLastEmail(normalizedEmail);
    await setRememberMePreference(rememberMe);
    setState(prev => ({ ...prev, rememberMe, lastEmail: normalizedEmail }));

    const payload = await registerApi(
      { name: name.trim(), email: normalizedEmail, password },
      { persistTokens: rememberMe },
    );

    setRuntimeSession({
      accessToken: payload.token,
      refreshToken: payload.refreshToken,
      userRaw: JSON.stringify(payload.user),
    });

    setState(prev => ({
      ...prev,
      status: 'authenticated',
      user: payload.user,
      isInitializing: false,
      isRestoringSession: false,
      authResolved: true,
    }));
  }, []);

  const signInWithGoogle = useCallback(async ({ rememberMe }: SignInWithGoogleParams) => {
    restoreRunRef.current += 1;
    await setRememberMePreference(rememberMe);
    if (!rememberMe) {
      await clearRememberedCredentials();
    }
    setState(prev => ({ ...prev, rememberMe }));

    const idToken = await obtainGoogleIdToken();
    const payload = await loginWithGoogleIdToken(idToken, { persistTokens: rememberMe });
    setRuntimeSession({
      accessToken: payload.token,
      refreshToken: payload.refreshToken,
      userRaw: JSON.stringify(payload.user),
    });

    setState(prev => ({
      ...prev,
      status: 'authenticated',
      user: payload.user,
      isInitializing: false,
      isRestoringSession: false,
      authResolved: true,
    }));
  }, []);

  const logout = useCallback(async () => {
    restoreRunRef.current += 1;
    const lastEmail = await getLastEmail();
    const rememberPref = await getRememberMePreference();
    const rememberMe = rememberPref ?? DEFAULT_REMEMBER_ME;
    if (!rememberMe) {
      await clearRememberedCredentials();
    }

    await logoutApi();
    try {
      await GoogleSignin.signOut();
    } catch {
    }
    setRuntimeSession({ accessToken: undefined, refreshToken: undefined, userRaw: undefined });
    setState(prev => ({
      ...prev,
      status: 'unauthenticated',
      user: null,
      lastEmail,
      rememberMe,
      isInitializing: false,
      isRestoringSession: false,
      authResolved: true,
    }));
  }, []);

  const refreshFromServer = useCallback(async () => {
    try {
      const meResponse = await apiClient.get('/auth/me');
      const serverUser = meResponse?.data?.data as AuthUser | undefined;
      if (!serverUser) return;
      await updateUser(serverUser);
    } catch {
    }
  }, [updateUser]);

  useEffect(() => {
    registerAuthFailureHandler(async () => {
      await logout();
    });
    return () => registerAuthFailureHandler(null);
  }, [logout]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login: signIn,
      logout,
      restoreSession,
      refreshSession,
      updateUser,
      signIn,
      signUp,
      signInWithGoogle,
      signOut: logout,
      refreshFromServer,
    }),
    [state, signIn, signUp, signInWithGoogle, logout, refreshFromServer, restoreSession, refreshSession, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

