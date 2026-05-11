import { isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';

import { GoogleSignInNoIdTokenError, GoogleSignInUserCancelledError } from './googleSignInFlow';

export function mapGoogleAuthFlowError(err: unknown): string | null {
  if (err instanceof GoogleSignInUserCancelledError) {
    return null;
  }
  if (err instanceof GoogleSignInNoIdTokenError) {
    return 'Google oturumundan kimlik jetonu alınamadı. Lütfen tekrar deneyin.';
  }
  if (isErrorWithCode(err)) {
    if (err.code === statusCodes.SIGN_IN_CANCELLED) {
      return null;
    }
    if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return 'Google Play hizmetleri kullanılamıyor. Güncelleyin veya cihazınızı kontrol edin.';
    }
    if (err.code === statusCodes.IN_PROGRESS) {
      return 'Google girişi zaten devam ediyor.';
    }
  }
  return 'Google ile giriş sırasında bir sorun oluştu.';
}

export function mapGoogleBackendAuthError(err: unknown): string {
  const anyErr = err as any;
  const status = anyErr?.response?.status;
  const serverMessage = anyErr?.response?.data?.message || anyErr?.response?.data?.error;

  if (anyErr?.code === 'ERR_NETWORK') {
    return 'Sunucuya bağlanılamadı. Ağınızı ve API adresini kontrol edin.';
  }
  if (status === 401) {
    return serverMessage || 'Google oturumu doğrulanamadı. Tekrar deneyin.';
  }
  if (typeof serverMessage === 'string' && serverMessage.trim()) {
    return serverMessage.trim();
  }
  return 'Giriş tamamlanırken bir hata oluştu.';
}
