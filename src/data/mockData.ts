/**
 * Barber Go — neutral defaults.
 * No fake data. All real content comes from Firestore via DataContext.
 * This file just exports empty/safe defaults for legacy imports
 * until every screen has been migrated.
 */
import type {
  Barber, Booking, Notification, Post, Review, Salon, Service,
  StyleMood, User, BarberScheduleItem, BarberQueueItem, PendingBooking, TimeSlot,
} from '@/types';

export const currentUser: User = {
  id: '',
  name: '',
  phone: '',
  avatar: '',
  location: '',
  hairType: '',
  loyaltyPoints: 0,
  totalBookings: 0,
  memberSince: '',
  following: 0,
  styleDNA: {
    faceShape: '',
    preferredLength: '',
    topStyles: [],
    lastStyle: '',
    nextPredicted: '',
  },
};

/** Default service catalogue offered to new barbers when they register. */
export const allServices: Service[] = [
  { id: 's1', name: 'Classic Haircut', duration: 30, price: 15, icon: '✂️' },
  { id: 's2', name: 'Fade & Taper',     duration: 45, price: 20, icon: '💈' },
  { id: 's3', name: 'Beard Trim',       duration: 20, price: 10, icon: '🪒' },
  { id: 's4', name: 'Full Package',     duration: 75, price: 35, icon: '👑' },
  { id: 's5', name: 'Kids Cut',         duration: 25, price: 12, icon: '⭐' },
  { id: 's6', name: 'Hot Towel Shave',  duration: 45, price: 25, icon: '🔥' },
];

export const barbers: Barber[] = [];
export const reviews: Review[] = [];
export const feedPosts: Post[] = [];
export const salons: Salon[] = [];
export const bookingHistory: Booking[] = [];
export const notifications: Notification[] = [];
export const favoriteBarbers: Barber[] = [];
export const favoriteSalons: Salon[] = [];
export const barberSchedule: BarberScheduleItem[] = [];
export const barberQueue: BarberQueueItem[] = [];
export const pendingBookings: PendingBooking[] = [];

export const styleMoods: StyleMood[] = [
  { id: 'm1', label: 'Sharp & Professional', emoji: '👔', description: 'Crisp, clean, business-ready', gradient: 'from-blue-600 to-indigo-700', barberIds: [], styles: ['Classic Side Part', 'Executive Crop', 'Clean Fade'] },
  { id: 'm2', label: 'Bold & Modern',         emoji: '⚡', description: 'Statement cuts, fades, designs', gradient: 'from-orange-500 to-red-600', barberIds: [], styles: ['Skin Fade', 'Mohawk', 'Design Cut'] },
  { id: 'm3', label: 'Classic Gentleman',     emoji: '🎩', description: 'Timeless, elegant, refined',     gradient: 'from-amber-600 to-yellow-700', barberIds: [], styles: ['Pompadour', 'Slick Back', 'Hot Towel Shave'] },
  { id: 'm4', label: 'Casual & Relaxed',      emoji: '🌊', description: 'Easy maintenance, natural look', gradient: 'from-cyan-500 to-teal-600', barberIds: [], styles: ['Textured Crop', 'Natural Wave', 'Buzz Cut'] },
];

/** Generate hourly time slots for booking. */
export const generateTimeSlots = (): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  for (let hour = 9; hour <= 21; hour++) {
    for (const m of [0, 30]) {
      const time = `${hour.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      slots.push({
        id: `t${hour}${m}`,
        time,
        available: true,
        aiRecommended: hour === 14 || hour === 17,
      });
    }
  }
  return slots;
};
