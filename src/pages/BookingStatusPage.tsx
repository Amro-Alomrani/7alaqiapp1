import { useState } from 'react';
import { useSafeBack } from "@/hooks/useSafeBack";
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, MessageCircle, MapPin, Clock, Star, CheckCircle2, Loader2, QrCode, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useLiveBooking } from '@/contexts/LiveBookingContext';
import { useLanguage } from '@/contexts/LanguageContext';
import type { LiveBookingStatus } from '@/types';

const VISUAL_STEPS = [
  { id: 'requested', labelAr: 'طلب الحجز',       labelEn: 'Booking Requested', icon: '📤' },
  { id: 'accepted',  labelAr: 'تم قبول الحجز',   labelEn: 'Booking Accepted',  icon: '✅' },
  { id: 'waiting',   labelAr: 'بانتظار قدومك',   labelEn: 'Waiting for You',   icon: '🔔' },
] as const;

function toVisualStep(status: LiveBookingStatus): number {
  if (status === 'requested') return 0;
  if (status === 'accepted') return 1;
  if (['preparing', 'your_turn', 'in_progress'].includes(status)) return 2;
  return -1; // terminal
}

export default function BookingStatusPage() {
  const navigate = useNavigate();
  const safeBack = useSafeBack();
  const { activeBooking, bookingHistory, cancelBooking, rateBooking } = useLiveBooking();
  const { language } = useLanguage();
  const ar = language === 'ar';
  const [rating, setRating] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  const [ratingBusy, setRatingBusy] = useState(false);

  const booking = activeBooking || bookingHistory[0];

  if (!booking) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <div className="text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-bold text-foreground">{ar ? 'لا يوجد حجز نشط' : 'No active booking'}</p>
          <p className="text-sm text-muted-foreground mt-1">{ar ? 'ابحث عن حلاق واحجز الآن' : 'Find a barber and book now'}</p>
          <button onClick={() => navigate('/')} className="mt-4 bg-primary text-primary-foreground px-6 py-2.5 rounded-2xl font-bold text-sm">
            {ar ? 'ابحث عن حلاق' : 'Find a Barber'}
          </button>
        </div>
      </div>
    );
  }

  const isTerminal = ['completed', 'cancelled', 'rejected'].includes(booking.status);
  const canCancel = ['requested', 'accepted'].includes(booking.status);
  const isCompleted = booking.status === 'completed';
  const isCancelled = ['cancelled', 'rejected'].includes(booking.status);
  const visualStep = toVisualStep(booking.status);
  const showQR = visualStep === 2; // on "بانتظار قدومك" step

  return (
    <div className="min-h-screen flex flex-col pb-10" dir={ar ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-3 px-5 pt-14 pb-4">
        <button onClick={() => safeBack()}
          className="w-10 h-10 bg-card border border-border rounded-full flex items-center justify-center">
          <ArrowLeft size={18} className={ar ? 'rotate-180' : ''} />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-foreground">{ar ? 'حالة الحجز' : 'Booking Status'}</h1>
          <p className="text-xs text-muted-foreground">#{booking.id.slice(-6)}</p>
        </div>
        {canCancel && (
          <button
            disabled={cancelling}
            onClick={async () => {
              if (cancelling) return;
              setCancelling(true);
              try {
                const cancelled = await cancelBooking(booking.id);
                if (!cancelled) toast.error(ar ? 'تعذر إلغاء الحجز. تحقق من الاتصال وحاول مجدداً.' : 'Could not cancel the booking. Check your connection and try again.');
              } finally {
                setCancelling(false);
              }
            }}
            className="text-xs text-destructive font-bold bg-destructive/10 px-3 py-1.5 rounded-xl disabled:opacity-50"
          >
            {cancelling ? <Loader2 size={14} className="animate-spin" /> : ar ? 'إلغاء' : 'Cancel'}
          </button>
        )}
      </div>

      {isCancelled && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mx-5 mb-5"
        >
          <div className="bg-destructive/10 border border-destructive/30 rounded-3xl p-6 text-center">
            <p className="text-5xl mb-3">{booking.status === 'rejected' ? '😔' : '❌'}</p>
            <h2 className="text-lg font-black text-destructive">
              {ar ? (booking.status === 'rejected' ? 'تم رفض الحجز' : 'تم إلغاء الحجز') : (booking.status === 'rejected' ? 'Booking Rejected' : 'Booking Cancelled')}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {ar ? 'يمكنك حجز موعد مع حلاق آخر' : 'You can book with another barber'}
            </p>
            <button onClick={() => navigate('/')} className="mt-4 bg-primary text-primary-foreground px-6 py-2.5 rounded-2xl font-bold text-sm">
              {ar ? 'ابحث عن حلاق' : 'Find a Barber'}
            </button>
          </div>
        </motion.div>
      )}

      {isCompleted && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mx-5 mb-5"
        >
          <div className="bg-green-500/10 border border-green-500/30 rounded-3xl p-6 text-center">
            <p className="text-5xl mb-3">🎉</p>
            <h2 className="text-lg font-black text-green-500">{ar ? 'اكتمل الحجز!' : 'Booking Completed!'}</h2>
            <p className="text-sm text-muted-foreground mt-1">{ar ? 'شكراً لثقتك بنا' : 'Thank you for your trust'}</p>
          </div>
        </motion.div>
      )}

      {!isTerminal && (
        <motion.div
          key={booking.status}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-5 mb-5"
        >
          <div className="bg-card border border-border rounded-3xl p-5">
            {VISUAL_STEPS.map((step, i) => {
              const isDone = visualStep > i;
              const isActive = visualStep === i;
              const isPending = visualStep < i;

              return (
                <div key={step.id} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${
                        isDone ? 'bg-green-500/20 text-green-400' :
                        isActive ? 'bg-primary/20 text-primary ring-2 ring-primary/40' :
                        'bg-muted text-muted-foreground'
                      }`}
                    >
                      {isDone
                        ? <CheckCircle2 size={18} />
                        : isActive
                          ? <Loader2 size={17} className="animate-spin" />
                          : <span className="text-xs font-bold">{i + 1}</span>
                      }
                    </div>
                    {i < VISUAL_STEPS.length - 1 && (
                      <div className={`w-0.5 h-10 mt-1 ${isDone ? 'bg-green-500/40' : 'bg-border'}`} />
                    )}
                  </div>

                  <div className={`pt-1.5 pb-4 flex-1 ${isPending ? 'opacity-35' : ''}`}>
                    <div className="flex items-center gap-2">
                      <span>{step.icon}</span>
                      <p className={`text-sm font-black ${isActive ? 'text-foreground' : isDone ? 'text-green-400' : 'text-muted-foreground'}`}>
                        {ar ? step.labelAr : step.labelEn}
                      </p>
                    </div>
                    {isActive && i === 0 && (
                      <p className="text-xs text-muted-foreground mt-1 ms-7">
                        {ar ? 'انتظر قليلاً، الحلاق رح يرد عليك...' : 'Please wait, the barber will respond soon...'}
                      </p>
                    )}
                    {isActive && i === 1 && (
                      <p className="text-xs text-muted-foreground mt-1 ms-7">
                        {ar ? 'توجّه للصالون في الوقت المحدد' : 'Head to the salon at the scheduled time'}
                      </p>
                    )}
                    {isActive && i === 2 && (
                      <p className="text-xs text-muted-foreground mt-1 ms-7">
                        {ar ? 'الحلاق ينتظرك — امسح QR عند وصولك' : 'The barber is waiting — scan QR on arrival'}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {showQR && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="mx-5 mb-5"
          >
            <button
              onClick={() => navigate('/qr-scan')}
              className="w-full bg-primary text-primary-foreground rounded-3xl p-5 flex items-center gap-4 shadow-xl shadow-primary/30"
            >
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                <QrCode size={26} className="text-white" />
              </div>
              <div className="flex-1 text-start">
                <p className="font-black text-base">{ar ? 'وصلت؟ امسح QR للتأكيد' : 'Arrived? Scan QR to confirm'}</p>
                <p className="text-xs text-white/75 mt-0.5">{ar ? 'اطلب من الحلاق أن يريك الكود' : 'Ask the barber to show you the code'}</p>
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {visualStep >= 1 && !isTerminal && booking.salonLocation && (
        <div className="mx-5 mb-5">
          <button
            onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${booking.salonLocation!.lat},${booking.salonLocation!.lng}`, '_blank')}
            className="w-full bg-card border border-border rounded-2xl p-4 flex items-center gap-3"
          >
            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <MapPin size={20} className="text-blue-400" />
            </div>
            <div className="flex-1 text-start">
              <p className="font-bold text-sm text-foreground">{ar ? 'اعرض الطريق' : 'Get Directions'}</p>
              <p className="text-xs text-muted-foreground">{booking.barberShop}</p>
            </div>
          </button>
        </div>
      )}

      <div className="mx-5 mb-5">
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
          <img src={booking.barberAvatar || '/logo.png'} alt={booking.barberName} onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = '/logo.png'; }} className="w-14 h-14 rounded-2xl object-cover" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-foreground">{booking.barberName}</p>
            <p className="text-xs text-muted-foreground">{booking.barberShop}</p>
            <p className="text-xs text-primary font-medium mt-0.5">{booking.service.name} — {booking.totalPrice} JOD</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/booking-chat/${booking.id}`)}
              className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center"
            >
              <MessageCircle size={18} className="text-primary" />
            </button>
            {booking.barberPhone ? (
              <a href={`tel:${booking.barberPhone}`} className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center">
                <Phone size={18} className="text-green-400" />
              </a>
            ) : (
              <button className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center opacity-50" disabled>
                <Phone size={18} className="text-green-400" />
              </button>
            )}
          </div>
        </div>
      </div>

      {!isTerminal && booking.estimatedWait > 0 && (
        <div className="mx-5 mb-5">
          <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Clock size={18} className="text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{ar ? 'الوقت التقديري' : 'Estimated wait'}</p>
              <p className="font-black text-foreground">{booking.estimatedWait} {ar ? 'دقيقة' : 'min'}</p>
            </div>
          </div>
        </div>
      )}

      <div className="mx-5 mb-5">
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-3">{ar ? 'تفاصيل الحجز' : 'Booking Details'}</p>
          <div className="space-y-2.5">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">{ar ? 'الخدمة' : 'Service'}</span>
              <span className="text-sm font-bold text-foreground">{booking.service.icon} {booking.service.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">{ar ? 'التاريخ' : 'Date'}</span>
              <span className="text-sm font-bold text-foreground">{booking.date}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">{ar ? 'الوقت' : 'Time'}</span>
              <span className="text-sm font-bold text-foreground">{booking.time}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">{ar ? 'المدة' : 'Duration'}</span>
              <span className="text-sm font-bold text-foreground">{booking.service.duration} {ar ? 'دقيقة' : 'min'}</span>
            </div>
            <div className="h-px bg-border my-1" />
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">{ar ? 'المجموع الفرعي' : 'Subtotal'}</span>
              <span className="text-sm text-foreground">{booking.service.price} JOD</span>
            </div>
            {(booking.homeServiceFee ?? 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">{ar ? 'رسم الخدمة المنزلية' : 'Home-service fee'}</span>
                <span className="text-sm text-foreground">{booking.homeServiceFee} JOD</span>
              </div>
            )}
            {booking.tip > 0 && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">{ar ? 'إكرامية' : 'Tip'}</span>
                <span className="text-sm text-foreground">{booking.tip} JOD</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-sm font-bold text-foreground">{ar ? 'الإجمالي' : 'Total'}</span>
              <span className="text-sm font-black text-primary">{booking.totalPrice} JOD</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">{ar ? 'الدفع' : 'Payment'}</span>
              <span className="text-sm font-bold text-foreground">{booking.payMethod === 'cash' ? (ar ? 'نقداً' : 'Cash') : (ar ? 'المحفظة' : 'Wallet')}</span>
            </div>
          </div>
        </div>
      </div>

      {isCompleted && !booking.rating && (
        <div className="mx-5 mb-5">
          <div className="bg-card border border-primary/20 rounded-2xl p-5 text-center">
            <Sparkles size={24} className="text-primary mx-auto mb-2" />
            <p className="font-bold text-foreground mb-1">{ar ? 'كيف كانت تجربتك؟' : 'How was your experience?'}</p>
            <p className="text-xs text-muted-foreground mb-4">{ar ? 'قيّم' : 'Rate'} {booking.barberName}</p>
            <div className="flex items-center justify-center gap-2 mb-4">
              {[1, 2, 3, 4, 5].map(s => (
                <button
                  key={s}
                  onClick={() => setRating(s)}
                  className="transition-transform"
                  style={{ transform: rating >= s ? 'scale(1.2)' : 'scale(1)' }}
                >
                  <Star size={32} className={rating >= s ? 'text-primary fill-primary' : 'text-muted-foreground'} />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <motion.button
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                disabled={ratingBusy}
                onClick={async () => {
                  if (ratingBusy) return;
                  setRatingBusy(true);
                  try {
                    if (await rateBooking(booking.id, rating)) navigate('/');
                    else toast.error(ar ? 'تعذر حفظ التقييم. حاول مجددًا.' : 'Could not save the rating. Try again.');
                  } finally { setRatingBusy(false); }
                }}
                className="bg-primary text-primary-foreground font-bold px-6 py-2.5 rounded-2xl text-sm"
              >
                {ar ? 'إرسال التقييم' : 'Submit Rating'}
              </motion.button>
            )}
          </div>
        </div>
      )}

      {(isCancelled || (isCompleted && booking.rating)) && (
        <div className="mx-5">
          <button onClick={() => navigate('/')} className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-2xl text-sm">
            {ar ? 'العودة للرئيسية' : 'Back to Home'}
          </button>
        </div>
      )}
    </div>
  );
}
