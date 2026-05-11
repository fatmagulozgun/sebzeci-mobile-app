import * as Keychain from 'react-native-keychain';

type StoredTokens = {
  accessToken: string;
  refreshToken?: string;
};

const SERVICE = 'com.sebzeci.auth.tokens';
const USERNAME = 'tokens';

function parseTokens(raw: string): StoredTokens | null {
  try {
    const parsed = JSON.parse(raw) as StoredTokens;
    if (!parsed?.accessToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function setSecureTokens(tokens: StoredTokens): Promise<void> {
  const raw = JSON.stringify(tokens);
  await Keychain.setGenericPassword(USERNAME, raw, {
    service: SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function getSecureTokens(): Promise<StoredTokens | null> {
  try {
    const creds = await Keychain.getGenericPassword({ service: SERVICE });
    if (!creds) return null;
    return parseTokens(creds.password);
  } catch {
    return null;
  }
}

export async function clearSecureTokens(): Promise<void> {
  try {
    await Keychain.resetGenericPassword({ service: SERVICE });
  } catch {
  }
}

