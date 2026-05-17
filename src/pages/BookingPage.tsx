import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Sparkles, Check, Calendar, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useBarber } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { createBooking as createFirestoreBooking } from '@/lib/db';
import { Service } from '@/types';
import { Button } from '@/components/ui/button';
import { useLiveBooking } from '@/contexts/LiveBookingContext';
import { useLanguage } from '@/contexts/LanguageContext';

function generateTimeSlots() {
  const slots: { id: string; time: string; available: boolean; aiRecommended: boolean }[] = [];
  for (let hour = 9; hour <= 21; hour++) {
    for (const m of [0, 30]) {
      const time = `${hour.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      slots.push({ id: `t${hour}${m}`, time, available: true, aiRecommended: hour === 14 || hour === 17 });
    }
  }
  return slots;
}

const DAYS_EN = ['Today', 'Tomorrow', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS_AR = ['اليوم', 'الغد', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد'];
const DATES = Array.from({ length: 7 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() + i);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
});

export default function BookingPage() {
  const { barberId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, language } = useLanguage();
  const barber = useBarber(barberId);
  const { customer } = useAuth();
  const { createBooking } = useLiveBooking();
  const DAYS = language === 'ar' ? DAYS_AR : DAYS_EN;

  const [step, setStep] = useState(0);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<{id: string, name: string, avatar: string} | null>(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tip, setTip] = useState(0);
  const [payMethod, setPayMethod] = useState<'cash' | 'wallet'>('cash');
  const [selectedWalletLabel, setSelectedWalletLabel] = useState<string>('');
  const slots = generateTimeSlots();
  const tipOptions = [0, 5, 10, 15];

  useEffect(() => {
    if (!barber) return;
    const searchParams = new URLSearchParams(location.search);
    const serviceId = searchParams.get('service');
    const staffId = searchParams.get('staff');

    if (serviceId) {
      const s = (barber.services || []).find(x => x.id === serviceId);
      if (s) { setSelectedService(s); setStep(1); }
    }
    if (staffId && (barber as any).staff) {
      const s = ((barber as any).staff as any[]).find(x => x.id === staffId);
      if (s) setSelectedStaff({ id: s.id, name: s.name, avatar: s.avatar });
    }

    const state = location.state as { fromChat?: boolean; suggestedService?: string; suggestedDate?: string; suggestedTime?: string } | null;
    if (!state?.fromChat) return;
    if (state.suggestedService) {
      const match = (barber.services || []).find(s =>
        s.name.toLowerCase() === state.suggestedService!.toLowerCase() ||
        s.name.toLowerCase().includes(state.suggestedService!.toLowerCase()) ||
        state.suggestedService!.toLowerCase().includes(s.name.toLowerCase())
      );
      if (match) {
        setSelectedService(match);
        setStep(1);
      }
    }
    if (state.suggestedDate) {
      const idx = DAYS_EN.findIndex(d => d.toLowerCase() === state.suggestedDate!.toLowerCase());
      if (idx >= 0) setSelectedDay(idx);
    }
    if (state.suggestedTime) {
      const slot = slots.find(s => s.time === state.suggestedTime && s.available);
      if (slot) setSelectedTime(slot.time);
    }
  }, [barber?.id]);

  if (!barber) return null;

  const handleConfirm = async () => {
    if (!selectedService || !selectedTime || loading) return;
    setLoading(true);
    try {
      const customerLocation = await (async () => {
        if (!navigator.geolocation) return undefined;
        try {
          const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, {timeout: 3000}));
          return { lat: pos.coords.latitude, lng: pos.coords.longitude };
        } catch { return undefined; }
      })();

      let firestoreId: string | undefined;
      if (customer) {
        try {
          firestoreId = await createFirestoreBooking({
            customerUid: customer.uid,
            customerName: customer.name || 'Customer',
            customerPhone: customer.phone || '',
            customerAvatar: customer.avatar,
            barberId: barber.id,
            barberName: barber.name,
            barberShop: barber.shopName,
            barberAvatar: barber.avatar,
            staffId: selectedStaff?.id,
            staffName: selectedStaff?.name,
            staffAvatar: selectedStaff?.avatar,
            service: selectedService,
            date: DATES[selectedDay],
            time: selectedTime,
            totalPrice: selectedService.price + tip,
            pointsEarned: Math.round(selectedService.price * 2),
          });
        } catch {
        }
      }

      createBooking(
        barber.id,
        barber.id,
        selectedService,
        DATES[selectedDay],
        selectedTime,
        tip,
        payMethod,
        customerLocation,
        firestoreId
      );

      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
          await Notification.requestPermission();
        }
      } catch {  }

      toast.success(t.booking.success, { description: t.booking.successDesc });
      await new Promise(r => setTimeout(r, 600));
      navigate('/booking-status');
    } catch (err) {
      toast.error(t.common.error);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex items-center gap-4 px-5 pt-14 pb-4">
        <button onClick={() => step > 0 ? setStep(s => s - 1) : navigate(-1)}
          className="w-10 h-10 bg-card border border-border rounded-full flex items-center justify-center">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="font-bold text-foreground">{t.booking.title}</h1>
          <p className="text-xs text-muted-foreground">{barber.shopName}</p>
        </div>
      </div>

      <div className="px-5 mb-6">
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-500 ${i <= step ? 'bg-primary' : 'bg-secondary'}`} />
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">{t.booking.stepOf.replace('{current}', String(step + 1)).replace('{total}', '3')}</p>
      </div>

      <div className="flex-1 px-5 pb-36 overflow-y-auto">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="text-lg font-bold mb-4">{t.booking.chooseService}</h2>
              <div className="flex flex-col gap-3">
                {(barber.services || []).map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedService(s)}
                    className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left ${selectedService?.id === s.id ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{s.icon}</span>
                      <div>
                        <p className="font-semibold text-foreground">{s.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.duration} {t.booking.min}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-primary">{s.price} JOD</p>
                      {selectedService?.id === s.id && <Check size={16} className="text-primary" />}
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="text-lg font-bold mb-1">{t.booking.pickDateTime}</h2>
              <div className="flex items-center gap-2 mb-4 bg-primary/10 border border-primary/20 rounded-xl px-3 py-2">
                <Sparkles size={14} className="text-primary" />
                <p className="text-xs text-primary font-medium">{t.booking.aiSuggestion}</p>
              </div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2"><Calendar size={14} />{t.booking.selectDay}</h3>
              <div className="flex gap-2 overflow-x-auto pb-2 mb-5">
                {DAYS.map((d, i) => (
                  <button key={d} onClick={() => setSelectedDay(i)}
                    className={`flex-shrink-0 flex flex-col items-center px-4 py-2.5 rounded-xl border-2 transition-all ${selectedDay === i ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}>
                    <span className={`text-xs font-medium ${selectedDay === i ? 'text-primary' : 'text-muted-foreground'}`}>{d}</span>
                    <span className={`text-sm font-bold mt-0.5 ${selectedDay === i ? 'text-primary' : 'text-foreground'}`}>{DATES[i].split(' ')[1]}</span>
                  </button>
                ))}
              </div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2"><Clock size={14} />{t.booking.selectTime}</h3>
              <div className="grid grid-cols-3 gap-2">
                {slots.map(slot => (
                  <button
                    key={slot.id}
                    disabled={!slot.available}
                    onClick={() => setSelectedTime(slot.time)}
                    className={`relative py-2.5 rounded-xl border-2 text-xs font-semibold transition-all ${
                      !slot.available ? 'border-border bg-secondary/30 text-muted-foreground/40 line-through cursor-not-allowed'
                      : selectedTime === slot.time ? 'border-primary bg-primary text-primary-foreground'
                      : slot.aiRecommended ? 'border-primary/40 bg-primary/5 text-foreground'
                      : 'border-border bg-card text-foreground'
                    }`}
                  >
                    {slot.time}
                    {slot.aiRecommended && slot.available && selectedTime !== slot.time && (
                      <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-primary rounded-full flex items-center justify-center">
                        <Sparkles size={8} className="text-primary-foreground" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="text-lg font-bold mb-4">{t.booking.confirm}</h2>
              <div className="bg-card border border-border rounded-2xl overflow-hidden mb-4">
                <div className="flex items-center gap-3 p-4 border-b border-border">
                  <img src={barber.avatar} alt={barber.name} className="w-12 h-12 rounded-xl object-cover" />
                  <div>
                    <p className="font-bold text-foreground">{barber.shopName}</p>
                    <p className="text-sm text-muted-foreground">{barber.name}</p>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  {[
                    { label: t.booking.service, value: `${selectedService?.icon} ${selectedService?.name}` },
                    { label: t.booking.duration, value: `${selectedService?.duration} ${t.booking.min}` },
                    { label: t.booking.date, value: `${DAYS[selectedDay]}, ${DATES[selectedDay]}` },
                    { label: t.booking.time, value: selectedTime || '' },
                    { label: t.booking.address, value: barber.address },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <span className="text-sm font-semibold text-foreground">{value}</span>
                    </div>
                  ))}
                  <div className="border-t border-border pt-3 flex items-center justify-between">
                    <span className="font-bold text-foreground">{t.booking.total}</span>
                    <span className="font-black text-xl text-primary">{(selectedService?.price || 0) + tip} JOD</span>
                  </div>
                </div>
              </div>
              <div className="bg-card border border-border rounded-2xl p-4 mb-3">
                <p className="text-sm font-bold text-foreground mb-3">{t.booking.payment}</p>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { key: 'cash' as const, label: t.booking.cash, icon: '💵' },
                    { key: 'wallet' as const, label: 'Zain Cash', icon: '📱' },
                    { key: 'wallet' as const, label: 'Orange Money', icon: '🟠' },
                    { key: 'wallet' as const, label: 'eFAWATEERcom', icon: '🏦' },
                  ]).map((m, idx) => {
                    const active = payMethod === m.key && (m.key === 'cash' ? idx === 0 : selectedWalletLabel === m.label);
                    return (
                      <button key={m.label} onClick={() => { setPayMethod(m.key); if (m.key === 'wallet') setSelectedWalletLabel(m.label); else setSelectedWalletLabel(''); }}
                        className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${active ? 'border-primary bg-primary/10' : 'border-border bg-secondary'}`}>
                        <span className="text-base">{m.icon}</span>
                        <span className={`text-xs font-semibold flex-1 text-left ${active ? 'text-primary' : 'text-muted-foreground'}`}>{m.label}</span>
                        {active && <Check size={14} className="text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bg-card border border-border rounded-2xl p-4 mb-3">
                <p className="text-sm font-bold text-foreground mb-1">{t.booking.tipTitle}</p>
                <p className="text-xs text-muted-foreground mb-3">{t.booking.tipSubtitle}</p>
                <div className="grid grid-cols-4 gap-2">
                  {tipOptions.map(tv => (
                    <button key={tv} onClick={() => setTip(tv)}
                      className={`py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${tip === tv ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-secondary text-foreground'}`}>
                      {tv === 0 ? t.booking.tipNone : `${tv}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">{t.booking.service}</span>
                  <span className="text-sm font-semibold text-foreground">{selectedService?.price} JOD</span>
                </div>
                {tip > 0 && (
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">{t.booking.tip}</span>
                    <span className="text-sm font-semibold text-foreground">+{tip} JOD</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-primary/20 pt-2">
                  <span className="font-bold text-foreground">{t.booking.total}</span>
                  <span className="font-black text-xl text-primary">{(selectedService?.price || 0) + tip} JOD</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-base">🎁</span>
                  <p className="text-xs text-foreground">{t.booking.earnPoints} <span className="text-primary font-bold">{Math.floor((selectedService?.price || 0) * 2)}</span> {t.booking.earnPointsSuffix}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="fixed bottom-4 left-0 right-0 flex justify-center px-5 z-40">
        <div className="w-full max-w-sm">
          {step < 2 ? (
            <Button
              onClick={() => setStep(s => s + 1)}
              disabled={(step === 0 && !selectedService) || (step === 1 && !selectedTime)}
              className="w-full h-14 text-base font-bold rounded-2xl bg-primary text-primary-foreground"
            >
              {step === 0 ? t.booking.next : t.booking.review}
            </Button>
          ) : (
            <Button
              onClick={handleConfirm}
              disabled={loading}
              className="w-full h-14 text-base font-bold rounded-2xl bg-primary text-primary-foreground"
            >
              {loading ? t.booking.confirming : t.booking.confirmCta}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
