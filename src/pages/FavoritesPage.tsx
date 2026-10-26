import { useState, useEffect } from 'react';
import { useSafeBack } from "@/hooks/useSafeBack";
import { ArrowLeft, Heart, Star, MapPin, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useBarbers } from '@/contexts/DataContext';
import { Barber } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { favPrefs } from '@/lib/userPrefs';
import { useBarberLiveStatus } from '@/hooks/useBarberLiveStatus';

type Tab = 'barbers';

function BarberFavCard({ barber, onRemove }: { barber: Barber; onRemove: () => void }) {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const ar = language === 'ar';
  const live = useBarberLiveStatus(barber);

  const statusLabel =
    live.status === 'closed'
      ? (ar ? 'مغلق' : 'Closed')
      : live.status === 'available'
        ? (ar ? 'متاح' : 'Available')
        : live.status === 'finishing_soon'
          ? (ar ? `بعد ${live.liveEta || 5}د` : `Free in ${live.liveEta || 5}m`)
          : (ar ? 'مشغول' : 'Busy');

  const statusColor =
    live.status === 'available' ? 'bg-green-500/10 text-green-600'
    : live.status === 'finishing_soon' ? 'bg-primary/10 text-primary'
    : 'bg-destructive/10 text-destructive';

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
      className="flex bg-card border border-border rounded-2xl overflow-hidden">
      <div className="relative w-24 flex-shrink-0 cursor-pointer" onClick={() => navigate(`/barbers/${barber.id}`)}>
        <img src={barber.coverImage} alt={barber.shopName} className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 p-3 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/barbers/${barber.id}`)}>
            <p className="font-bold text-foreground text-sm leading-tight truncate">{barber.shopName}</p>
            <p className="text-xs text-muted-foreground">{barber.name}</p>
          </div>
          <button onClick={onRemove} className="w-7 h-7 bg-destructive/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <Trash2 size={12} className="text-destructive" />
          </button>
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <Star size={11} className="text-primary fill-primary" />
          <span className="text-xs font-bold text-foreground">{barber.rating}</span>
          <MapPin size={10} className="text-muted-foreground ms-1" />
          <span className="text-xs text-muted-foreground">{barber.distance}</span>
        </div>
        <div className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColor}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${live.status === 'available' ? 'bg-green-500' : live.status === 'finishing_soon' ? 'bg-primary animate-pulse' : 'bg-destructive'}`} />
          {statusLabel}
        </div>
      </div>
    </motion.div>
  );
}

function SalonFavCard(_props: any) { return null; }

export default function FavoritesPage() {
  const navigate = useNavigate();
  const safeBack = useSafeBack();
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';
  const allBarbers = useBarbers();
  const [tab, setTab] = useState<Tab>('barbers');

  const [favBarberIds, setFavBarberIds] = useState<Set<string>>(() => favPrefs.getBarbers());

  useEffect(() => {
    const onStorage = () => {
      setFavBarberIds(favPrefs.getBarbers());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const favBarbers = allBarbers.filter(b => favBarberIds.has(b.id));

  const removeBarber = (id: string) => {
    favPrefs.removeBarber(id);
    setFavBarberIds(favPrefs.getBarbers());
  };

  return (
    <div className="min-h-screen pb-28 overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-3 px-5 pt-14 pb-4 sticky top-0 bg-background/95 backdrop-blur-sm z-10">
        <button onClick={() => safeBack()} className="w-10 h-10 bg-card border border-border rounded-full flex items-center justify-center">
          <ArrowLeft size={18} className={isRTL ? 'rotate-180' : ''} />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-foreground">{ar ? 'المفضلة' : 'Favorites'}</h1>
          <p className="text-xs text-muted-foreground">
            {favBarbers.length} {ar ? 'محفوظ' : 'saved'}
          </p>
        </div>
      </div>

      <div className="px-5 flex flex-col gap-3">
        <AnimatePresence>
          {favBarbers.length === 0 ? (
            <div className="text-center py-20">
              <Heart size={48} className="text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="font-semibold text-foreground">
                {ar ? 'لا يوجد حلاقين مفضلين' : 'No favorite barbers yet'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {ar ? 'اضغط القلب على أي حلاق لتحفظه' : 'Tap the heart on any barber to save them'}
              </p>
              <button onClick={() => navigate('/explore')} className="mt-5 bg-primary text-primary-foreground rounded-2xl px-5 py-2.5 text-sm font-bold">
                {ar ? 'استكشف الحلاقين' : 'Explore barbers'}
              </button>
            </div>
          ) : (
            favBarbers.map(b => (
              <BarberFavCard key={b.id} barber={b} onRemove={() => removeBarber(b.id)} />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
