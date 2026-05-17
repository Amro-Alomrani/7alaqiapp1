import { Star, Clock, Users, MapPin, Scissors } from 'lucide-react';
import { Barber } from '@/types';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';

function CoverFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, hsl(38 92% 30%) 0%, hsl(220 20% 12%) 100%)' }}>
      <Scissors size={24} className="text-primary/60" strokeWidth={1.4} />
    </div>
  );
}

interface Props {
  barber: Barber;
  variant?: 'compact' | 'full';
}

function CompactCard({ barber, onClick }: { barber: Barber; onClick: () => void }) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  return (
    <motion.div
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="flex-shrink-0 w-44 bg-card rounded-2xl overflow-hidden border border-border cursor-pointer"
    >
      <div className="relative h-28 overflow-hidden">
        {barber.coverImage && !barber.coverImage.startsWith('/') ? (
          <img src={barber.coverImage} alt={barber.shopName} className="w-full h-full object-cover"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <CoverFallback />
        )}
        {barber.featured && (
          <span className="absolute top-2 start-2 bg-primary text-primary-foreground text-[9px] px-1.5 py-0.5 rounded-full font-bold">
            {ar ? 'مميز' : 'Featured'}
          </span>
        )}
        {!barber.available && (
          <div className="absolute inset-0 bg-background/75 flex items-center justify-center">
            <span className="text-xs text-muted-foreground font-semibold tracking-wide">
              {ar ? 'مغلق' : 'CLOSED'}
            </span>
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="font-semibold text-foreground text-sm leading-tight truncate">{barber.shopName}</p>
        <p className="text-muted-foreground text-xs mt-0.5 truncate">{barber.name}</p>
        <div className="flex items-center gap-2 mt-2">
          <div className="flex items-center gap-0.5">
            <Star size={11} className="text-primary fill-primary" />
            <span className="text-xs font-bold text-foreground">{barber.rating}</span>
          </div>
          <span className="text-muted-foreground text-xs">·</span>
          <span className="text-muted-foreground text-xs">{barber.distance}</span>
        </div>
        {barber.queueCount > 0 ? (
          <div className="flex items-center gap-1 mt-1.5">
            <Users size={10} className="text-orange-400" />
            <span className="text-[11px] text-orange-400 font-medium">
              {ar ? `${barber.queueCount} أمامك` : `${barber.queueCount} ahead`}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1 mt-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <span className="text-[11px] text-green-400 font-medium">
              {ar ? 'متاح الآن' : 'Available now'}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function FullCard({ barber, onClick }: { barber: Barber; onClick: () => void }) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="flex bg-card rounded-2xl overflow-hidden border border-border cursor-pointer"
    >
      <div className="relative w-28 flex-shrink-0 overflow-hidden">
        {barber.coverImage && !barber.coverImage.startsWith('/') ? (
          <img src={barber.coverImage} alt={barber.shopName} className="w-full h-full object-cover"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <CoverFallback />
        )}
        {barber.featured && (
          <div className="absolute bottom-0 left-0 right-0 bg-primary/90 text-center py-0.5">
            <span className="text-[9px] font-bold text-primary-foreground">
              {ar ? 'الأعلى تقييماً' : 'TOP RATED'}
            </span>
          </div>
        )}
      </div>
      <div className="flex-1 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground text-sm leading-tight">{barber.shopName}</p>
            <p className="text-muted-foreground text-xs mt-0.5">{barber.name}</p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Star size={12} className="text-primary fill-primary" />
            <span className="text-sm font-bold text-foreground">{barber.rating}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <div className="flex items-center gap-1">
            <MapPin size={10} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{barber.distance}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock size={10} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{barber.eta}</span>
          </div>
          {barber.queueCount > 0 ? (
            <div className="flex items-center gap-1">
              <Users size={10} className="text-orange-400" />
              <span className="text-xs text-orange-400 font-medium">
                {ar ? `${barber.queueCount} في الطابور` : `${barber.queueCount} in queue`}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
              <span className="text-xs text-green-400 font-medium">
                {ar ? 'مفتوح' : 'Open'}
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-1 mt-2 flex-wrap">
          {(barber.specialties || []).slice(0, 2).map(s => (
            <span key={s} className="text-[10px] bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
              {s}
            </span>
          ))}
        </div>
        {barber.services?.[0]?.price != null && (
          <p className="text-xs text-primary font-semibold mt-2">
            {ar ? `ابتداءً من ${barber.services[0].price} د.أ` : `From ${barber.services[0].price} JOD`}
          </p>
        )}
      </div>
    </motion.div>
  );
}

export default function BarberCard({ barber, variant = 'full' }: Props) {
  const navigate = useNavigate();
  const onClick = () => navigate(`/barbers/${barber.id}`);
  return variant === 'compact'
    ? <CompactCard barber={barber} onClick={onClick} />
    : <FullCard barber={barber} onClick={onClick} />;
}
