import { API_BASE_URL } from '../services/apiClient';
import type { AuthUser } from '../services/authService';
import { getAssignedAvatar } from './avatar';

export const resolveDisplayName = (user?: AuthUser | null) => {
  if (!user) {
    return 'Kullanici';
  }

  return user.name?.trim() || user.email?.split('@')?.[0]?.trim() || 'Kullanici';
};

export const resolveProfileImageUri = (
  user?: AuthUser | null,
  localProfileImageDataUrl?: string | null,
) => {
  if (!user) {
    return '';
  }

  const candidateImage =
    localProfileImageDataUrl?.trim() || getAssignedAvatar(user);

  if (!candidateImage) {
    return '';
  }

  if (
    candidateImage.startsWith('http://') ||
    candidateImage.startsWith('https://') ||
    candidateImage.startsWith('data:image')
  ) {
    return candidateImage;
  }

  const origin = API_BASE_URL.replace(/\/api\/?$/, '');
  const normalizedPath = candidateImage.startsWith('/') ? candidateImage : `/${candidateImage}`;
  return `${origin}${normalizedPath}`;
};
