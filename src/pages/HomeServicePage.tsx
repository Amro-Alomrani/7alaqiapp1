import { useMemo, useState } from 'react';
import { useSafeBack } from "@/hooks/useSafeBack";
import { ArrowLeft, MapPin, Zap, Clock, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { createBooking as createFirestoreBooking } from '@/lib/db';
import { useLiveBooking } from '@/contexts/LiveBookingContext';
import { toast } from 'sonner';
import type { Service, WorkingHours } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { getCurrentLocation } from '@/lib/location';

type Stage = 'form' | 'tracking';

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function buildTimeSlots(hours: WorkingHours | undefined, weekdayKey: string | undefined, selectedDay: number, duration: number) {
  if (!hours?.open || !hours.close || !weekdayKey || !hours.days?.includes(weekdayKey)) return [];
  const [openHour, openMinute] = hours.open.split(':').map(Number);
  const [closeHour, closeMinute] = hours.close.split(':').map(Number);
  const openAt = openHour * 60 + openMinute;
  const closeAt = closeHour * 60 + closeMinute;
  if (![openAt, closeAt, duration].every(Number.isFinite) || closeAt <= openAt || duration < 1) return [];
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const result: string[] = [];
  for (let start = openAt; start + duration <= closeAt; start += 30) {
    if (selectedDay === 0 && start <= currentMinutes) continue;
    result.push(`${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`);
  }
  return result;
}

function TrackingView({ barberName, barberAvatar, service, homeServiceFee, date, time }: { barberName: string; barberAvatar: string; service: Service; homeServiceFee: number; date: string; time: string }) {
  const { language } = useLanguage();
  const ar = language === 'ar';

  return (
    <div className="flex flex-col items-center text-center px-5 pt-20 gap-6">
      <div className="relative">
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="w-40 h-40 rounded-full bg-primary/10 border-2 border-primary/30 flex flex-col items-center justify-center"
        >
          <Clock size={46} className="text-primary" />
          <p className="text-sm font-bold text-primary mt-1">{ar ? 'بانتظار رد الحلاق' : 'Awaiting barber response'}</p>
        </motion.div>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
          className="absolute inset-0 rounded-full border-t-2 border-primary/40"
        />
      </div>

      <div>
        <p className="text-xl font-black text-foreground">
          {ar ? 'تم إرسال طلبك' : 'Your request was sent'}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {ar ? `تابع حالة الطلب في صفحة الحجوزات لدى ${barberName}` : `Follow the status in your bookings for ${barberName}`}
        </p>
      </div>

      <div className="w-full bg-card border border-border rounded-2xl flex items-center gap-3 p-4">
        <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-primary/10 flex items-center justify-center text-primary font-bold">
          <span>{barberName.charAt(0)}</span>
          {barberAvatar && <img src={barberAvatar} alt={barberName} onError={event => { event.currentTarget.style.display = 'none'; }} className="absolute inset-0 w-full h-full object-cover" />}
        </div>
        <div className={`flex-1 ${ar ? 'text-right' : 'text-left'}`}>
          <p className="font-bold text-foreground">{barberName}</p>
          <p className="text-xs text-muted-foreground">{service.icon} {service.name} · {date} {ar ? 'الساعة' : 'at'} {time}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-black text-primary">{service.price + homeServiceFee} JOD</p>
        </div>
      </div>

      <div className="w-full flex items-center gap-3">
        <div className="flex items-center gap-1.5 bg-card border border-border rounded-xl px-3 py-2 flex-1 justify-center">
          <span className="text-base">💈</span>
          <span className="text-xs text-muted-foreground font-medium">{ar ? 'موقع الحلاق' : 'Barber location'}</span>
        </div>
        <motion.div
          animate={{ width: '30%' }}
          transition={{ duration: 1 }}
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
  const safeBack = useSafeBack();
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';
  const { barbers, loadingBarbers, barbersError } = useData();
  const { customer } = useAuth();
  const { createBooking } = useLiveBooking();
  const [address, setAddress] = useState('');
  const [locating, setLocating] = useState(false);
  const [selectedBarberId, setSelectedBarberId] = useState('');
  const [selectedService, setSelectedService] = useState<Service | undefined>();
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedTime, setSelectedTime] = useState('');
  const [stage, setStage] = useState<Stage>('form');
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number }>();
  const [submitting, setSubmitting] = useState(false);
  const homeServiceBarbers = barbers.filter(b => b.offersHomeService === true && b.services?.length);
  const chosenBarber = homeServiceBarbers.find(b => b.id === selectedBarberId);
  const chosenService = chosenBarber?.services.find(s => s.id === selectedService?.id);
  const homeServiceFee = chosenBarber?.homeServiceFee ?? 0;
  const dates = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + i);
    const locale = ar ? 'ar-JO' : 'en-US';
    return {
      key: localDateKey(date),
      label: date.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' }),
      weekdayKey: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()],
    };
  }), [ar]);
  const slots = buildTimeSlots(chosenBarber?.workingHours, dates[selectedDay]?.weekdayKey, selectedDay, chosenService?.duration || 30);

  const detectLocation = () => {
    setLocating(true);
    void getCurrentLocation({ enableHighAccuracy: true, timeout: 30000, maximumAge: 60000 }).then(async pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, { signal: AbortSignal.timeout(8000) });
        const data = await res.json();
        setAddress(data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      } catch {
        setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
      setCoordinates({ lat, lng });
      toast.success(ar ? '📍 تم تحديد موقعك' : '📍 Location detected');
      setLocating(false);
    }).catch(() => {
        setLocating(false);
        toast.error(ar ? 'تعذر تحديد موقعك الآن' : 'Could not determine your location');
    });
  };

  const handleBook = async () => {
    if (!customer) {
      toast.error(ar ? 'سجّل الدخول أولاً لإتمام الحجز' : 'Please sign in to book');
      navigate('/login');
      return;
    }
    if (!chosenBarber || !chosenService || !dates[selectedDay] || !selectedTime || !address.trim()) {
      toast.error(ar ? 'أكمل اختيار الحلاق والخدمة والموعد والعنوان' : 'Choose a barber, service, time, and address');
      return;
    }
    setSubmitting(true);
    try {
      const date = dates[selectedDay].key;
      const time = selectedTime;
      const id = await createFirestoreBooking({
        customerUid: customer.uid,
        customerName: customer.name || 'Customer',
        customerPhone: customer.phone || '',
        customerAvatar: customer.avatar,
        barberId: chosenBarber.id,
        barberName: chosenBarber.name,
        barberShop: chosenBarber.shopName,
        barberAvatar: chosenBarber.avatar,
        service: chosenService,
        date,
        time,
        totalPrice: chosenService.price + homeServiceFee,
        tip: 0,
        homeServiceFee,
        homeService: true,
        payMethod: 'cash',
        pointsEarned: 0,
        notes: `Home service. Home service fee: ${homeServiceFee} JOD. Address: ${address.trim()}`,
        customerLocation: coordinates,
      });
      createBooking(chosenBarber.id, chosenBarber.id, chosenService, date, time, 0, 'cash', coordinates, id, homeServiceFee, true);
      setStage('tracking');
    } catch (error) {
      toast.error(ar ? 'تعذر إرسال الحجز. تحقق من الاتصال وحاول مجدداً.' : 'Could not send booking. Check your connection and try again.', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen overflow-y-auto pb-10" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-3 px-5 pt-14 pb-4">
        <button onClick={() => safeBack()} className="w-10 h-10 bg-card border border-border rounded-full flex items-center justify-center">
          <ArrowLeft size={18} className={isRTL ? 'rotate-180' : ''} />
        </button>
        <div>
          <h1 className="font-bold text-foreground">{ar ? 'خدمة منزلية' : 'Home Service'}</h1>
          <p className="text-xs text-muted-foreground">{ar ? 'طلب موعد منزلي بانتظار موافقة الحلاق' : 'Home visit request, subject to barber confirmation'}</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {stage === 'form' && (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-5 space-y-5">
            <div className="bg-primary/10 border border-primary/20 rounded-2xl p-5">
              <p className="text-2xl mb-1">🏠</p>
              <p className="font-bold text-foreground text-lg">{ar ? 'احجز حلاقاً في منزلك' : 'Book a barber at home'}</p>
              <p className="text-sm text-muted-foreground mt-1">{ar ? 'يراجع الحلاق الموعد والعنوان قبل تأكيد الطلب' : 'The barber reviews the time and address before confirming'}</p>
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
                  onChange={e => { setAddress(e.target.value); setCoordinates(undefined); }}
                  placeholder={ar ? 'أدخل عنوانك الكامل...' : 'Enter your full address...'}
                  className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground flex-1 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-bold text-foreground block mb-2">{ar ? 'اختر الحلاق' : 'Choose Barber'}</label>
              {loadingBarbers ? (
                <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" />{ar ? 'جارٍ تحميل الحلاقين...' : 'Loading barbers...'}</div>
              ) : barbersError ? (
                <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{ar ? 'تعذر تحميل الحلاقين. تحقق من اتصالك وحاول مجدداً.' : 'Could not load barbers. Check your connection and retry.'}</p>
              ) : homeServiceBarbers.length === 0 ? (
                <p className="rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
                  {ar ? 'لا يوجد حلاق فعّل استقبال طلبات الخدمة المنزلية بعد.' : 'No barber is currently accepting home-service requests.'}
                </p>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {homeServiceBarbers.map(b => (
                    <button
                      key={b.id}
                      onClick={() => { setSelectedBarberId(b.id); setSelectedService(undefined); setSelectedTime(''); }}
                      className={`flex-shrink-0 flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all ${chosenBarber?.id === b.id ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}
                    >
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-primary/10 flex items-center justify-center text-primary font-bold">
                        <span>{(b.shopName || b.name).charAt(0)}</span>
                        {b.avatar && <img src={b.avatar} alt={b.name} onError={event => { event.currentTarget.style.display = 'none'; }} className="absolute inset-0 w-full h-full object-cover" />}
                      </div>
                      <p className="text-[11px] font-semibold text-foreground text-center w-20 truncate">{b.shopName || b.name}</p>
                      <p className="text-[10px] text-primary font-bold">{ar ? 'خدمة منزلية' : 'Home service'}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {chosenBarber && (
              <div>
                <label className="text-sm font-bold text-foreground block mb-2">{ar ? `خدمات ${chosenBarber.shopName}` : `Services at ${chosenBarber.shopName}`}</label>
                <div className="flex flex-col gap-2">
                  {chosenBarber.services.map(s => (
                    <button
                      key={s.id}
                      onClick={() => { setSelectedService(s); setSelectedTime(''); }}
                      className={`flex items-center justify-between p-3.5 rounded-2xl border-2 transition-all ${ar ? 'text-right' : 'text-left'} ${chosenService?.id === s.id ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-xl">{s.icon || '✂️'}</span>
                          {s.photo && <img src={s.photo} alt="" onError={event => { event.currentTarget.style.display = 'none'; }} className="absolute inset-0 w-full h-full object-cover" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                          <div className="flex items-center gap-1">
                            <Clock size={10} className="text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{s.duration} {ar ? 'دقيقة' : 'min'}</span>
                          </div>
                        </div>
                      </div>
                      <p className="font-black text-primary flex-shrink-0">{s.price} JOD</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chosenBarber && chosenService && (
              <>
                <div>
                  <label className="text-sm font-bold text-foreground block mb-2">{ar ? 'اختر اليوم' : 'Choose a day'}</label>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {dates.map((date, index) => (
                      <button key={date.key} onClick={() => { setSelectedDay(index); setSelectedTime(''); }}
                        className={`flex-shrink-0 rounded-xl border px-3 py-2 text-xs font-bold ${selectedDay === index ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground'}`}>
                        {date.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-bold text-foreground block mb-2">{ar ? 'اختر وقتًا متاحًا حسب ساعات دوام الحلاق' : 'Choose a time within the barber’s listed hours'}</label>
                  {slots.length ? (
                    <div className="grid grid-cols-4 gap-2">
                      {slots.map(time => (
                        <button key={time} onClick={() => setSelectedTime(time)} className={`rounded-xl border py-2 text-sm font-bold ${selectedTime === time ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground'}`}>
                          {time}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
                      {ar ? 'لا توجد ساعات دوام مسجلة لهذا اليوم أو لا توجد أوقات متبقية. اختر يومًا آخر أو تواصل مع الحلاق.' : 'No working hours are listed for this day, or no time remains. Choose another day or contact the barber.'}
                    </p>
                  )}
                </div>
                <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">{ar ? 'سعر الخدمة' : 'Service price'}</span><span>{chosenService.price} JOD</span></div>
                  {homeServiceFee > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">{ar ? 'رسم الخدمة المنزلية الذي حدده الحلاق' : 'Home-service fee set by barber'}</span><span>{homeServiceFee} JOD</span></div>}
                  <div className="h-px bg-border" />
                  <div className="flex justify-between font-bold"><span>{ar ? 'الإجمالي النقدي عند تأكيد الحلاق' : 'Cash total if the barber confirms'}</span><span className="text-primary">{chosenService.price + homeServiceFee} JOD</span></div>
                </div>
              </>
            )}

            <Button
              onClick={() => void handleBook()}
              disabled={!address.trim() || !chosenBarber || !chosenService || !selectedTime || submitting}
              className="w-full h-14 text-base font-bold rounded-2xl bg-primary text-primary-foreground gap-2"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
              {ar
                ? (chosenService && selectedTime ? `أرسل طلب الخدمة المنزلية · ${chosenService.price + homeServiceFee} JOD` : 'اختر الحلاق والخدمة والموعد')
                : (chosenService && selectedTime ? `Request home service · ${chosenService.price + homeServiceFee} JOD` : 'Choose a barber, service, and time')}
            </Button>
          </motion.div>
        )}

        {stage === 'tracking' && chosenBarber && chosenService && (
          <motion.div key="tracking" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <TrackingView
              barberName={chosenBarber.name}
              barberAvatar={chosenBarber.avatar}
              service={chosenService}
              homeServiceFee={homeServiceFee}
              date={dates[selectedDay].key}
              time={selectedTime}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
