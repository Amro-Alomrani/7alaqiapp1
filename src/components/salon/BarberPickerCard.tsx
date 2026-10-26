import { Star, Timer, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import { Barber } from '@/types';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  barber: Barber;
}

export default function BarberPickerCard({ barber }: Props) {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const ar = language === 'ar';

  const statusLabel = {
    available:      ar ? 'متاح الآن'   : 'Available Now',
    finishing_soon: ar ? 'ينتهي قريباً' : 'Finishing Soon',
    busy:           ar ? 'مشغول'       : 'Busy',
    closed:         ar ? 'مغلق'         : 'Closed',
  }[barber.liveStatus] ?? '';

  const statusDot = { available: 'bg-foreground/40', finishing_soon: 'bg-primary', busy: 'bg-destructive', closed: 'bg-muted-foreground' }[barber.liveStatus] ?? 'bg-muted';
  const statusText = { available: 'text-foreground', finishing_soon: 'text-primary', busy: 'text-destructive', closed: 'text-muted-foreground' }[barber.liveStatus] ?? 'text-muted-foreground';
  const isPulse = barber.liveStatus === 'finishing_soon';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-2xl overflow-hidden"
    >
      <div className="flex items-center gap-3 p-3">
        <div className="relative flex-shrink-0">
          <div className="w-14 h-14 rounded-xl overflow-hidden">
            <img src={barber.avatar} alt={barber.name} className="w-full h-full object-cover" />
          </div>
          <div className="absolute -bottom-0.5 -end-0.5 flex items-center gap-0.5 bg-card rounded-full px-1.5 py-0.5 border border-border">
            <div className={`w-1.5 h-1.5 rounded-full ${statusDot} ${isPulse ? 'animate-pulse' : ''}`} />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-bold text-foreground text-sm truncate">{barber.name}</p>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <Star size={11} className="text-primary fill-primary" />
              <span className="text-xs font-bold text-foreground">{barber.rating}</span>
            </div>
          </div>
          <p className={`text-xs font-semibold mt-0.5 ${statusText}`}>
            {statusLabel}
            {barber.liveEta ? (ar ? ` · حر خلال ${barber.liveEta} د` : ` · free in ${barber.liveEta}m`) : ''}
          </p>
          <div className="flex items-center gap-3 mt-1.5">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Timer size={10} />
              <span className="text-[11px]">{barber.avgDuration}{ar ? 'د' : 'm'}</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Shield size={10} />
              <span className="text-[11px]">{barber.trustScore}</span>
            </div>
            <span className="text-[11px] text-muted-foreground">{barber.specialties?.[0] || ''}</span>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => navigate(`/book/${barber.id}`)}
          disabled={!barber.available}
          className={`flex-shrink-0 h-8 px-3 text-xs font-bold rounded-xl ${barber.available ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}
        >
          {barber.available ? (ar ? 'احجز' : 'Book') : (ar ? 'ممتلئ' : 'Full')}
        </Button>
      </div>
    </motion.div>
  );
}
