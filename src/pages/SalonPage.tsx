import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, MapPin, QrCode, Navigation, Sparkles, Clock, Image as ImageIcon, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBarber, useBarbers } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import CrowdIndicator from '@/components/salon/CrowdIndicator';
import BarberPickerCard from '@/components/salon/BarberPickerCard';

type Filter = 'all' | 'available' | 'fastest';

function QrScanModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [phase, setPhase] = useState<'scanning' | 'success'>('scanning');
  const { language } = useLanguage();
  const ar = language === 'ar';

  useEffect(() => {
    const t = setTimeout(() => {
      setPhase('success');
      setTimeout(onSuccess, 1200);
    }, 2200);
    return () => clearTimeout(t);
  }, [onSuccess]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center px-8"
      onClick={onClose}
    >
      <div className="relative w-64 h-64 mb-6">
        <div className="absolute inset-0 border-2 border-primary/30 rounded-3xl" />
        {['tl', 'tr', 'bl', 'br'].map(c => (
          <div key={c} className={`absolute w-8 h-8 border-primary border-[3px] rounded-lg
            ${c.includes('t') ? 'top-0' : 'bottom-0'} ${c.includes('l') ? 'left-0' : 'right-0'}
            ${c.includes('t') ? (c.includes('l') ? 'border-b-0 border-r-0 rounded-br-none rounded-bl-none rounded-tr-none' : 'border-b-0 border-l-0 rounded-bl-none rounded-tl-none rounded-br-none') : (c.includes('l') ? 'border-t-0 border-r-0 rounded-tr-none rounded-br-none rounded-tl-none' : 'border-t-0 border-l-0 rounded-tl-none rounded-bl-none rounded-tr-none')}`}
          />
        ))}
        {phase === 'scanning' ? (
          <motion.div
            animate={{ y: [0, 192, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
            className="absolute left-2 right-2 h-0.5 bg-primary shadow-lg"
            style={{ boxShadow: '0 0 12px 3px hsl(var(--primary)/0.6)' }}
          />
        ) : (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center">
              <span className="text-4xl">✓</span>
            </div>
          </motion.div>
        )}
      </div>
      <p className="text-xl font-bold text-foreground">
        {phase === 'scanning'
          ? (ar ? 'جارٍ مسح رمز QR...' : 'Scanning QR Code...')
          : (ar ? 'تم تسجيل الدخول! 🎉' : 'Checked In! 🎉')}
      </p>
      <p className="text-sm text-muted-foreground mt-1">
        {phase === 'scanning'
          ? (ar ? 'أبقِ الكاميرا ثابتة' : 'Hold camera steady')
          : (ar ? 'تمت إضافتك للطابور' : "You're added to the queue")}
      </p>
    </motion.div>
  );
}

export default function SalonPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const barber = useBarber(id);
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';
  const [filter, setFilter] = useState<Filter>('all');
  const [showQr, setShowQr] = useState(false);

  if (!barber) return null;

  const salonBarbers = [barber];
  const filtered = salonBarbers
    .filter(b => filter === 'available' ? b.liveStatus === 'available' : true)
    .sort((a, b) => filter === 'fastest' ? a.avgDuration - b.avgDuration : 0);
  const bestMatch = salonBarbers.find(b => b.liveStatus === 'available') || salonBarbers[0];

  const handleQrSuccess = () => {
    setShowQr(false);
    navigate('/queue', { state: { barberId: bestMatch.id, barberName: bestMatch.name, barberAvatar: bestMatch.avatar, position: (bestMatch.queueCount || 0) + 1, waitTime: bestMatch.avgDuration || 15, salonName: barber.shopName || barber.name } });
  };

  return (
    <div className="min-h-screen pb-28 overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
      <AnimatePresence>{showQr && <QrScanModal onClose={() => setShowQr(false)} onSuccess={handleQrSuccess} />}</AnimatePresence>

      <div className="relative h-56">
        {barber.coverImage ? (
          <img src={barber.coverImage} alt={barber.shopName || barber.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center text-white text-5xl font-bold">{barber.name?.[0] || '?'}</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
        <button onClick={() => navigate(-1)} className="absolute top-12 left-5 w-10 h-10 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center">
          <ArrowLeft size={20} className="text-white" />
        </button>
        {!barber.available && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
            <span className="text-foreground font-bold text-lg">
              {ar ? 'غير متاح حالياً' : 'Currently Unavailable'}
            </span>
          </div>
        )}
      </div>

      <div className="px-5 mt-2">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="text-xl font-black text-foreground">{barber.shopName || barber.name}</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <MapPin size={12} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{barber.address || (ar ? 'عمّان، الأردن' : 'Amman, Jordan')}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-primary/10 px-2.5 py-1.5 rounded-full">
            <Star size={13} className="text-primary fill-primary" />
            <span className="text-sm font-bold text-primary">{barber.rating?.toFixed(1) || '5.0'}</span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-3 flex items-center gap-3 mt-4">
          <Clock size={16} className="text-primary" />
          <div className="flex-1">
            <p className="text-xs font-bold text-foreground">
              {barber.workingHours?.open || '09:00'} - {barber.workingHours?.close || '21:00'}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {barber.workingHours?.days.join(', ') || (ar ? 'الاثنين - السبت' : 'Mon - Sat')}
            </p>
          </div>
          <div className="px-2 py-1 bg-green-500/10 rounded-lg">
            <span className="text-[10px] text-green-500 font-bold uppercase">{ar ? 'مفتوح' : 'Open'}</span>
          </div>
        </div>

        {barber.gallery && barber.gallery.length > 0 && (
          <div className="mt-6">
            <h2 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
              <ImageIcon size={16} className="text-primary" />
              {ar ? 'معرض الصور' : 'Gallery'}
            </h2>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-5 px-5 no-scrollbar">
              {barber.gallery.map((img, i) => (
                <img key={i} src={img} className="w-32 h-32 rounded-xl object-cover shrink-0 border border-border" />
              ))}
            </div>
          </div>
        )}

        {barber.staff && barber.staff.length > 0 && (
          <div className="mt-6">
            <h2 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
              <Users size={16} className="text-primary" />
              {ar ? 'فريق الحلاقين' : 'Our Barbers'}
            </h2>
            <div className="flex flex-col gap-2">
              {barber.staff.map((s) => (
                <div key={s.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                  <img src={s.avatar} className="w-12 h-12 rounded-xl object-cover" />
                  <div className="flex-1">
                    <p className="text-sm font-bold">{s.name}</p>
                    <p className="text-[10px] text-muted-foreground">{s.specialties.join(', ')}</p>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1 text-[10px] text-yellow-500 font-bold">
                      <Star size={10} fill="currentColor" /> {s.rating.toFixed(1)}
                    </div>
                    <button
                      onClick={() => navigate(`/book/${barber.id}?staff=${s.id}`)}
                      className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-1 rounded-lg"
                    >
                      {ar ? 'حجز' : 'Book'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 mb-6">
          <h2 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
            <Sparkles size={16} className="text-primary" />
            {ar ? 'الخدمات' : 'Services'}
          </h2>
          <div className="space-y-2">
            {(barber.services || []).length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                {ar ? 'لا توجد خدمات مضافة بعد.' : 'No services listed yet.'}
              </p>
            ) : (
              barber.services.map((s: any) => (
                <div key={s.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-lg">{s.icon || '✂️'}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{s.name}</p>
                    <p className="text-[10px] text-muted-foreground">{s.duration} {ar ? 'دقيقة' : 'min'}</p>
                  </div>
                  <div className="text-right me-2">
                    <p className="text-sm font-black text-primary">{s.price} JOD</p>
                  </div>
                  <Button
                    onClick={() => navigate(`/book/${barber.id}?service=${s.id}`)}
                    className="h-8 px-3 rounded-lg text-xs"
                  >
                    {ar ? 'أختر' : 'Pick'}
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
