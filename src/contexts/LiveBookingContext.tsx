import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { LiveBooking, LiveBookingStatus, Service } from '@/types';
import { eventBus, cancelBookingTimers } from '@/lib/realtime';
import { useAuth } from '@/contexts/AuthContext';
import { useBarbers } from '@/contexts/DataContext';
import { subscribeBarberBookings, subscribeCustomerBookings, updateBookingStatus, pushNotification, BookingDoc } from '@/lib/db';
import { toast } from 'sonner';

interface LiveBookingContextType {
  activeBooking: LiveBooking | null;
  bookingHistory: LiveBooking[];
  allBookings: LiveBooking[];
  createBooking: (barberId: string, salonId: string, service: Service, date: string, time: string, tip?: number, payMethod?: 'cash' | 'wallet', customerLocation?: { lat: number; lng: number }, presetId?: string) => LiveBooking;
  cancelBooking: (id: string) => void;
  rateBooking: (id: string, rating: number, review?: string) => void;
  getActiveBooking: () => LiveBooking | null;
  acceptBooking: (id: string) => void;
  rejectBooking: (id: string) => void;
  startBooking: (id: string) => void;
  completeBooking: (id: string) => void;
  getBarberBookings: (barberId: string) => LiveBooking[];
}

const LiveBookingContext = createContext<LiveBookingContextType | null>(null);

const STORAGE_KEY = 'zite_live_bookings';

const loadBookings = (): LiveBooking[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

const saveBookings = (bookings: LiveBooking[]) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings)); } catch {  }
};

/** Show a real notification (toast + browser/native notification if granted) when a booking changes status. */
function notifyStatusChange(b: LiveBooking, prev: LiveBookingStatus) {
  if (b.status === prev) return;
  const titles: Partial<Record<LiveBookingStatus, string>> = {
    accepted:    `✅ ${b.barberName} accepted your booking`,
    rejected:    `❌ ${b.barberName} could not take your booking`,
    preparing:   `💈 ${b.barberName} is preparing for you`,
    your_turn:   `🔔 It's your turn at ${b.barberShop}!`,
    in_progress: `✂️ Your appointment has started`,
    completed:   `🎉 Appointment complete — thanks for visiting!`,
    cancelled:   `Booking cancelled`,
  };
  const msg = titles[b.status];
  if (!msg) return;
  try {
    if (b.status === 'rejected' || b.status === 'cancelled') toast.error(msg);
    else toast.success(msg);
  } catch {  }
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('حلاقي', { body: msg, icon: '/logo.png' });
    }
  } catch {  }
}

function patchStatus(b: LiveBooking, status: LiveBookingStatus): LiveBooking {
  const changes: Partial<LiveBooking> = { status };
  const now = Date.now();
  if (status === 'accepted') changes.acceptedAt = now;
  if (status === 'in_progress') changes.startedAt = now;
  if (status === 'completed') changes.completedAt = now;
  if (status === 'preparing') changes.queuePosition = Math.max(0, b.queuePosition - 1);
  if (status === 'your_turn') changes.queuePosition = 0;
  return { ...b, ...changes };
}

export function LiveBookingProvider({ children }: { children: ReactNode }) {
  const [bookings, setBookings] = useState<LiveBooking[]>(() => loadBookings());
  const { customer, barberUser } = useAuth();
  const allBarbers = useBarbers();
  const bookingsRef = useRef(bookings);
  const reminderTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => { bookingsRef.current = bookings; }, [bookings]);

  const mapFsToLive = useCallback((d: BookingDoc & { id: string }): LiveBooking => {
    const fsToLiveStatus: Record<BookingDoc['status'], LiveBookingStatus> = {
      requested: 'requested',
      confirmed: 'accepted',
      in_progress: 'in_progress',
      completed: 'completed',
      cancelled: 'cancelled',
      rejected: 'rejected',
    };
    return {
      id: d.id,
      customerId: d.customerUid,
      customerName: d.customerName,
      customerAvatar: d.customerAvatar,
      customerPhone: d.customerPhone,
      barberId: d.barberId,
      barberName: d.barberName,
      barberShop: d.barberShop,
      barberAvatar: d.barberAvatar || '',
      salonId: '',
      staffId: d.staffId,
      staffName: d.staffName,
      staffAvatar: d.staffAvatar,
      service: d.service,
      date: d.date,
      time: d.time,
      status: fsToLiveStatus[d.status],
      createdAt: d.createdAt,
      estimatedWait: 30,
      queuePosition: 1,
      totalPrice: d.totalPrice,
      tip: d.tip ?? 0,
      payMethod: d.payMethod || 'cash',
      customerLocation: d.customerLocation,
    };
  }, []);

  const mergeFs = useCallback((incoming: (BookingDoc & { id: string })[]) => {
    setBookings(prev => {
      const map = new Map(prev.map(b => [b.id, b]));
      incoming.forEach(d => {
        const live = mapFsToLive(d);
        const existing = map.get(d.id);
        map.set(d.id, { ...existing, ...live });
        if (existing && existing.status !== live.status) {
          notifyStatusChange(live, existing.status);
        }
      });
      return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
    });
  }, [mapFsToLive]);

  useEffect(() => {
    if (!customer?.uid) return;
    const unsub = subscribeCustomerBookings(customer.uid, mergeFs);
    return () => unsub();
  }, [customer?.uid, mergeFs]);

  useEffect(() => {
    if (!barberUser?.uid) return;
    const unsub = subscribeBarberBookings(barberUser.uid, mergeFs);
    return () => unsub();
  }, [barberUser?.uid, mergeFs]);

  const activeBooking = bookings.find(b =>
    !['completed', 'cancelled', 'rejected'].includes(b.status)
  ) || null;

  useEffect(() => { saveBookings(bookings); }, [bookings]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const next = JSON.parse(e.newValue) as LiveBooking[];
        setBookings(next);
      } catch {  }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    const unsub = eventBus.on('booking_status', (data: { bookingId: string; status: LiveBookingStatus }) => {
      setBookings(prev => prev.map(b => {
        if (b.id !== data.bookingId) return b;
        if (['completed', 'cancelled', 'rejected'].includes(b.status)) return b;
        return patchStatus(b, data.status);
      }));
    });
    return () => { unsub(); };
  }, []);

  const createBooking = useCallback((
    barberId: string,
    salonId: string,
    service: Service,
    date: string,
    time: string,
    tip = 0,
    payMethod: 'cash' | 'wallet' = 'cash',
    customerLocation?: { lat: number; lng: number },
    presetId?: string
  ): LiveBooking => {
    const barber = allBarbers.find(b => b.id === barberId);
    const id = presetId || `bk_${Date.now()}`;

    const booking: LiveBooking = {
      id,
      customerId: customer?.uid || 'anon',
      customerName: customer?.name,
      customerAvatar: customer?.avatar,
      customerPhone: customer?.phone,
      barberId,
      barberName: barber?.name || 'Unknown',
      barberShop: barber?.shopName || 'Unknown',
      barberAvatar: barber?.avatar || '',
      salonId,
      service,
      date,
      time,
      status: 'requested',
      createdAt: Date.now(),
      estimatedWait: (barber?.queueCount || 0) * (barber?.avgDuration || 30) + (service.duration || 30),
      queuePosition: (barber?.queueCount || 0) + 1,
      totalPrice: service.price + tip,
      tip,
      payMethod,
      salonLocation: barber?.lat && barber?.lng ? { lat: barber.lat, lng: barber.lng } : undefined,
      customerLocation,
    };

    setBookings(prev => [booking, ...prev]);

    if (!presetId) {
      const reminderTimer = setTimeout(() => {
        const current = bookingsRef.current.find(b => b.id === id);
        if (current?.status !== 'requested') return;
        const barberName = barber?.name || 'الحلاق';
        const customerName = customer?.name || 'العميل';
        if (barberId) {
          void pushNotification(barberId, {
            type: 'booking_update',
            title: '🔔 تذكير: طلب حجز بانتظارك',
            body: `${customerName} لسا منتظر ردك على طلب الحجز`,
            fromUid: customer?.uid || '',
            fromName: customerName,
            bookingId: id,
          }).catch(() => {});
        }
        if (customer?.uid) {
          void pushNotification(customer.uid, {
            type: 'booking_update',
            title: '⏳ حجزك لسا بانتظار الرد',
            body: `${barberName} لم يرد بعد. يمكنك الإلغاء والمحاولة مع حلاق آخر`,
            fromUid: barberId,
            fromName: barberName,
            bookingId: id,
          }).catch(() => {});
        }
        reminderTimers.current.delete(id);
      }, 12 * 60 * 1000);
      reminderTimers.current.set(id, reminderTimer);
    }

    if (!presetId && customer?.uid) {
      void import('@/lib/db').then(({ createBooking: dbCreate }) =>
        dbCreate({
          customerUid: customer.uid,
          customerName: customer.name || 'Customer',
          customerPhone: customer.phone || '',
          customerAvatar: customer.avatar,
          barberId,
          barberName: barber?.name || '',
          barberShop: barber?.shopName || '',
          barberAvatar: barber?.avatar,
          service,
          date,
          time,
          totalPrice: service.price + tip,
          tip,
          payMethod,
          pointsEarned: Math.round((service.price + tip) * 3),
        }, id).catch(() => {})
      );
    }

    return booking;
  }, [customer, allBarbers]);

  const clearReminderTimer = (id: string) => {
    const t = reminderTimers.current.get(id);
    if (t) { clearTimeout(t); reminderTimers.current.delete(id); }
  };

  const cancelBooking = useCallback((id: string) => {
    clearReminderTimer(id);
    cancelBookingTimers(id);
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'cancelled' as const } : b));
    void updateBookingStatus(id, 'cancelled').catch(() => {});
  }, []);

  const rateBooking = useCallback((id: string, rating: number, review?: string) => {
    setBookings(prev => prev.map(b => b.id === id ? { ...b, rating, review } : b));
  }, []);

  const acceptBooking = useCallback((id: string) => {
    clearReminderTimer(id);
    setBookings(prev => prev.map(b => b.id === id && b.status === 'requested' ? patchStatus(b, 'accepted') : b));
    void updateBookingStatus(id, 'confirmed').catch(() => {});
  }, []);

  const rejectBooking = useCallback((id: string) => {
    clearReminderTimer(id);
    cancelBookingTimers(id);
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'rejected' as const } : b));
    void updateBookingStatus(id, 'rejected').catch(() => {});
  }, []);

  const startBooking = useCallback((id: string) => {
    setBookings(prev => prev.map(b => b.id === id ? patchStatus(b, 'in_progress') : b));
    void updateBookingStatus(id, 'in_progress').catch(() => {});
  }, []);

  const completeBooking = useCallback((id: string) => {
    cancelBookingTimers(id);
    setBookings(prev => prev.map(b => b.id === id ? patchStatus(b, 'completed') : b));
    void updateBookingStatus(id, 'completed').catch(() => {});
  }, []);

  const getActiveBooking = useCallback(() => activeBooking, [activeBooking]);
  const getBarberBookings = useCallback((barberId: string) => {
    return bookings.filter(b => b.barberId === barberId);
  }, [bookings]);

  return (
    <LiveBookingContext.Provider value={{
      activeBooking,
      bookingHistory: bookings,
      allBookings: bookings,
      createBooking,
      cancelBooking,
      rateBooking,
      getActiveBooking,
      acceptBooking,
      rejectBooking,
      startBooking,
      completeBooking,
      getBarberBookings,
    }}>
      {children}
    </LiveBookingContext.Provider>
  );
}

export function useLiveBooking() {
  const ctx = useContext(LiveBookingContext);
  if (!ctx) throw new Error('useLiveBooking must be used within LiveBookingProvider');
  return ctx;
}
