type RuntimeSession = {
  accessToken?: string;
  refreshToken?: string;
  userRaw?: string;
};

const runtime: RuntimeSession = {};

export function setRuntimeSession(next: RuntimeSession) {
  runtime.accessToken = next.accessToken;
  runtime.refreshToken = next.refreshToken;
  runtime.userRaw = next.userRaw;
}

export function getRuntimeAccessToken(): string | undefined {
  return runtime.accessToken;
}

export function getRuntimeRefreshToken(): string | undefined {
  return runtime.refreshToken;
}

export function getRuntimeUserRaw(): string | undefined {
  return runtime.userRaw;
}

export function clearRuntimeSession() {
  runtime.accessToken = undefined;
  runtime.refreshToken = undefined;
  runtime.userRaw = undefined;
}

