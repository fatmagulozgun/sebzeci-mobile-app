const AVATAR_POOL = [
  'https://api.dicebear.com/9.x/adventurer/png?seed=sebzeci-1',
  'https://api.dicebear.com/9.x/adventurer/png?seed=sebzeci-2',
  'https://api.dicebear.com/9.x/adventurer/png?seed=sebzeci-3',
  'https://api.dicebear.com/9.x/adventurer/png?seed=sebzeci-4',
  'https://api.dicebear.com/9.x/adventurer/png?seed=sebzeci-5',
  'https://api.dicebear.com/9.x/adventurer/png?seed=sebzeci-6',
  'https://api.dicebear.com/9.x/adventurer/png?seed=sebzeci-7',
  'https://api.dicebear.com/9.x/adventurer/png?seed=sebzeci-8',
  'https://api.dicebear.com/9.x/adventurer/png?seed=sebzeci-9',
  'https://api.dicebear.com/9.x/adventurer/png?seed=sebzeci-10',
];
const ADMIN_FIXED_AVATAR = 'https://api.dicebear.com/9.x/adventurer/png?seed=sebzeci-admin-male';

const hashToIndex = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % AVATAR_POOL.length;
};

export const getAssignedAvatar = (userLike?: {
  id?: string;
  email?: string;
  name?: string;
  role?: string;
  profileImageDataUrl?: string;
  avatarUrl?: string;
  image?: string;
  photoUrl?: string;
} | null) => {
  if (String(userLike?.role || '').toUpperCase() === 'ADMIN') {
    return ADMIN_FIXED_AVATAR;
  }
  const explicit =
    userLike?.profileImageDataUrl?.trim() ||
    userLike?.avatarUrl?.trim() ||
    userLike?.image?.trim() ||
    userLike?.photoUrl?.trim() ||
    '';
  if (explicit) return explicit;
  const key = userLike?.id || userLike?.email || userLike?.name || 'guest';
  return AVATAR_POOL[hashToIndex(String(key))];
};

export const getAvatarPool = () => AVATAR_POOL;
export const getAdminFixedAvatar = () => ADMIN_FIXED_AVATAR;
