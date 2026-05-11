import * as Keychain from 'react-native-keychain';

type RememberedCredentials = {
  email: string;
  password: string;
};

const SERVICE = 'com.sebzeci.auth.rememberedCredentials';

export async function setRememberedCredentials(email: string, password: string): Promise<void> {
  const normalizedEmail = (email || '').trim();
  if (!normalizedEmail || !password) return;

  await Keychain.setGenericPassword(normalizedEmail, password, {
    service: SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function getRememberedCredentials(): Promise<RememberedCredentials | null> {
  try {
    const creds = await Keychain.getGenericPassword({ service: SERVICE });
    if (!creds?.username || !creds?.password) return null;
    return {
      email: creds.username,
      password: creds.password,
    };
  } catch {
    return null;
  }
}

export async function clearRememberedCredentials(): Promise<void> {
  try {
    await Keychain.resetGenericPassword({ service: SERVICE });
  } catch {
  }
}
