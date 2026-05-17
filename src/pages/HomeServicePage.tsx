import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Zap, Clock, Check, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useBarbers } from '@/contexts/DataContext';
import { toast } from 'sonner';
import type { Service } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';

const allServices: Service[] = [
  { id: 's1', name: 'Haircut', duration: 30, price: 15, icon: '✂️' },
  { id: 's2', name: 'Beard Trim', duration: 20, price: 8, icon: '🪒' },
  { id: 's3', name: 'Haircut + Beard', duration: 45, price: 20, icon: '💈' },
  { id: 's4', name: 'Hair Wash', duration: 15, price: 5, icon: '🚿' },
];

type Stage = 'form' | 'confirming' | 'tracking';

function TrackingView({ barberName, barberAvatar, service }: { barberName: string; barberAvatar: string; service: Service }) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const [eta] = useState(18);
  const [arrived, setArrived] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setArrived(true), 6000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-col items-center text-center px-5 pt-20 gap-6">
      <div className="relative">
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="w-40 h-40 rounded-full bg-primary/10 border-2 border-primary/30 flex flex-col items-center justify-center"
        >
          {arrived ? (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
              <Check size={52} className="text-primary" />
              <p className="text-sm font-bold text-primary mt-1">{ar ? 'وصل!' : 'Arrived!'}</p>
            </motion.div>
          ) : (
            <>
              <p className="text-4xl font-black text-primary">{eta}</p>
              <p className="text-xs text-muted-foreground">{ar ? 'دقيقة' : 'min away'}</p>
            </>
          )}
        </motion.div>
        {!arrived && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
            className="absolute inset-0 rounded-full border-t-2 border-primary/40"
          />
        )}
      </div>

      <div>
        <p className="text-xl font-black text-foreground">
          {arrived
            ? (ar ? 'وصل الحلاق!' : 'Your barber has arrived!')
            : (ar ? 'الحلاق في الطريق...' : 'Barber en route...')}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {arrived
            ? (ar ? 'افتح الباب واستعد ✂️' : 'Open the door and get ready ✂️')
            : (ar ? `${barberName} في طريقه إليك` : `${barberName} is heading to your location`)}
        </p>
      </div>

      <div className="w-full bg-card border border-border rounded-2xl flex items-center gap-3 p-4">
        <img src={barberAvatar} alt={barberName} className="w-12 h-12 rounded-xl object-cover" />
        <div className={`flex-1 ${ar ? 'text-right' : 'text-left'}`}>
          <p className="font-bold text-foreground">{barberName}</p>
          <p className="text-xs text-muted-foreground">{service.icon} {service.name} · {service.duration} {ar ? 'دقيقة' : 'min'}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-black text-primary">{service.price} JOD</p>
        </div>
      </div>

      <div className="w-full flex items-center gap-3">
        <div className="flex items-center gap-1.5 bg-card border border-border rounded-xl px-3 py-2 flex-1 justify-center">
          <span className="text-base">💈</span>
          <span className="text-xs text-muted-foreground font-medium">{ar ? 'موقع الحلاق' : 'Barber location'}</span>
        </div>
        <motion.div
          animate={{ width: arrived ? '100%' : ['10%', '70%'] }}
          transition={{ duration: 5 }}
          className="h-1 bg-primary rounded-full flex-1"
        />
        <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-xl px-3 py-2 flex-1 justify-center">
          <MapPin size={12} className="text-primary" />
          <span className="text-xs text-primary font-bold">{ar ? 'منزلك' : 'Your Home'}</span>
        </div>
      </div>
    </div>
  );
}

export default function HomeServicePage() {
  const navigate = useNavigate();
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';
  const barbers = useBarbers();
  const [address, setAddress] = useState('');
  const [locating, setLocating] = useState(false);
  const [selectedBarber, setSelectedBarber] = useState<typeof barbers[number] | undefined>(barbers[0]);
  const [selectedService, setSelectedService] = useState<Service>(allServices[0]);
  const [stage, setStage] = useState<Stage>('form');

  const detectLocation = () => {
    if (!navigator.geolocation) {
      toast.error(ar ? 'الجهاز لا يدعم GPS' : 'GPS not supported on this device');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          const { lat, lng } = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
          const data = await res.json();
          const addr = data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          setAddress(addr);
          toast.success(ar ? '📍 تم تحديد موقعك' : '📍 Location detected');
        } catch {
          setAddress(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
        }
        setLocating(false);
      },
      err => {
        setLocating(false);
        toast.error(err.code === 1
          ? (ar ? 'فعّل إذن الموقع من المتصفح' : 'Enable location permission in browser')
          : (ar ? 'فشل تحديد الموقع' : 'Failed to detect location'));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  useEffect(() => {
    if (barbers.length > 0 && !selectedBarber) setSelectedBarber(barbers[0]);
  }, [barbers]);

  const handleBook = () => {
    setStage('confirming');
    setTimeout(() => setStage('tracking'), 2000);
  };

  const availableBarbers = barbers.filter(b => b.available);

  return (
    <div className="min-h-screen overflow-y-auto pb-10" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-3 px-5 pt-14 pb-4">
        <button onClick={() => navigate(-1)} className="w-10 h-10 bg-card border border-border rounded-full flex items-center justify-center">
          <ArrowLeft size={18} className={isRTL ? 'rotate-180' : ''} />
        </button>
        <div>
          <h1 className="font-bold text-foreground">{ar ? 'خدمة منزلية' : 'Home Service'}</h1>
          <p className="text-xs text-muted-foreground">{ar ? 'الحلاق يأتي إليك' : 'We come to you'}</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {stage === 'form' && (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-5 space-y-5">
            <div className="bg-primary/10 border border-primary/20 rounded-2xl p-5">
              <p className="text-2xl mb-1">🏠</p>
              <p className="font-bold text-foreground text-lg">{ar ? 'احجز حلاقاً في منزلك' : 'Book a barber at home'}</p>
              <p className="text-sm text-muted-foreground mt-1">{ar ? 'خدمة فاخرة تصل إلى بابك' : 'Premium service delivered to your door'}</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-bold text-foreground">{ar ? 'عنوانك' : 'Your Address'}</label>
                <button
                  type="button"
                  onClick={detectLocation}
                  disabled={locating}
                  className="flex items-center gap-1 text-xs font-bold text-primary disabled:opacity-50"
                >
                  {locating ? <Loader2 size={12} className="animate-spin" /> : <MapPin size={12} />}
                  {locating ? (ar ? 'جارٍ التحديد...' : 'Detecting...') : (ar ? 'استخدم موقعي' : 'Use my location')}
                </button>
              </div>
              <div className="flex items-center gap-3 bg-card border border-border rounded-2xl px-4 py-3">
                <MapPin size={16} className="text-primary flex-shrink-0" />
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder={ar ? 'أدخل عنوانك الكامل...' : 'Enter your full address...'}
                  className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground flex-1 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-bold text-foreground block mb-2">{ar ? 'اختر الحلاق' : 'Choose Barber'}</label>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {availableBarbers.map(b => (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBarber(b)}
                    className={`flex-shrink-0 flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all ${selectedBarber?.id === b.id ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}
                  >
                    <img src={b.avatar} alt={b.name} className="w-12 h-12 rounded-xl object-cover" />
                    <p className="text-[11px] font-semibold text-foreground text-center w-16 truncate">{b.name.split(' ')[0]}</p>
                    <p className="text-[10px] text-primary font-bold">{b.avgDuration}{ar ? 'د' : 'm'}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-bold text-foreground block mb-2">{ar ? 'اختر الخدمة' : 'Choose Service'}</label>
              <div className="flex flex-col gap-2">
                {allServices.slice(0, 4).map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedService(s)}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border-2 transition-all ${ar ? 'text-right' : 'text-left'} ${selectedService.id === s.id ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{s.icon}</span>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{s.name}</p>
                        <div className="flex items-center gap-1">
                          <Clock size={10} className="text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{s.duration} {ar ? 'دقيقة' : 'min'}</span>
                        </div>
                      </div>
                    </div>
                    <p className="font-black text-primary">{s.price + 5} JOD</p>
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleBook}
              disabled={!address.trim()}
              className="w-full h-14 text-base font-bold rounded-2xl bg-primary text-primary-foreground gap-2"
            >
              <Zap size={18} />
              {ar
                ? `احجز خدمة منزلية · ${selectedService.price + 5} JOD`
                : `Book Home Service · ${selectedService.price + 5} JOD`}
            </Button>
          </motion.div>
        )}

        {stage === 'confirming' && (
          <motion.div key="confirming" className="flex flex-col items-center justify-center h-96 gap-4 px-5">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              className="w-16 h-16 rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-lg font-bold text-foreground">{ar ? 'جارٍ تأكيد حجزك...' : 'Confirming your booking...'}</p>
          </motion.div>
        )}

        {stage === 'tracking' && selectedBarber && (
          <motion.div key="tracking" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <TrackingView
              barberName={selectedBarber.name}
              barberAvatar={selectedBarber.avatar}
              service={selectedService}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
