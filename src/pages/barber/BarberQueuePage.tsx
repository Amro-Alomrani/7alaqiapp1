import { useState } from 'react';
import { Users, ChevronUp, ChevronDown, Bell, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiveBooking } from '@/contexts/LiveBookingContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { BarberQueueItem } from '@/types';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

function QueueCard({ item, onMoveUp, onMoveDown, onComplete, isFirst, isLast, ar }:
  { item: BarberQueueItem; onMoveUp: () => void; onMoveDown: () => void; onComplete: () => void; isFirst: boolean; isLast: boolean; ar: boolean }) {
  const isActive = item.status === 'in_service';
  return (
    <motion.div layout className={`flex items-center gap-3 p-4 rounded-2xl border-2 ${isActive ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}>
      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: isActive ? 'hsl(var(--primary)/0.2)' : 'hsl(var(--secondary))' }}>
        <span className={`text-sm font-black ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>{item.position}</span>
      </div>
      <img src={item.customerAvatar} alt={item.customerName} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-bold text-foreground text-sm">{item.customerName}</p>
          {isActive && <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
        </div>
        <p className="text-xs text-muted-foreground">{item.serviceName}</p>
        {item.waitTime > 0 && (
          <p className="text-xs text-muted-foreground mt-0.5">
            ~{item.waitTime} {ar ? 'دقيقة انتظار' : 'min wait'}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1">
        {!isActive && (
          <>
            <button onClick={onMoveUp} disabled={isFirst} className="w-7 h-7 bg-secondary rounded-lg flex items-center justify-center disabled:opacity-30">
              <ChevronUp size={14} />
            </button>
            <button onClick={onMoveDown} disabled={isLast} className="w-7 h-7 bg-secondary rounded-lg flex items-center justify-center disabled:opacity-30">
              <ChevronDown size={14} />
            </button>
          </>
        )}
        {isActive && (
          <button onClick={onComplete} className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center">
            <CheckCircle size={16} className="text-primary-foreground" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

export default function BarberQueuePage() {
  const { barberUser } = useAuth();
  const { getBarberBookings } = useLiveBooking();
  const { language } = useLanguage();
  const ar = language === 'ar';

  const myBookings = getBarberBookings(barberUser?.uid || '');
  const initialQueue: BarberQueueItem[] = myBookings
    .filter(b => b.status === 'accepted' || b.status === 'preparing' || b.status === 'your_turn' || b.status === 'in_progress')
    .map((b, i) => ({
      id: b.id,
      position: i + 1,
      customerName: b.customerName || (ar ? 'عميل' : 'Customer'),
      customerAvatar: b.customerAvatar || '/logo.png',
      serviceName: b.service?.name || (ar ? 'خدمة' : 'Service'),
      waitTime: i * 15,
      status: b.status === 'in_progress' ? 'in_service' as const : 'waiting' as const,
    }));
  const [queue, setQueue] = useState<BarberQueueItem[]>(initialQueue);

  const move = (idx: number, dir: 'up' | 'down') => {
    const target = dir === 'up' ? idx - 1 : idx + 1;
    const newQ = [...queue];
    [newQ[idx], newQ[target]] = [newQ[target], newQ[idx]];
    setQueue(newQ.map((q, i) => ({ ...q, position: i + 1 })));
  };

  const complete = (id: string) => {
    setQueue(prev =>
      prev.filter(q => q.id !== id)
        .map((q, i) => ({ ...q, position: i + 1, status: i === 0 ? 'in_service' as const : 'waiting' as const }))
    );
    toast(ar ? '✅ تم إنهاء الخدمة! تم إشعار العميل التالي.' : '✅ Customer marked as done! Next in queue notified.');
  };

  const callNext = () =>
    toast(ar ? '📱 تم إشعار العميل التالي: "حان دورك!"' : '📱 SMS sent to next customer: "Your turn is ready!"');

  return (
    <div className="overflow-y-auto" dir={ar ? 'rtl' : 'ltr'}>
      <div className="px-5 pt-14 pb-5">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-black text-foreground">{ar ? 'قائمة الانتظار' : 'Live Queue'}</h1>
          <div className="flex items-center gap-1.5 bg-primary/10 px-3 py-1.5 rounded-full">
            <Users size={13} className="text-primary" />
            <span className="text-sm font-bold text-primary">{queue.length} {ar ? 'في الانتظار' : 'waiting'}</span>
          </div>
        </div>
        {queue.length > 1 && (
          <p className="text-sm text-muted-foreground">
            {ar ? 'اسحب لإعادة الترتيب · أكمل للتقدم في القائمة' : 'Drag to reorder · Complete to advance queue'}
          </p>
        )}
      </div>

      <div className="px-5 mb-5">
        <Button onClick={callNext} variant="outline" className="w-full h-11 rounded-2xl gap-2 border-primary/30 text-primary font-bold">
          <Bell size={16} />
          {ar ? 'إشعار العميل التالي' : 'Notify Next Customer'}
        </Button>
      </div>

      <div className="px-5 flex flex-col gap-3">
        <AnimatePresence>
          {queue.map((item, i) => (
            <QueueCard
              key={item.id}
              item={item}
              ar={ar}
              isFirst={i === 0}
              isLast={i === queue.length - 1}
              onMoveUp={() => move(i, 'up')}
              onMoveDown={() => move(i, 'down')}
              onComplete={() => complete(item.id)}
            />
          ))}
        </AnimatePresence>
        {queue.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🎉</p>
            <p className="font-semibold text-foreground">{ar ? 'القائمة فارغة!' : 'Queue is clear!'}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {ar ? 'لا يوجد عملاء في الانتظار الآن' : 'No customers waiting right now'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
