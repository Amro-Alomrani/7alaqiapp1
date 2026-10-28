import { useEffect, useState, useMemo } from 'react';
import { getBarberStatusOverride, onBarberStatusChange, type BarberStatus } from '@/lib/barberStatus';
import type { Barber } from '@/types';

export interface LiveBarberStatus {
  status: BarberStatus;
  liveEta?: number;
  liveActivity?: string;
  isOverridden: boolean;
}

/**
 * Returns the effective live status for a barber.
 * Reads any barber-set override from localStorage, otherwise falls back to mock liveStatus.
 * Auto-updates when the override changes (in-tab + cross-tab).
 */
export function useBarberLiveStatus(barber: Barber | undefined): LiveBarberStatus {
  const [, tick] = useState(0);

  useEffect(() => {
    if (!barber) return;
    const off = onBarberStatusChange(({ barberId }) => {
      if (barberId === barber.id) tick(t => t + 1);
    });
    return off;
  }, [barber]);

  if (!barber) return { status: 'busy', isOverridden: false };
  const override = getBarberStatusOverride(barber.id);
  if (override) {
    return {
      status: override.status,
      liveEta: override.liveEta,
      liveActivity: override.liveActivity,
      isOverridden: true,
    };
  }
  return {
    status: barber.liveStatus,
    liveEta: barber.liveEta,
    liveActivity: barber.liveActivity,
    isOverridden: false,
  };
}
