function parseServerDate(value?: string | null): Date | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const hasTimezone = /(?:[zZ]|[+-]\d{2}:\d{2})$/.test(raw);
  const normalized = hasTimezone ? raw : `${raw}Z`;
  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const fallback = new Date(raw);
  if (!Number.isNaN(fallback.getTime())) return fallback;
  return null;
}

function tryFormatWithIstanbul(date: Date, options: Intl.DateTimeFormatOptions) {
  try {
    return new Intl.DateTimeFormat('tr-TR', { ...options, timeZone: 'Europe/Istanbul' }).format(date);
  } catch {
    return new Intl.DateTimeFormat('tr-TR', options).format(date);
  }
}

export function getDateTimestamp(value?: string | null): number {
  const parsed = parseServerDate(value);
  return parsed ? parsed.getTime() : 0;
}

export function formatDate(value?: string | null): string {
  const date = parseServerDate(value);
  if (!date) return '-';

  return tryFormatWithIstanbul(date, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTime(value?: string | null): string {
  const date = parseServerDate(value);
  if (!date) return '-';

  return tryFormatWithIstanbul(date, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatRelativeTime(value?: string | null): string | null {
  const date = parseServerDate(value);
  if (!date) return null;

  const diffMs = Math.max(0, Date.now() - date.getTime());
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'az önce';
  if (diffMin < 60) return `${diffMin} dk önce`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} saat önce`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} gün önce`;
}

