import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Bell, BellOff, Zap, Users, Clock, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBarbers } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';

export default function QueuePage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const allBarbers = useBarbers();
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';

  const pos: number = state?.position ?? 3;
  const initialWait: number = state?.waitTime ?? 22;
  const barberName: string = state?.barberName ?? (ar ? 'أحمد الرشيد' : 'Ahmed Al-Rasheed');
  const barberAvatar: string = state?.barberAvatar ?? 'https://i.pravatar.cc/150?img=52';
  const salonName: string = state?.salonName ?? (ar ? 'صالون الفخامة' : 'The Grand Barbershop');

  const [waitLeft, setWaitLeft] = useState(initialWait);
  const [position, setPosition] = useState(pos);
  const [notifyOn, setNotifyOn] = useState(true);
  const [called, setCalled] = useState(false);

  useEffect(() => {
    if (waitLeft <= 0) return;
    const interval = setInterval(() => {
      setWaitLeft(w => Math.max(0, w - 1));
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (waitLeft <= 2 && !called) {
      setCalled(true);
    }
  }, [waitLeft]);

  const altBarber = allBarbers.find(b => b.liveStatus === 'available' && b.name !== barberName);
  const progressPct = Math.max(0, Math.min(100, ((pos - position) / pos) * 100));

  return (
    <div className="min-h-screen flex flex-col overflow-y-auto pb-10" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-3 px-5 pt-14 pb-4">
        <button onClick={() => navigate(-1)} className="w-10 h-10 bg-card border border-border rounded-full flex items-center justify-center">
          <ArrowLeft size={18} className={isRTL ? 'rotate-180' : ''} />
        </button>
        <div>
          <h1 className="font-bold text-foreground">{ar ? 'الطابور المباشر' : 'Live Queue'}</h1>
          <p className="text-xs text-muted-foreground">{salonName}</p>
        </div>
        <button
          onClick={() => setNotifyOn(!notifyOn)}
          className="ms-auto w-10 h-10 bg-card border border-border rounded-full flex items-center justify-center"
        >
          {notifyOn ? <Bell size={18} className="text-primary" /> : <BellOff size={18} className="text-muted-foreground" />}
        </button>
      </div>

      <AnimatePresence>
        {called && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-5 mb-4 bg-primary rounded-2xl px-5 py-4 flex items-center gap-3"
          >
            <Bell size={22} className="text-primary-foreground animate-bounce" />
            <div>
              <p className="font-black text-primary-foreground text-base">
                {ar ? 'دورك القادم! 🎉' : 'Your Turn is Next! 🎉'}
              </p>
              <p className="text-primary-foreground/80 text-xs mt-0.5">
                {ar ? 'توجّه إلى حلاقك الآن' : 'Please proceed to your barber now'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col items-center px-5 py-6">
        <p className="text-sm text-muted-foreground font-medium mb-2 uppercase tracking-wider">
          {ar ? 'موقعك في الطابور' : 'Your Position'}
        </p>
        <div className="relative flex items-center justify-center">
          <motion.div
            animate={{ scale: [1, 1.03, 1] }}
            transition={{ repeat: Infinity, duration: 3 }}
            className="w-36 h-36 rounded-full bg-primary/10 border-2 border-primary/30 flex flex-col items-center justify-center"
          >
            <span className="text-6xl font-black text-primary leading-none">#{position}</span>
            <span className="text-xs text-muted-foreground mt-1">{ar ? 'في الطابور' : 'in queue'}</span>
          </motion.div>
          {[1.3, 1.6].map((s, i) => (
            <motion.div
              key={i}
              animate={{ opacity: [0.3, 0.1, 0.3] }}
              transition={{ repeat: Infinity, duration: 2, delay: i * 0.5 }}
              className="absolute rounded-full border border-primary/20"
              style={{ width: `${s * 144}px`, height: `${s * 144}px` }}
            />
          ))}
        </div>

        <div className="flex items-center gap-2 mt-5 bg-card border border-border rounded-2xl px-5 py-3">
          <Clock size={16} className="text-primary" />
          <span className="text-foreground font-bold">{ar ? 'وقت الانتظار:' : 'Estimated wait:'}</span>
          <span className="text-primary font-black text-lg">{waitLeft} {ar ? 'دقيقة' : 'min'}</span>
        </div>

        <div className="w-full mt-4">
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 1 }}
              className="h-full bg-primary rounded-full"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5 text-center">
            {progressPct < 10
              ? (ar ? 'للتو انضممت للطابور' : 'Just joined the queue')
              : (ar ? 'أصبحت أقرب...' : 'Getting closer...')}
          </p>
        </div>
      </div>

      <div className="mx-5 bg-card border border-border rounded-2xl p-4 flex items-center gap-3 mb-4">
        <img src={barberAvatar} alt={barberName} className="w-12 h-12 rounded-xl object-cover" />
        <div className="flex-1">
          <p className="font-bold text-foreground text-sm">{ar ? 'في انتظار' : 'Waiting for'}</p>
          <p className="text-base font-black text-foreground">{barberName}</p>
        </div>
        <div className="flex items-center gap-1 bg-primary/10 rounded-full px-2 py-1">
          <Users size={12} className="text-primary" />
          <span className="text-xs font-bold text-primary">
            {position - 1} {ar ? 'أمامك' : 'ahead'}
          </span>
        </div>
      </div>

      <div className="mx-5 mb-4">
        <p className="text-xs text-muted-foreground mb-2 font-medium">
          {ar ? 'الأشخاص أمامك' : 'People ahead of you'}
        </p>
        <div className="flex gap-2 flex-wrap">
          {Array.from({ length: Math.max(0, position - 1) }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: i * 0.08 }}
              className="w-10 h-10 rounded-full bg-secondary border border-border flex items-center justify-center"
            >
              <span className="text-sm">👤</span>
            </motion.div>
          ))}
          <div className="w-10 h-10 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center">
            <span className="text-sm">🙋</span>
          </div>
        </div>
      </div>

      {altBarber && position > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-5 mb-4 bg-card border border-primary/25 rounded-2xl p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Zap size={14} className="text-primary" />
            <span className="text-sm font-bold text-primary">{ar ? 'تخطَّ الانتظار' : 'Skip the Wait'}</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            <span className="text-foreground font-semibold">{altBarber.name}</span>{' '}
            {ar
              ? `متاح الآن — يوفّر عليك ~${waitLeft} دقيقة`
              : `is available now — saves you ~${waitLeft} min`}
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => navigate(`/book/${altBarber.id}`)}
              className="flex-1 h-8 rounded-xl bg-primary text-primary-foreground text-xs font-bold gap-1">
              <Zap size={12} /> {ar ? 'تحويل للحلاق' : 'Switch Barber'}
            </Button>
            <Button size="sm" variant="outline" className="flex-1 h-8 rounded-xl text-xs font-bold">
              {ar ? 'انتظر' : 'Keep Waiting'}
            </Button>
          </div>
        </motion.div>
      )}

      {waitLeft > 15 && (
        <div className="mx-5 mb-4 bg-card border border-border rounded-2xl p-4">
          <p className="text-xs text-muted-foreground">
            💡{' '}
            <span className="text-foreground font-semibold">{ar ? 'نصيحة ذكية:' : 'Smart Tip:'}</span>{' '}
            {ar
              ? `وقت الانتظار ~${waitLeft} دقيقة. يمكنك الخروج قليلاً وسنُعلمك عند اقتراب دورك.`
              : `Wait time is ~${waitLeft} min. Consider grabbing a coffee nearby and we'll notify you when you're next.`}
          </p>
        </div>
      )}

      <div className="mx-5 flex gap-2">
        <Button variant="outline" onClick={() => navigate(-1)} className="flex-1 h-12 rounded-2xl gap-2 text-destructive border-destructive/20">
          <LogOut size={16} />
          {ar ? 'مغادرة الطابور' : 'Leave Queue'}
        </Button>
        <Button onClick={() => setNotifyOn(!notifyOn)} className="flex-1 h-12 rounded-2xl gap-2 bg-primary text-primary-foreground font-bold">
          {notifyOn ? <Bell size={16} /> : <BellOff size={16} />}
          {notifyOn
            ? (ar ? 'الإشعارات مشغّلة' : 'Notify On')
            : (ar ? 'الإشعارات مطفأة' : 'Notify Off')}
        </Button>
      </div>
    </div>
  );
}
