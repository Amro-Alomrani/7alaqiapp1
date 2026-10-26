import { eventBus } from './realtime';
import { updateBarberProfile } from './db';
import type { LiveStatus } from '@/types';

export type BarberStatus = LiveStatus;

export interface BarberStatusEntry {
  status: BarberStatus;
  liveEta?: number;
  liveActivity?: string;
  updatedAt: number;
}

const STORAGE_KEY = 'zite_barber_status';

type StatusMap = Record<string, BarberStatusEntry>;

function loadAll(): StatusMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StatusMap) : {};
  } catch { return {}; }
}

function saveAll(map: StatusMap) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); } catch {  }
}

export function getBarberStatusOverride(barberId: string): BarberStatusEntry | null {
  const map = loadAll();
  return map[barberId] || null;
}

export function setBarberStatus(
  barberId: string,
  status: BarberStatus,
  extra?: { liveEta?: number; liveActivity?: string }
) {
  const map = loadAll();
  const entry: BarberStatusEntry = {
    status,
    liveEta: extra?.liveEta,
    liveActivity: extra?.liveActivity,
    updatedAt: Date.now(),
  };
  map[barberId] = entry;
  saveAll(map);
  eventBus.emit('barber_status_changed', { barberId, ...entry });
  void updateBarberProfile(barberId, {
    liveStatus: status,
    available: status !== 'closed',
    liveEta: extra?.liveEta,
    liveActivity: extra?.liveActivity,
  } as any).catch(() => {  });
}

export function clearBarberStatus(barberId: string) {
  const map = loadAll();
  delete map[barberId];
  saveAll(map);
  eventBus.emit('barber_status_changed', { barberId, status: null });
  void updateBarberProfile(barberId, {
    liveStatus: 'closed',
    available: false,
    liveEta: undefined,
    liveActivity: undefined,
  } as any).catch(() => {});
}

export function onBarberStatusChange(
  cb: (data: { barberId: string; status: BarberStatus | null; liveEta?: number; liveActivity?: string }) => void
): () => void {
  const offBus = eventBus.on('barber_status_changed', cb);

  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    try {
      const next = e.newValue ? (JSON.parse(e.newValue) as StatusMap) : {};
      const prev = e.oldValue ? (JSON.parse(e.oldValue) as StatusMap) : {};
      const ids = new Set([...Object.keys(next), ...Object.keys(prev)]);
      for (const id of ids) {
        const a = prev[id];
        const b = next[id];
        if (!b) {
          if (a) cb({ barberId: id, status: null });
        } else if (!a || a.status !== b.status || a.liveEta !== b.liveEta || a.liveActivity !== b.liveActivity) {
          cb({ barberId: id, status: b.status, liveEta: b.liveEta, liveActivity: b.liveActivity });
        }
      }
    } catch {  }
  };
  window.addEventListener('storage', onStorage);

  return () => {
    offBus();
    window.removeEventListener('storage', onStorage);
  };
}
