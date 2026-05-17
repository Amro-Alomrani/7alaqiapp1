import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Bell } from 'lucide-react';
import { onBarberStatusChange, type BarberStatus } from '@/lib/barberStatus';
import { useLiveBooking } from '@/contexts/LiveBookingContext';
import { useBarbers } from '@/contexts/DataContext';

const STATUS_LABELS: Record<BarberStatus, { label: string; emoji: string }> = {
  available:      { label: 'is now Available',     emoji: '✅' },
  finishing_soon: { label: 'is Finishing Soon',    emoji: '⏳' },
  busy:           { label: 'is now Busy',           emoji: '✂️' },
  closed:         { label: 'has Closed the shop',   emoji: '🔒' },
};

/**
 * Watches barber status changes and toasts the customer when a relevant
 * barber updates their status. "Relevant" = the customer has an active or
 * recent booking with them.
 */
export default function BarberStatusNotifier() {
  const { allBookings } = useLiveBooking();
  const allBarbers = useBarbers();
  const watchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const ids = new Set<string>();
    for (const b of allBookings) {
      if (!['completed', 'cancelled', 'rejected'].includes(b.status)) {
        ids.add(b.barberId);
      }
    }
    watchedRef.current = ids;
  }, [allBookings]);

  useEffect(() => {
    const off = onBarberStatusChange(({ barberId, status, liveEta, liveActivity }) => {
      if (!status) return;
      if (!watchedRef.current.has(barberId)) return;

      const barber = allBarbers.find(b => b.id === barberId);
      const label = STATUS_LABELS[status];
      if (!label) return;

      const isCritical = status === 'closed' || status === 'busy';
      const fn = isCritical ? toast.error : toast.success;

      fn(`${label.emoji} ${barber?.name || 'Your barber'} ${label.label}`, {
        description: [
          liveActivity && `Currently: ${liveActivity}`,
          liveEta && `~${liveEta} min wait`,
          status === 'closed' && 'Your booking may be affected — contact the shop',
        ].filter(Boolean).join(' · ') || undefined,
        duration: isCritical ? 10000 : 5000,
        icon: <Bell size={16} />,
      });
    });
    return off;
  }, []);

  return null;
}
