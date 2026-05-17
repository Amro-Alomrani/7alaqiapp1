import { Activity, Clock, Scissors, Lock } from 'lucide-react';
import { Barber } from '@/types';
import { useBarberLiveStatus } from '@/hooks/useBarberLiveStatus';
import { useLanguage } from '@/contexts/LanguageContext';

export default function LiveStatusBadge({ barber }: { barber: Barber }) {
  const live = useBarberLiveStatus(barber);
  const { language } = useLanguage();
  const ar = language === 'ar';

  if (live.status === 'closed') {
    return (
      <div className="flex items-center gap-3 bg-destructive/10 border border-destructive/25 rounded-2xl px-4 py-3 mb-1">
        <div className="w-3 h-3 rounded-full bg-destructive flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-bold text-destructive">{ar ? 'الصالون مغلق' : 'Shop Closed'}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {live.liveActivity || (ar ? 'الحلاق غير متاح حالياً' : 'The barber is currently offline')}
          </p>
        </div>
        <Lock size={16} className="text-destructive" />
      </div>
    );
  }

  if (live.status === 'available') {
    return (
      <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/25 rounded-2xl px-4 py-3 mb-1">
        <div className="relative flex-shrink-0">
          <div className="w-3 h-3 rounded-full bg-green-400" />
          <span className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-75" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-green-400">{ar ? 'متاح الآن' : 'Available Now'}</p>
          <p className="text-xs text-green-400/60 mt-0.5">
            {ar ? 'احجز فوراً أو تفضّل مباشرة' : 'Walk in or book instantly'}
          </p>
        </div>
        <Scissors size={16} className="text-green-400" />
      </div>
    );
  }

  if (live.status === 'finishing_soon') {
    return (
      <div className="flex items-center gap-3 bg-primary/10 border border-primary/25 rounded-2xl px-4 py-3 mb-1">
        <div className="relative flex-shrink-0">
          <div className="w-3 h-3 rounded-full bg-primary" />
          <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-75" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-primary">{ar ? 'ينتهي قريباً' : 'Finishing Soon'}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {ar
              ? `${live.liveActivity ? `${live.liveActivity} · ` : ''}حر خلال ~${live.liveEta || 5} دقيقة`
              : `${live.liveActivity ? `Currently: ${live.liveActivity} · ` : ''}Free in ~${live.liveEta || 5} min`}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-primary/15 rounded-xl px-2 py-1">
          <Clock size={11} className="text-primary" />
          <span className="text-xs font-bold text-primary">{live.liveEta || 5}{ar ? 'د' : 'm'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 bg-destructive/10 border border-destructive/25 rounded-2xl px-4 py-3 mb-1">
      <div className="w-3 h-3 rounded-full bg-destructive flex-shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-bold text-destructive">{ar ? 'مشغول' : 'Busy'}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {ar
            ? `${live.liveActivity ? `${live.liveActivity}` : 'قيد الخدمة'}${live.liveEta ? ` · ~${live.liveEta} دقيقة` : ''}`
            : `${live.liveActivity ? `Currently: ${live.liveActivity}` : 'In service'}${live.liveEta ? ` · ~${live.liveEta} min wait` : ''}`}
        </p>
      </div>
      <Activity size={16} className="text-destructive" />
    </div>
  );
}
