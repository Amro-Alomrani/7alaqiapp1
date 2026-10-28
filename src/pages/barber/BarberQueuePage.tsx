import { Bell, CheckCircle, Play, Users } from 'lucide-react';
import { useLiveBooking } from '@/contexts/LiveBookingContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { pushNotification } from '@/lib/db';
import { toast } from 'sonner';

export default function BarberQueuePage() {
  const { barberUser } = useAuth();
  const { getBarberBookings, startBooking, completeBooking } = useLiveBooking();
  const { language } = useLanguage();
  const ar = language === 'ar';
  const bookings = getBarberBookings(barberUser?.uid || '');
  const current = bookings.find(booking => booking.status === 'in_progress');
  const waiting = bookings
    .filter(booking => ['accepted', 'preparing', 'your_turn'].includes(booking.status))
    .sort((a, b) => a.createdAt - b.createdAt);
  const next = waiting[0];

  const notifyNext = async () => {
    if (!next?.customerId) return;
    const sent = await pushNotification(next.customerId, {
      type: 'booking_update',
      title: `💈 ${barberUser?.shopName || (ar ? 'الصالون' : 'Your barber')}`,
      body: ar ? 'الحلاق جاهز لاستقبالك. يرجى التوجه للصالون.' : 'The barber is ready for you. Please head to the salon.',
      fromUid: barberUser?.uid,
      fromName: barberUser?.name || barberUser?.shopName,
      bookingId: next.id,
    });
    if (sent) toast.success(ar ? 'تم تسجيل الإشعار للحجز' : 'Notification added to the booking');
    else toast.error(ar ? 'تعذر تسجيل الإشعار. تحقق من الاتصال.' : 'Could not add the notification. Check the connection.');
  };

  const startNext = async () => {
    if (!next) return;
    const started = await startBooking(next.id);
    if (!started) toast.error(ar ? 'تعذر تحديث الحجز. حدّث القائمة وحاول مجددًا.' : 'Could not update the booking. Refresh and try again.');
  };

  const finishCurrent = async () => {
    if (!current) return;
    const finished = await completeBooking(current.id);
    if (!finished) toast.error(ar ? 'تعذر إنهاء الحجز. تحقق من الاتصال وحاول مجددًا.' : 'Could not complete the booking. Check the connection and retry.');
  };

  return (
    <div className="min-h-screen overflow-y-auto pb-28" dir={ar ? 'rtl' : 'ltr'}>
      <div className="px-5 pt-14 pb-5">
        <div className="mb-2 flex items-center justify-between">
          <h1 className="text-xl font-black text-foreground">{ar ? 'قائمة الحجوزات' : 'Booking queue'}</h1>
          <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5">
            <Users size={13} className="text-primary" />
            <span className="text-sm font-bold text-primary">{waiting.length} {ar ? 'بانتظار الخدمة' : 'waiting'}</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {ar ? 'مرتبة حسب وقت وصول طلب الحجز. التحديثات محفوظة مع حالة الحجز.' : 'Ordered by booking request time. Actions update the saved booking status.'}
        </p>
      </div>

      <div className="space-y-3 px-5">
        {current && (
          <article className="rounded-2xl border-2 border-primary bg-primary/10 p-4">
            <p className="mb-1 text-xs font-bold text-primary">{ar ? 'الخدمة الحالية' : 'In service'}</p>
            <p className="font-bold text-foreground">{current.customerName || (ar ? 'العميل' : 'Customer')}</p>
            <p className="text-sm text-muted-foreground">{current.service?.name}</p>
            <button onClick={finishCurrent} className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground">
              <CheckCircle size={16} /> {ar ? 'إنهاء الخدمة' : 'Complete service'}
            </button>
          </article>
        )}

        {waiting.map((booking, index) => (
          <article key={booking.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-black text-primary">#{index + 1}</span>
            {booking.customerAvatar ? <img src={booking.customerAvatar} alt="" className="h-10 w-10 rounded-xl object-cover" /> : <div className="h-10 w-10 rounded-xl bg-secondary" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-foreground">{booking.customerName || (ar ? 'العميل' : 'Customer')}</p>
              <p className="truncate text-xs text-muted-foreground">{booking.service?.name} · {booking.time}</p>
            </div>
            {index === 0 && (
              <button onClick={startNext} className="inline-flex h-9 shrink-0 items-center gap-1 rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground">
                <Play size={14} /> {ar ? 'بدء' : 'Start'}
              </button>
            )}
          </article>
        ))}

        {!current && waiting.length === 0 && (
          <div className="py-16 text-center">
            <p className="mb-3 text-4xl">📋</p>
            <p className="font-semibold text-foreground">{ar ? 'لا توجد حجوزات بانتظار الخدمة' : 'No bookings are waiting'}</p>
            <p className="mt-1 text-sm text-muted-foreground">{ar ? 'ستظهر الطلبات المقبولة هنا.' : 'Accepted bookings will appear here.'}</p>
          </div>
        )}

        {next && (
          <button onClick={notifyNext} className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-primary/30 text-sm font-bold text-primary">
            <Bell size={16} /> {ar ? 'إرسال إشعار داخل التطبيق للعميل التالي' : 'Send an in-app notification to next customer'}
          </button>
        )}
      </div>
    </div>
  );
}
