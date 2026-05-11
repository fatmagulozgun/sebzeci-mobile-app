import Config from 'react-native-config';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

const webClientId = (Config.GOOGLE_WEB_CLIENT_ID || '').trim();

export function configureGoogleSignIn(): void {
  if (!webClientId) {
    return;
  }
  GoogleSignin.configure({
    webClientId,
    offlineAccess: true,
    forceCodeForRefreshToken: false,
  });
}

export function isGoogleSignInConfigured(): boolean {
  return Boolean(webClientId);
}
