import AsyncStorage from '@react-native-async-storage/async-storage';

const REMEMBER_ME_KEY = 'auth_remember_me';
const LAST_EMAIL_KEY = 'auth_last_email';
const AUTH_USER_KEY = 'auth_user';

export async function getRememberMePreference(): Promise<boolean | null> {
  try {
    const raw = await AsyncStorage.getItem(REMEMBER_ME_KEY);
    if (raw === null) return null;
    if (raw === '1') return true;
    if (raw === '0') return false;
    return null;
  } catch {
    return null;
  }
}

export async function setRememberMePreference(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(REMEMBER_ME_KEY, value ? '1' : '0');
  } catch {
  }
}

export async function getLastEmail(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(LAST_EMAIL_KEY)) || '';
  } catch {
    return '';
  }
}

export async function setLastEmail(email: string): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_EMAIL_KEY, email);
  } catch {
  }
}

export async function getStoredUserRaw(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(AUTH_USER_KEY);
  } catch {
    return null;
  }
}

export async function setStoredUserRaw(raw: string): Promise<void> {
  try {
    await AsyncStorage.setItem(AUTH_USER_KEY, raw);
  } catch {
  }
}

export async function clearStoredUser(): Promise<void> {
  try {
    await AsyncStorage.removeItem(AUTH_USER_KEY);
  } catch {
  }
}

