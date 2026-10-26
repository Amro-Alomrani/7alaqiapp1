export type BookingStatus = 'upcoming' | 'completed' | 'cancelled';
export type LiveStatus = 'available' | 'finishing_soon' | 'busy' | 'closed';
export type BarberBookingStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';

export interface Notification {
  id: string;
  type: 'booking' | 'turn' | 'promo' | 'reminder' | 'system';
  title: string;
  message: string;
  time: string;
  read: boolean;
  icon: string;
}

export interface BarberScheduleItem {
  id: string;
  time: string;
  customerName: string;
  customerAvatar?: string;
  service: string;
  status: 'completed' | 'in_progress' | 'upcoming' | 'break';
  price: number;
}

export interface BarberQueueItem {
  id: string;
  position: number;
  customerName: string;
  customerAvatar: string;
  serviceName: string;
  waitTime: number;
  status: 'in_service' | 'waiting';
}

export interface PendingBooking {
  id: string;
  customerName: string;
  customerAvatar: string;
  service: string;
  date: string;
  time: string;
  price: number;
  status: BarberBookingStatus;
}

export interface Service {
  id: string;
  name: string;
  duration: number;
  price: number;
  icon: string;
  photo?: string;   // optional service showcase image
}

export interface WorkingHours {
  open: string;
  close: string;
  days: string[]; // ['Mon', 'Tue'...]
}

export interface Staff {
  id: string;
  name: string;
  avatar: string;
  specialties: string[];
  workingHours?: WorkingHours;
  completedJobs: number;
  rating: number;
}

export interface Barber {
  id: string;
  name: string;
  shopName: string;
  avatar: string;
  coverImage: string;
  rating: number;
  reviewCount: number;
  distance: string;
  eta: string;
  services: Service[];
  specialties: string[];
  queueCount: number;
  available: boolean;
  featured: boolean;
  address: string;
  description: string;
  trustScore: number;
  avgDuration: number; // minutes per cut
  liveStatus: LiveStatus;
  liveEta?: number; // minutes until free
  liveActivity?: string;
  followers: number;
  lat?: number;
  lng?: number;
  totalChairs?: number;
  occupiedChairs?: number;
  isOnboarded?: boolean;
  onboardingComplete?: boolean;
  isLive?: boolean;
  offersHomeService?: boolean;
  homeServiceFee?: number;
  staffIds?: string[];
  staff?: Staff[];
  workingHours?: WorkingHours;
  gallery?: string[];
}

export interface TimeSlot {
  id: string;
  time: string;
  available: boolean;
  aiRecommended: boolean;
}

export interface Booking {
  id: string;
  barberId: string;
  barberName: string;
  barberShop: string;
  barberAvatar: string;
  service: Service;
  date: string;
  time: string;
  status: BookingStatus;
  totalPrice: number;
  pointsEarned: number;
}

export interface Review {
  id: string;
  userName: string;
  userAvatar: string;
  rating: number;
  comment: string;
  date: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  imageUrl?: string;
  imageBase64?: string;
  bookingAction?: {
    type: 'book';
    barberId: string;
    barberName: string;
    service: string;
    date?: string;
    time?: string;
  };
  generatedImageUrl?: string;
}

export interface DirectMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: string;
  read: boolean;
  type: 'text' | 'image' | 'booking';
  bookingId?: string;
}

export interface Conversation {
  id: string;
  participantId: string;
  participantName: string;
  participantAvatar: string;
  participantRole: 'barber' | 'customer';
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

export interface User {
  id: string;
  name: string;
  phone: string;
  avatar: string;
  location: string;
  hairType: string;
  loyaltyPoints: number;
  totalBookings: number;
  memberSince: string;
  styleDNA: StyleDNA;
  following: number;
}

export interface StyleDNA {
  faceShape: string;
  preferredLength: string;
  topStyles: string[];
  lastStyle: string;
  nextPredicted: string;
}

export interface Post {
  id: string;
  barber: {
    id: string;
    name: string;
    shopName: string;
    avatar: string;
  };
  postedBy?: 'barber' | 'customer';
  type: 'before_after' | 'photo' | 'trending';
  image: string;
  beforeImage?: string;
  afterImage?: string;
  hairStyle: string;
  tags: string[];
  likes: number;
  comments: number;
  saves: number;
  timeAgo: string;
  location: string;
  caption: string;
  isFollowing: boolean;
}

export interface Salon {
  id: string;
  name: string;
  address: string;
  rating: number;
  reviewCount: number;
  coverImage: string;
  crowdLevel: 'low' | 'medium' | 'busy';
  waitTime: number;
  distance: string;
  barberIds: string[];
  open: boolean;
  openUntil: string;
  lat: number;
  lng: number;
  phone?: string;
}

export interface StyleMood {
  id: string;
  label: string;
  emoji: string;
  description: string;
  gradient: string;
  barberIds: string[];
  styles: string[];
}

export type LiveBookingStatus =
  | 'requested'
  | 'accepted'
  | 'preparing'
  | 'your_turn'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'rejected';

export interface LiveBooking {
  id: string;
  customerId: string;
  customerName?: string;
  customerAvatar?: string;
  customerPhone?: string;
  barberId: string;
  barberName: string;
  barberShop: string;
  barberAvatar: string;
  salonId: string;
  staffId?: string;
  staffName?: string;
  staffAvatar?: string;
  service: Service;
  date: string;
  time: string;
  status: LiveBookingStatus;
  createdAt: number;
  acceptedAt?: number;
  startedAt?: number;
  completedAt?: number;
  estimatedWait: number;
  queuePosition: number;
  totalPrice: number;
  tip: number;
  homeServiceFee?: number;
  homeService?: boolean;
  payMethod: 'cash' | 'wallet';
  customerLocation?: { lat: number; lng: number };
  customerLocationUpdatedAt?: number;
  salonLocation?: { lat: number; lng: number };
  barberPhone?: string;
  rating?: number;
  review?: string;
}

export type RealtimeEvent =
  | { type: 'booking_status_changed'; bookingId: string; status: LiveBookingStatus; data?: Partial<LiveBooking> }
  | { type: 'queue_updated'; salonId: string; barberId: string; position: number; waitTime: number }
  | { type: 'barber_location_update'; barberId: string; lat: number; lng: number }
  | { type: 'message_received'; conversationId: string; message: DirectMessage }
  | { type: 'notification'; notification: Notification };
