import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'mobile_profile_image_v1:';

const buildKey = (userKey?: string | null) => {
  const normalized = String(userKey || '').trim();
  if (!normalized) return null;
  return `${KEY_PREFIX}${normalized}`;
};

export const getProfileImageForUser = async (userKey?: string | null): Promise<string | null> => {
  const storageKey = buildKey(userKey);
  if (!storageKey) return null;
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    return raw || null;
  } catch {
    return null;
  }
};

export const setProfileImageForUser = async (
  userKey?: string | null,
  imageUri?: string | null,
): Promise<void> => {
  const storageKey = buildKey(userKey);
  if (!storageKey) return;
  try {
    const normalized = String(imageUri || '').trim();
    if (normalized) {
      await AsyncStorage.setItem(storageKey, normalized);
    } else {
      await AsyncStorage.removeItem(storageKey);
    }
  } catch {
  }
};
