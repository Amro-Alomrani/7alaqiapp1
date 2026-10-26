import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Play, Flag, Clock, DollarSign, Phone, MapPin, Inbox, Navigation, MessageCircle, Bell } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useLiveBooking } from '@/contexts/LiveBookingContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { pushNotification, updateBarberLiveLocation } from '@/lib/db';
import ServiceIconBadge from '@/components/ServiceIconBadge';
import { LiveBooking, LiveBookingStatus } from '@/types';
import { watchDeviceLocation } from '@/lib/location';

type FilterKey = 'pending' | 'active' | 'completed' | 'cancelled';

const STATUS_TO_FILTER: Record<LiveBookingStatus, FilterKey> = {
  requested: 'pending',
  accepted: 'active',
  preparing: 'active',
  your_turn: 'active',
  in_progress: 'active',
  completed: 'completed',
  cancelled: 'cancelled',
  rejected: 'cancelled',
};

const STATUS_COLORS: Record<LiveBookingStatus, string> = {
  requested: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  accepted: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  preparing: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  your_turn: 'bg-primary/20 text-primary border-primary/40',
  in_progress: 'bg-green-500/15 text-green-500 border-green-500/30',
  completed: 'bg-muted text-muted-foreground border-border',
  cancelled: 'bg-red-500/15 text-red-500 border-red-500/30',
  rejected: 'bg-red-500/15 text-red-500 border-red-500/30',
};

export default function BarberBookingsPage() {
  const { t, language } = useLanguage();
  const ar = language === 'ar';
  const navigate = useNavigate();
  const { allBookings, acceptBooking, rejectBooking, startBooking, completeBooking } = useLiveBooking();
  const { barberUser } = useAuth();
  const [filter, setFilter] = useState<FilterKey>('pending');
  const [sharingLocation, setSharingLocation] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const locationWatchRef = useRef<(() => void) | null>(null);
  const lastLocationWriteRef = useRef(0);

  const barberId = barberUser?.uid || '';
  const myBookings = useMemo(
    () => allBookings.filter(b => b.barberId === barberId).sort((a, b) => b.createdAt - a.createdAt),
    [allBookings, barberId]
  );

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = { pending: 0, active: 0, completed: 0, cancelled: 0 };
    myBookings.forEach(b => { c[STATUS_TO_FILTER[b.status]]++; });
    return c;
  }, [myBookings]);

  const filtered = myBookings.filter(b => STATUS_TO_FILTER[b.status] === filter);
  const activeTravelBooking = myBookings.find(b => ['accepted', 'preparing', 'your_turn', 'in_progress'].includes(b.status));

  useEffect(() => {
    if (!barberId) return;
    if (!activeTravelBooking) { if (sharingLocation) setSharingLocation(false); return; }
    if (!sharingLocation) return;
    let active = true;
    void watchDeviceLocation(
      pos => {
        const now = Date.now();
        if (now - lastLocationWriteRef.current < 10_000) return;
        lastLocationWriteRef.current = now;
        void updateBarberLiveLocation(barberId, {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
        }).catch(error => {
          toast.error(ar ? 'تعذر إرسال موقعك المباشر' : 'Could not share your live location', {
            description: error instanceof Error ? error.message : undefined,
          });
          setSharingLocation(false);
        });
      },
      () => {
        toast.error(ar ? 'تعذر تحديد الموقع الحالي' : 'Could not determine current location');
        setSharingLocation(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    ).then(stop => {
      if (active) locationWatchRef.current = stop;
      else stop();
    }).catch(() => {
      toast.error(ar ? 'تعذر بدء مشاركة الموقع' : 'Could not start location sharing');
      setSharingLocation(false);
    });
    return () => {
      active = false;
      if (locationWatchRef.current) locationWatchRef.current();
      locationWatchRef.current = null;
    };
  }, [sharingLocation, barberId, activeTravelBooking?.id, ar]);

  const toggleLocationSharing = () => {
    if (sharingLocation) {
      setSharingLocation(false);
      if (barberId) void updateBarberLiveLocation(barberId, null).catch(() => {});
    } else {
      setSharingLocation(true);
    }
  };

  const statusLabel = (s: LiveBookingStatus) => {
    const map: Record<LiveBookingStatus, string> = {
      requested: t.barberDash.pending,
      accepted: t.barberDash.confirmed,
      preparing: t.barberDash.confirmed,
      your_turn: t.barberDash.confirmed,
      in_progress: t.barberDash.inProgress,
      completed: t.status.completed,
      cancelled: t.barberDash.cancelled,
      rejected: t.status.rejected,
    };
    return map[s];
  };

  const runBookingAction = async (bookingId: string, action: () => Promise<boolean>, successMessage: string) => {
    if (actionBusyId) return;
    setActionBusyId(bookingId);
    try {
      if (await action()) toast.success(successMessage);
      else toast.error(ar ? 'تعذر تحديث الحجز. تحقق من الاتصال وحاول مجدداً.' : 'Could not update the booking. Check your connection and try again.');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleAccept = (b: LiveBooking) => runBookingAction(b.id, () => acceptBooking(b.id), t.barberDash.acceptedToast);
  const handleReject = (b: LiveBooking) => runBookingAction(b.id, () => rejectBooking(b.id), t.barberDash.rejectedToast);
  const handleStart = (b: LiveBooking) => runBookingAction(b.id, () => startBooking(b.id), t.barberDash.start);
  const handleComplete = (b: LiveBooking) => runBookingAction(b.id, () => completeBooking(b.id), t.barberDash.completedToast);

  const sendAlert = async (b: LiveBooking) => {
    if (!b.customerId) return;
    const sent = await pushNotification(b.customerId, {
      type: 'message',
      title: `🔔 ${barberUser?.name || (ar ? 'الحلاق' : 'Barber')}`,
      body: ar ? 'لديك تنبيه من الحلاق' : 'You have an alert from your barber',
      fromUid: barberId,
      fromName: barberUser?.name || '',
      bookingId: b.id,
    });
    if (sent) toast.success(ar ? '📲 تم إرسال التنبيه للعميل' : '📲 Alert sent to customer');
    else toast.error(ar ? 'تعذر إرسال التنبيه. تحقق من الاتصال.' : 'Could not send the alert. Check your connection.');
  };

  const tabs: { key: FilterKey; label: string }[] = [
    { key: 'pending', label: t.barberDash.pending },
    { key: 'active', label: t.barberDash.inProgress },
    { key: 'completed', label: t.status.completed },
    { key: 'cancelled', label: t.barberDash.cancelled },
  ];

  return (
    <div className="min-h-screen" dir={ar ? 'rtl' : 'ltr'}>
      {activeTravelBooking && (
        <div className="mx-5 mt-4 mb-2 rounded-2xl border border-primary/25 bg-primary/10 p-4 flex items-center gap-3">
          <MapPin size={20} className="text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">{ar ? 'مشاركة موقعك مع الزبون' : 'Share your location with the customer'}</p>
            <p className="text-xs text-muted-foreground">{ar ? 'يظهر موقعك الحي ووقت الوصول للحجز الحالي فقط' : 'Your live location and ETA are shared for this active booking only'}</p>
          </div>
          <button onClick={toggleLocationSharing} className={`px-3 py-2 rounded-xl text-xs font-bold ${sharingLocation ? 'bg-green-600 text-white' : 'bg-primary text-primary-foreground'}`}>
            {sharingLocation ? (ar ? 'إيقاف' : 'Stop') : (ar ? 'بدء المشاركة' : 'Share')}
          </button>
        </div>
      )}
      <div className="px-5 pt-14 pb-4 sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <h1 className="text-2xl font-black text-foreground">{t.barberDash.bookings}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{myBookings.length} {t.barberDash.total}</p>
      </div>

      <div className="flex gap-2 px-5 py-3 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
              filter === tab.key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border'
            }`}
          >
            {tab.label}
            {counts[tab.key] > 0 && (
              <span className={`ms-1.5 text-xs ${filter === tab.key ? 'text-primary-foreground/80' : 'text-primary'}`}>
                ({counts[tab.key]})
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="px-5 pb-4">
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-3">
                <Inbox size={28} className="text-muted-foreground" />
              </div>
              <p className="font-semibold text-foreground">{t.barberDash.noBookings}</p>
              <p className="text-sm text-muted-foreground mt-1">{t.barberDash.queueEmptyDesc}</p>
            </motion.div>
          ) : (
            filtered.map(b => (
              <motion.div key={b.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                className="bg-card border border-border rounded-2xl p-4 mb-3">

                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <ServiceIconBadge icon={b.service.icon} name={b.service.name} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-foreground truncate">{b.service.name}</p>
                      <p className="text-xs text-muted-foreground">{b.date} — {b.time}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full border flex-shrink-0 ${STATUS_COLORS[b.status]}`}>
                    {statusLabel(b.status).toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock size={12} />
                    <span>{b.service.duration} {t.booking.min}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <DollarSign size={12} />
                    <span className="font-bold text-foreground">{b.totalPrice} JOD</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="capitalize font-medium">{b.payMethod}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-3 p-3 rounded-xl bg-secondary/50">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    {b.customerAvatar
                      ? <img src={b.customerAvatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                      : <span className="text-xs font-bold text-primary">{b.customerName?.[0]?.toUpperCase() || '?'}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{b.customerName || (ar ? 'عميل' : 'Customer')}</p>
                    {b.customerPhone && (
                      <p className="text-[11px] text-muted-foreground">{b.customerPhone}</p>
                    )}
                  </div>
                  <button
                    onClick={() => navigate(`/barber/chat/${b.id}`)}
                    className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0"
                    title={ar ? 'إرسال رسالة' : 'Send message'}
                  >
                    <MessageCircle size={14} className="text-primary" />
                  </button>
                  <button
                    onClick={() => sendAlert(b)}
                    className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center flex-shrink-0"
                    title={ar ? 'إرسال تنبيه' : 'Send alert'}
                  >
                    <Bell size={14} className="text-amber-500" />
                  </button>
                  {b.customerPhone && (
                    <a
                      href={`tel:${b.customerPhone}`}
                      className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center flex-shrink-0"
                    >
                      <Phone size={14} className="text-green-400" />
                    </a>
                  )}
                  {b.customerLocation && (
                    <button
                      onClick={() => navigate(`/barber/customer/${b.id}`)}
                      className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center flex-shrink-0"
                      title={ar ? 'تتبع الموقع' : 'Track location'}
                    >
                      <Navigation size={14} className="text-blue-400" />
                    </button>
                  )}
                  {!b.customerLocation && b.salonLocation && (
                    <MapPin size={13} className="text-muted-foreground flex-shrink-0" />
                  )}
                </div>

                {b.status === 'requested' && (
                  <div className="flex gap-2">
                    <button onClick={() => handleReject(b)}
                      disabled={actionBusyId === b.id}
                      className="flex-1 h-10 rounded-xl bg-red-500/15 text-red-500 border border-red-500/30 font-semibold text-sm flex items-center justify-center gap-1.5">
                      <X size={14} /> {t.barberDash.reject}
                    </button>
                    <button onClick={() => handleAccept(b)}
                      disabled={actionBusyId === b.id}
                      className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-1.5">
                      <Check size={14} /> {t.barberDash.accept}
                    </button>
                  </div>
                )}
                {(b.status === 'accepted' || b.status === 'preparing' || b.status === 'your_turn') && (
                  <button onClick={() => handleStart(b)}
                    disabled={actionBusyId === b.id}
                    className="w-full h-10 rounded-xl bg-blue-500 text-white font-semibold text-sm flex items-center justify-center gap-1.5">
                    <Play size={14} /> {t.barberDash.start}
                  </button>
                )}
                {b.status === 'in_progress' && (
                  <button onClick={() => handleComplete(b)}
                    disabled={actionBusyId === b.id}
                    className="w-full h-10 rounded-xl bg-green-500 text-white font-semibold text-sm flex items-center justify-center gap-1.5">
                    <Flag size={14} /> {t.barberDash.complete}
                  </button>
                )}
                {b.status === 'completed' && b.rating && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <span className="text-primary">★</span>
                    <span>{b.rating}/5</span>
                    {b.review && <span className="truncate ms-1">— {b.review}</span>}
                  </div>
                )}
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
