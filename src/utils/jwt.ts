type GlobalDecode = typeof globalThis & {
  atob?: (data: string) => string;
  Buffer?: { from(data: string, encoding: string): { toString(enc: string): string } };
};

function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '==='.slice((normalized.length + 3) % 4);
  const g = globalThis as GlobalDecode;
  if (typeof g.atob === 'function') {
    return g.atob(padded);
  }
  if (typeof g.Buffer?.from === 'function') {
    return g.Buffer.from(padded, 'base64').toString('utf8');
  }
  throw new Error('Base64 decoder unavailable');
}

export function getJwtExpiryMs(token: string): number | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const payloadRaw = decodeBase64Url(parts[1]);
    const payload = JSON.parse(payloadRaw) as { exp?: number };
    if (!payload?.exp) return null;
    return payload.exp * 1000;
  } catch {
    return null;
  }
}

export function isJwtExpired(token: string, skewSeconds = 30): boolean {
  const expMs = getJwtExpiryMs(token);
  if (!expMs) return false;
  return Date.now() >= expMs - skewSeconds * 1000;
}
