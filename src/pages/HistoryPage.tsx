import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, RotateCcw, ArrowLeft, XCircle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLiveBooking } from '@/contexts/LiveBookingContext';
import type { LiveBooking, LiveBookingStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useState } from 'react';
import { toast } from 'sonner';

const statusStyle: Record<'active' | 'completed' | 'cancelled', string> = {
  active: 'bg-blue-500/15 text-blue-400 border border-blue-500/20',
  completed: 'bg-green-500/15 text-green-400 border border-green-500/20',
  cancelled: 'bg-destructive/15 text-destructive border border-destructive/20',
};

function bookingGroup(status: LiveBookingStatus): 'active' | 'completed' | 'cancelled' {
  if (status === 'completed') return 'completed';
  if (status === 'cancelled' || status === 'rejected') return 'cancelled';
  return 'active';
}

function statusName(status: LiveBookingStatus, ar: boolean): string {
  const labels: Record<LiveBookingStatus, [string, string]> = {
    requested: ['بانتظار تأكيد الحلاق', 'Awaiting barber confirmation'],
    accepted: ['تم تأكيد الحجز', 'Confirmed'],
    preparing: ['الحلاق يستعد', 'Preparing'],
    your_turn: ['دورك الآن', 'Your turn'],
    in_progress: ['الخدمة جارية', 'In progress'],
    completed: ['مكتمل', 'Completed'],
    cancelled: ['ملغي', 'Cancelled'],
    rejected: ['مرفوض', 'Declined'],
  };
  return labels[status][ar ? 0 : 1];
}

function BookingCard({ booking, index, onCancel, ar }: { booking: LiveBooking; index: number; onCancel?: (id: string) => void | Promise<void>; ar: boolean }) {
  const navigate = useNavigate();
  const [cancelling, setCancelling] = useState(false);
  const group = bookingGroup(booking.status);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className="bg-card border border-border rounded-2xl overflow-hidden"
    >
      <div className="flex items-center gap-3 p-4 border-b border-border">
        {booking.barberAvatar
          ? <img src={booking.barberAvatar} alt={booking.barberName} className="w-11 h-11 rounded-xl object-cover" />
          : <div className="w-11 h-11 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">{(booking.barberName || '?')[0]}</div>
        }
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-sm truncate">{booking.barberShop}</p>
          <p className="text-xs text-muted-foreground">{booking.barberName}</p>
        </div>
        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${statusStyle[group]}`}>
          {statusName(booking.status, ar)}
        </span>
      </div>
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="text-base">{booking.service.icon}</span>
            <span className="text-sm">{booking.service.name}</span>
          </div>
          <span className="text-sm font-bold text-primary">{booking.totalPrice} JOD</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar size={11} />
            <span>{booking.date}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock size={11} />
            <span>{booking.time}</span>
          </div>
          {booking.homeService && <span className="ms-auto text-primary font-medium">{ar ? 'خدمة منزلية' : 'Home service'}</span>}
        </div>
      </div>
      {group === 'completed' && (
        <div className="px-4 pb-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 text-xs gap-1.5 rounded-xl"
            onClick={() => navigate(`/book/${booking.barberId}`)}
          >
            <RotateCcw size={12} />
            {ar ? 'احجز مجدداً' : 'Book Again'}
          </Button>
        </div>
      )}
      {group === 'active' && ['requested', 'accepted'].includes(booking.status) && onCancel && (
        <div className="px-4 pb-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 text-xs gap-1.5 rounded-xl text-red-400 border-red-400/30 hover:bg-red-400/10"
            disabled={cancelling}
            onClick={async () => {
              if (cancelling) return;
              setCancelling(true);
              try { await onCancel(booking.id); }
              finally { setCancelling(false); }
            }}
          >
            {cancelling ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
            {ar ? 'إلغاء الحجز' : 'Cancel Booking'}
          </Button>
        </div>
      )}
    </motion.div>
  );
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';
  const { bookingHistory, cancelBooking } = useLiveBooking();
  const upcoming = bookingHistory.filter(b => bookingGroup(b.status) === 'active');
  const past = bookingHistory.filter(b => bookingGroup(b.status) !== 'active');

  const cancelHistoryBooking = async (id: string) => {
    if (!await cancelBooking(id)) {
      toast.error(ar ? 'تعذر إلغاء الحجز. تحقق من الاتصال وحاول مجدداً.' : 'Could not cancel this booking. Check your connection and try again.');
    }
  };

  return (
    <div className="min-h-screen pb-28 overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-3 px-5 pt-14 pb-4">
        <button onClick={() => navigate('/profile')} className="w-10 h-10 bg-card border border-border rounded-full flex items-center justify-center">
          <ArrowLeft size={18} className={isRTL ? 'rotate-180' : ''} />
        </button>
        <div>
          <h1 className="text-xl font-bold">{ar ? 'حجوزاتي' : 'My Bookings'}</h1>
          <p className="text-sm text-muted-foreground">
            {ar ? `${bookingHistory.length} حجز` : `${bookingHistory.length} total appointments`}
          </p>
        </div>
      </div>

      <div className="px-5 space-y-6">
        {upcoming.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-foreground mb-3 uppercase tracking-wider">
              {ar ? 'قادمة' : 'Upcoming'}
            </h2>
            <div className="space-y-3">
              {upcoming.map((b, i) => <BookingCard key={b.id} booking={b} index={i} onCancel={cancelHistoryBooking} ar={ar} />)}
            </div>
          </div>
        )}
        {past.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-foreground mb-3 uppercase tracking-wider">
              {ar ? 'سابقة' : 'Past Bookings'}
            </h2>
            <div className="space-y-3">
              {past.map((b, i) => <BookingCard key={b.id} booking={b} index={i} ar={ar} />)}
            </div>
          </div>
        )}
        {bookingHistory.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📋</p>
            <p className="font-bold text-foreground">{ar ? 'لا توجد حجوزات بعد' : 'No bookings yet'}</p>
            <p className="text-sm text-muted-foreground mt-1">{ar ? 'ابدأ بحجز حلاقك المفضل' : 'Start by booking your favorite barber'}</p>
            <button
              onClick={() => navigate('/explore')}
              className="mt-4 bg-primary text-primary-foreground px-6 py-2.5 rounded-2xl font-bold text-sm"
            >
              {ar ? 'اكتشف الحلاقين' : 'Explore barbers'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
