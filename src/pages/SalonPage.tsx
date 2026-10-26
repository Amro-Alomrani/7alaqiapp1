import { useState } from 'react';
import { useSafeBack } from "@/hooks/useSafeBack";
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, MapPin, Sparkles, Clock, Image as ImageIcon, Users } from 'lucide-react';
import { useBarber, useBarbers } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import CrowdIndicator from '@/components/salon/CrowdIndicator';
import BarberPickerCard from '@/components/salon/BarberPickerCard';

type Filter = 'all' | 'available' | 'fastest';

export default function SalonPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const safeBack = useSafeBack();
  const barber = useBarber(id);
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';
  const [filter, setFilter] = useState<Filter>('all');

  if (!barber) return null;

  const salonBarbers = [barber];
  const filtered = salonBarbers
    .filter(b => filter === 'available' ? b.liveStatus === 'available' : true)
    .sort((a, b) => filter === 'fastest' ? a.avgDuration - b.avgDuration : 0);
  return (
    <div className="min-h-screen pb-28 overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>

      <div className="relative h-56">
        {barber.coverImage ? (
          <img src={barber.coverImage} alt={barber.shopName || barber.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center text-white text-5xl font-bold">{barber.name?.[0] || '?'}</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
        <button onClick={() => safeBack()} className="absolute top-12 left-5 w-10 h-10 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center">
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
              <span className="text-xs text-muted-foreground">{barber.address || (ar ? 'العنوان غير مضاف' : 'Address not provided')}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-primary/10 px-2.5 py-1.5 rounded-full">
            <Star size={13} className="text-primary fill-primary" />
            <span className="text-sm font-bold text-primary">{barber.reviewCount ? barber.rating.toFixed(1) : (ar ? 'لا توجد تقييمات' : 'No reviews')}</span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-3 flex items-center gap-3 mt-4">
          <Clock size={16} className="text-primary" />
          <div className="flex-1">
            <p className="text-xs font-bold text-foreground">
              {barber.workingHours?.open && barber.workingHours?.close
                ? `${barber.workingHours.open} - ${barber.workingHours.close}`
                : (ar ? 'ساعات العمل غير مضافة' : 'Hours not provided')}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {barber.workingHours?.days?.length ? barber.workingHours.days.join(', ') : (ar ? 'أيام العمل غير مضافة' : 'Working days not provided')}
            </p>
          </div>
          <div className="px-2 py-1 bg-green-500/10 rounded-lg">
            <span className="text-[10px] text-green-500 font-bold uppercase">{barber.liveStatus === 'available' ? (ar ? 'متاح' : 'Available') : barber.liveStatus === 'closed' ? (ar ? 'مغلق' : 'Closed') : barber.liveStatus === 'busy' || barber.liveStatus === 'finishing_soon' ? (ar ? 'مشغول' : 'Busy') : (ar ? 'الحالة غير محددة' : 'Status unavailable')}</span>
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
