import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, Calendar, Clock, Sparkles, Scissors } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function BookingSuccessPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';

  useEffect(() => {
    const timer = setTimeout(() => navigate('/booking-status'), 15000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 text-center" dir={isRTL ? 'rtl' : 'ltr'}>
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="relative mb-6"
      >
        <div className="w-24 h-24 rounded-full bg-green-500/15 flex items-center justify-center">
          <CheckCircle size={52} className="text-green-400" strokeWidth={1.5} />
        </div>
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 2.5, opacity: 0 }}
            transition={{ delay: i * 0.1, duration: 0.8 }}
            className="absolute inset-0 rounded-full border border-green-400/30"
          />
        ))}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <h1 className="text-2xl font-black text-foreground">
          {ar ? 'تم تأكيد حجزك! 🎉' : 'Booking Confirmed! 🎉'}
        </h1>
        <p className="text-muted-foreground mt-2">
          {ar ? 'تم إرسال طلب الحجز — انتظر موافقة الحلاق' : 'Booking request sent — waiting for barber confirmation'}
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className={`w-full bg-card border border-border rounded-3xl p-5 mt-6 ${ar ? 'text-right' : 'text-left'}`}
      >
        <div className={`flex items-center gap-3 pb-4 border-b border-border mb-4 ${ar ? 'flex-row-reverse' : ''}`}>
          {state?.barberAvatar ? (
            <img src={state.barberAvatar} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Scissors size={20} className="text-primary" />
            </div>
          )}
          <div>
            <p className="font-bold text-foreground">{state?.barberName || (ar ? 'الحلاق' : 'Barber')}</p>
            <p className="text-sm text-muted-foreground">{state?.service?.name || ''}</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className={`flex items-center gap-3 ${ar ? 'flex-row-reverse' : ''}`}>
            <Calendar size={16} className="text-primary flex-shrink-0" />
            <span className="text-sm text-foreground font-medium">{state?.date || '—'}</span>
          </div>
          <div className={`flex items-center gap-3 ${ar ? 'flex-row-reverse' : ''}`}>
            <Clock size={16} className="text-primary flex-shrink-0" />
            <span className="text-sm text-foreground font-medium">{state?.time || '—'}</span>
          </div>
        </div>
      </motion.div>

      {state?.points > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8 }}
          className="w-full mt-4 bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-center gap-3"
        >
          <Sparkles size={20} className="text-primary flex-shrink-0" />
          <p className="text-sm font-semibold text-foreground">
            {ar
              ? <>🎉 ربحت <span className="text-primary">{state.points} نقطة ولاء!</span></>
              : <>🎉 You earned <span className="text-primary">{state.points} loyalty points!</span></>}
          </p>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="flex flex-col gap-3 w-full mt-6"
      >
        <Button className="w-full h-12 font-bold rounded-2xl bg-primary text-primary-foreground" onClick={() => navigate('/booking-status')}>
          {ar ? 'تتبع الحجز' : 'Track Booking'}
        </Button>
        <Button variant="outline" className="w-full h-12 font-bold rounded-2xl" onClick={() => navigate('/')}>
          {ar ? 'العودة للرئيسية' : 'Back to Home'}
        </Button>
      </motion.div>
    </div>
  );
}
