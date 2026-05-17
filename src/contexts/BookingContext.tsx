import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Booking, Service } from '@/types';
import { useBarbers } from '@/contexts/DataContext';

interface BookingContextType {
  bookings: Booking[];
  addBooking: (barberId: string, service: Service, date: string, time: string, tip?: number) => Booking;
  cancelBooking: (id: string) => void;
  getUpcoming: () => Booking[];
  getCompleted: () => Booking[];
  getCancelled: () => Booking[];
}

const BookingContext = createContext<BookingContextType | null>(null);

const STORAGE_KEY = 'barberco_bookings';

const FAKE_IDS = new Set(['bk1', 'bk2', 'bk3']);

const loadBookings = (): Booking[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: Booking[] = JSON.parse(raw);
    const real = parsed.filter(b => !FAKE_IDS.has(b.id));
    if (real.length !== parsed.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(real));
    return real;
  } catch {
    return [];
  }
};

const saveBookings = (bookings: Booking[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
};

export function BookingProvider({ children }: { children: ReactNode }) {
  const [bookings, setBookings] = useState<Booking[]>(() => loadBookings());
  const allBarbers = useBarbers();

  const addBooking = useCallback((barberId: string, service: Service, date: string, time: string, tip = 0): Booking => {
    const barber = allBarbers.find(b => b.id === barberId);
    const newBooking: Booking = {
      id: `bk_${Date.now()}`,
      barberId,
      barberName: barber?.name || 'Unknown',
      barberShop: barber?.shopName || 'Unknown',
      barberAvatar: barber?.avatar || '',
      service,
      date,
      time,
      status: 'upcoming',
      totalPrice: service.price + tip,
      pointsEarned: Math.floor(service.price * 2),
    };
    setBookings(prev => {
      const updated = [newBooking, ...prev];
      saveBookings(updated);
      return updated;
    });
    return newBooking;
  }, [allBarbers]);

  const cancelBooking = useCallback((id: string) => {
    setBookings(prev => {
      const updated = prev.map(b => b.id === id ? { ...b, status: 'cancelled' as const } : b);
      saveBookings(updated);
      return updated;
    });
  }, []);

  const getUpcoming = useCallback(() => bookings.filter(b => b.status === 'upcoming'), [bookings]);
  const getCompleted = useCallback(() => bookings.filter(b => b.status === 'completed'), [bookings]);
  const getCancelled = useCallback(() => bookings.filter(b => b.status === 'cancelled'), [bookings]);

  return (
    <BookingContext.Provider value={{ bookings, addBooking, cancelBooking, getUpcoming, getCompleted, getCancelled }}>
      {children}
    </BookingContext.Provider>
  );
}

export function useBookings() {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error('useBookings must be used within BookingProvider');
  return ctx;
}
