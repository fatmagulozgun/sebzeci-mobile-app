import {
  GoogleSignin,
  isCancelledResponse,
} from '@react-native-google-signin/google-signin';

export class GoogleSignInUserCancelledError extends Error {
  constructor() {
    super('SIGN_IN_CANCELLED');
    this.name = 'GoogleSignInUserCancelledError';
  }
}

export class GoogleSignInNoIdTokenError extends Error {
  constructor() {
    super('NO_ID_TOKEN');
    this.name = 'GoogleSignInNoIdTokenError';
  }
}

export async function obtainGoogleIdToken(): Promise<string> {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (isCancelledResponse(response)) {
    throw new GoogleSignInUserCancelledError();
  }
  const tokens = await GoogleSignin.getTokens();
  if (!tokens.idToken) {
    throw new GoogleSignInNoIdTokenError();
  }
  return tokens.idToken;
}
