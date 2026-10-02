const STORAGE_PREFIX = 'tapesh:social:following:v1:';
const CHANGE_EVENT = 'tapesh:social:changed';

function storageKey(userId) {
  return `${STORAGE_PREFIX}${encodeURIComponent(String(userId || 'current'))}`;
}

export function getFollowingProfiles(userId, defaults = []) {
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (raw === null) return defaults;
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((profile) => profile && typeof profile.id === 'string') : defaults;
  } catch {
    return defaults;
  }
}

export function isFollowingProfile(userId, profile, defaults = []) {
  return getFollowingProfiles(userId, defaults).some((item) => item.id === profile?.id);
}

export function toggleFollowingProfile(userId, profile, defaults = []) {
  if (!profile?.id || typeof window === 'undefined') return false;
  const current = getFollowingProfiles(userId, defaults);
  const exists = current.some((item) => item.id === profile.id);
  const updated = exists ? current.filter((item) => item.id !== profile.id) : [...current, profile];
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { userId: String(userId || 'current') } }));
  } catch {
    return exists;
  }
  return !exists;
}

export const SOCIAL_CHANGE_EVENT = CHANGE_EVENT;
