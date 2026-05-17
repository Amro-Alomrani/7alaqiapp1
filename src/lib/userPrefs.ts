/**
 * User-scoped persisted preferences (favorites, notifications, etc.)
 * Survives reloads. Empty by default — fresh accounts see clean state.
 */

const KEY_NOTIFS_DISMISSED = 'zite_notifs_dismissed';
const KEY_NOTIFS_READ = 'zite_notifs_read';
const KEY_FAV_BARBERS = 'zite_fav_barbers';
const KEY_FAV_SALONS = 'zite_fav_salons';
const KEY_ONBOARDED = 'zite_user_onboarded';

function loadSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch { return new Set(); }
}

function saveSet(key: string, set: Set<string>) {
  try { localStorage.setItem(key, JSON.stringify([...set])); } catch {  }
}

export const notifPrefs = {
  getDismissed: () => loadSet(KEY_NOTIFS_DISMISSED),
  getRead: () => loadSet(KEY_NOTIFS_READ),
  dismiss(id: string) {
    const s = loadSet(KEY_NOTIFS_DISMISSED); s.add(id); saveSet(KEY_NOTIFS_DISMISSED, s);
  },
  markRead(id: string) {
    const s = loadSet(KEY_NOTIFS_READ); s.add(id); saveSet(KEY_NOTIFS_READ, s);
  },
  clearAll() {
    localStorage.removeItem(KEY_NOTIFS_DISMISSED);
    localStorage.removeItem(KEY_NOTIFS_READ);
  },
};

export const favPrefs = {
  getBarbers: () => loadSet(KEY_FAV_BARBERS),
  getSalons: () => loadSet(KEY_FAV_SALONS),
  toggleBarber(id: string) {
    const s = loadSet(KEY_FAV_BARBERS);
    if (s.has(id)) s.delete(id); else s.add(id);
    saveSet(KEY_FAV_BARBERS, s);
    return s.has(id);
  },
  toggleSalon(id: string) {
    const s = loadSet(KEY_FAV_SALONS);
    if (s.has(id)) s.delete(id); else s.add(id);
    saveSet(KEY_FAV_SALONS, s);
    return s.has(id);
  },
  removeBarber(id: string) {
    const s = loadSet(KEY_FAV_BARBERS); s.delete(id); saveSet(KEY_FAV_BARBERS, s);
  },
  removeSalon(id: string) {
    const s = loadSet(KEY_FAV_SALONS); s.delete(id); saveSet(KEY_FAV_SALONS, s);
  },
};

export const onboardingPrefs = {
  isOnboarded: () => localStorage.getItem(KEY_ONBOARDED) === '1',
  markOnboarded: () => localStorage.setItem(KEY_ONBOARDED, '1'),
};
