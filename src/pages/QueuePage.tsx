import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarDays } from 'lucide-react';
import { useSafeBack } from '@/hooks/useSafeBack';
import { useLanguage } from '@/contexts/LanguageContext';

/** The customer live-queue feature is not backed by a queue service yet.
 * Keep this legacy route honest instead of showing invented positions/timers. */
export default function QueuePage() {
  const navigate = useNavigate();
  const safeBack = useSafeBack();
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-sm">
        <button onClick={safeBack} className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft size={18} className={isRTL ? 'rotate-180' : ''} />
          {ar ? 'رجوع' : 'Back'}
        </button>
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <CalendarDays size={26} />
        </div>
        <h1 className="text-xl font-bold text-foreground">
          {ar ? 'الطابور المباشر غير متاح' : 'Live queue is unavailable'}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {ar
            ? 'ما في خدمة طابور حي مرتبطة بالحجوزات حاليًا. تابع حالة حجزك من صفحة الحجوزات.'
            : 'There is no live queue service connected to bookings yet. Track your booking from your bookings page.'}
        </p>
        <button onClick={() => navigate('/history')} className="mt-6 h-11 w-full rounded-2xl bg-primary px-5 font-bold text-primary-foreground">
          {ar ? 'حجوزاتي' : 'My bookings'}
        </button>
      </div>
    </main>
  );
}
