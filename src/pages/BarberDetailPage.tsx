import { useParams, useNavigate } from 'react-router-dom';
import { useSafeBack } from "@/hooks/useSafeBack";
import { ArrowLeft, Star, MapPin, Clock, Heart, Share2, Zap, Shield, Timer, Lock, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useBarber } from '@/contexts/DataContext';
import { subscribeBarberReviews, subscribeStaff, ReviewDoc, type StaffDoc } from '@/lib/db';
import { Button } from '@/components/ui/button';
import ReviewCard from '@/components/ReviewCard';
import ServiceItem from '@/components/ServiceItem';
import LiveStatusBadge from '@/components/barber/LiveStatusBadge';
import { useBarberLiveStatus } from '@/hooks/useBarberLiveStatus';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { favPrefs } from '@/lib/userPrefs';
import { isFollowing as fsIsFollowing, followBarber, unfollowBarber } from '@/lib/db';
import { toast } from 'sonner';

export default function BarberDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const safeBack = useSafeBack();
  const { t, language } = useLanguage();
  const ar = language === 'ar';
  const barber = useBarber(id);
  const live = useBarberLiveStatus(barber);
  const { customer } = useAuth();
  const [favorited, setFavorited] = useState(() => barber ? favPrefs.getBarbers().has(barber.id) : false);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<'services' | 'reviews'>('services');
  const [reviews, setReviews] = useState<any[]>([]);
  const [avatarImgError, setAvatarImgError] = useState(false);
  const [selectedChair, setSelectedChair] = useState<number | null>(null);
  const [staffList, setStaffList] = useState<(StaffDoc & { id: string })[]>([]);

  useEffect(() => {
    if (!id) return;
    return subscribeBarberReviews(id, setReviews);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    return subscribeStaff(id, setStaffList);
  }, [id]);

  useEffect(() => {
    if (!id || !customer?.uid) return;
    let cancelled = false;
    fsIsFollowing(customer.uid, id).then(v => { if (!cancelled) setFollowing(v); }).catch(() => {});
    return () => { cancelled = true; };
  }, [id, customer?.uid]);

  const toggleFollow = async () => {
    if (!barber) return;
    if (!customer?.uid) {
      toast.error(ar ? 'سجّل دخولك أولاً للمتابعة' : 'Sign in to follow');
      navigate('/login');
      return;
    }
    setFollowBusy(true);
    try {
      if (following) {
        await unfollowBarber(customer.uid, barber.id);
        setFollowing(false);
        toast.success(ar ? 'تم إلغاء المتابعة' : 'Unfollowed');
      } else {
        await followBarber(customer.uid, { id: barber.id, name: barber.name, avatar: barber.avatar });
        setFollowing(true);
        toast.success(ar ? `تتابع ${barber.name} الآن — ستصلك إشعارات منشوراته 🔔` : `Following ${barber.name} — you'll get post alerts 🔔`);
      }
    } catch (e) {
      toast.error(ar ? 'فشل الإجراء' : 'Action failed');
    } finally {
      setFollowBusy(false);
    }
  };

  const toggleFav = () => {
    if (!barber) return;
    const isNow = favPrefs.toggleBarber(barber.id);
    setFavorited(isNow);
    toast.success(isNow
      ? (ar ? 'تمت الإضافة للمفضلة ❤️' : 'Added to favorites ❤️')
      : (ar ? 'تمت الإزالة من المفضلة' : 'Removed from favorites'));
  };

  if (!barber) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3">
      <p className="text-4xl">💈</p>
      <p className="text-foreground font-semibold">{t.barberDetail.notFound}</p>
      <Button variant="outline" onClick={() => navigate('/explore')}>{t.barberDetail.goBack}</Button>
    </div>
  );

  const trustColor = barber.trustScore >= 95 ? 'text-green-400' : barber.trustScore >= 85 ? 'text-primary' : 'text-orange-400';

  return (
    <div className="min-h-screen pb-28 overflow-y-auto">
      <div className="relative h-64">
        {barber.coverImage && !barber.coverImage.startsWith('/') ? (
          <img src={barber.coverImage} alt={barber.shopName} className="w-full h-full object-cover"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <div className="w-full h-full" style={{
            background: 'linear-gradient(135deg, hsl(38 92% 30%) 0%, hsl(28 80% 15%) 50%, hsl(220 20% 8%) 100%)'
          }}>
            <div className="absolute inset-0 flex items-center justify-center opacity-10">
              <div className="text-[120px]">💈</div>
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
        <div className="absolute top-12 left-0 right-0 flex items-center justify-between px-5">
          <button onClick={() => safeBack()} className="w-10 h-10 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center">
            <ArrowLeft size={20} className="text-white" />
          </button>
          <div className="flex gap-2">
            <button onClick={toggleFav} className="w-10 h-10 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center">
              <Heart size={18} className={favorited ? 'text-red-500 fill-red-500' : 'text-white'} />
            </button>
            <button className="w-10 h-10 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center">
              <Share2 size={18} className="text-white" />
            </button>
          </div>
        </div>
        <div className="absolute -bottom-8 left-5 flex items-end gap-3">
          <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-primary shadow-xl bg-primary/20 flex items-center justify-center">
            {barber.avatar && !barber.avatar.startsWith('/') && !avatarImgError ? (
              <img src={barber.avatar} alt={barber.name} className="w-full h-full object-cover"
                onError={() => setAvatarImgError(true)}
              />
            ) : (
              <span className="text-2xl font-black text-primary">{(barber.name?.[0] || '✂').toUpperCase()}</span>
            )}
          </div>
        </div>
      </div>

      <div className="px-5 mt-12">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">{barber.shopName}</h1>
            <p className="text-muted-foreground text-sm">{barber.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{(barber.followers || 0).toLocaleString()} {t.barberDetail.followers}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-primary/15 px-2.5 py-1.5 rounded-full">
              <Star size={13} className="text-primary fill-primary" />
              <span className="font-bold text-primary text-sm">{barber.rating}</span>
            </div>
            <button
              onClick={toggleFollow}
              disabled={followBusy}
              className={`text-xs font-bold px-3 py-1.5 rounded-full transition-all disabled:opacity-50 ${following ? 'bg-secondary text-muted-foreground' : 'bg-primary text-primary-foreground'}`}
            >
              {followBusy ? '…' : (following ? t.barberDetail.following : t.barberDetail.follow)}
            </button>
          </div>
        </div>

        <LiveStatusBadge barber={barber} />

        <div className="grid grid-cols-4 gap-2 mt-3 mb-4">
          <div className="bg-card border border-border rounded-xl px-2 py-2.5 text-center">
            <MapPin size={13} className="text-primary mx-auto mb-1" />
            <p className="text-xs text-foreground font-semibold">{barber.distance || '—'}</p>
          </div>
          <div className="bg-card border border-border rounded-xl px-2 py-2.5 text-center">
            <Clock size={13} className="text-primary mx-auto mb-1" />
            <p className="text-xs text-foreground font-semibold">{barber.eta || '—'}</p>
          </div>
          <div className="bg-card border border-border rounded-xl px-2 py-2.5 text-center">
            <Timer size={13} className="text-primary mx-auto mb-1" />
            <p className="text-xs text-foreground font-semibold">{barber.avgDuration ? `${barber.avgDuration}m` : '—'}</p>
          </div>
          <div className="bg-card border border-border rounded-xl px-2 py-2.5 text-center">
            <Shield size={13} className={`${trustColor} mx-auto mb-1`} />
            <p className={`text-xs font-bold ${trustColor}`}>{barber.trustScore || '—'}</p>
          </div>
        </div>

        {!!barber.totalChairs && barber.totalChairs > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="font-black text-foreground">{ar ? 'فريق الحلاقين' : 'Barber Team'}</p>
              <span className="text-xs font-bold text-muted-foreground bg-secondary px-2.5 py-1 rounded-full">
                {barber.totalChairs - (barber.occupiedChairs || 0)}/{barber.totalChairs} {ar ? 'متاح' : 'free'}
              </span>
            </div>

            <div className="flex gap-3 flex-wrap">
              {Array.from({ length: barber.totalChairs }).map((_, i) => {
                const occupied = i < (barber.occupiedChairs || 0);
                const staff = staffList[i];
                const displayName = staff?.name || (occupied ? (barber.shopName || barber.name) : null);
                const displayAvatar = staff?.avatar || (occupied ? barber.avatar : null);
                const isSelected = selectedChair === i;
                const ringColor = occupied ? '#ef4444' : '#10b981';

                return (
                  <button
                    key={i}
                    onClick={() => setSelectedChair(isSelected ? null : i)}
                    className="flex-1 flex flex-col items-center gap-1.5 group min-w-[64px]"
                  >
                    <div
                      className="relative transition-transform duration-200"
                      style={{ transform: isSelected ? 'scale(1.1)' : 'scale(1)' }}
                    >
                      <div
                        className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0"
                        style={{
                          border: `3px solid ${isSelected ? 'hsl(38 92% 52%)' : ringColor}`,
                          boxShadow: isSelected ? `0 0 0 3px hsl(38 92% 52% / 0.3)` : `0 0 0 2px ${ringColor}33`,
                        }}
                      >
                        {displayAvatar ? (
                          <img src={displayAvatar} alt={displayName || ''} className="w-full h-full object-cover" />
                        ) : (
                          <div
                            className="w-full h-full flex items-center justify-center text-xl font-black"
                            style={{ background: occupied ? '#ef444420' : '#10b98120', color: occupied ? '#ef4444' : '#10b981' }}
                          >
                            {displayName?.[0]?.toUpperCase() || (occupied ? '✂' : '+')}
                          </div>
                        )}
                      </div>
                      <div
                        className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full border-2 border-background"
                        style={{ background: ringColor }}
                      />
                    </div>

                    <p className="text-[11px] font-bold text-foreground text-center leading-tight max-w-[72px] truncate">
                      {displayName || (ar ? `كرسي ${i + 1}` : `Chair ${i + 1}`)}
                    </p>
                    <p className="text-[10px] font-bold" style={{ color: ringColor }}>
                      {occupied ? (ar ? 'مشغول' : 'Busy') : (ar ? 'متاح' : 'Free')}
                    </p>
                  </button>
                );
              })}
            </div>

            <AnimatePresence>
              {selectedChair !== null && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className="overflow-hidden"
                >
                  {(() => {
                    const occupied = selectedChair < (barber.occupiedChairs || 0);
                    const staff = barber.staff?.[selectedChair];

                    return (
                      <div className="bg-card border border-border rounded-2xl p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="relative w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 bg-secondary">
                            {staff?.avatar ? (
                              <img src={staff.avatar} alt={staff.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-2xl">
                                {occupied ? '✂️' : '🪑'}
                              </div>
                            )}
                            <div
                              className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full border-2 border-card"
                              style={{ background: occupied ? '#ef4444' : '#10b981' }}
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="font-black text-foreground">
                              {staff?.name || (occupied ? (ar ? `كرسي ${selectedChair + 1}` : `Chair ${selectedChair + 1}`) : (ar ? `كرسي ${selectedChair + 1} — متاح` : `Chair ${selectedChair + 1} — Free`))}
                            </p>
                            {staff && (
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <Star size={11} className="fill-primary text-primary" />
                                <span className="text-xs font-bold text-primary">{(staff.rating || 0).toFixed(1)}</span>
                              </div>
                            )}
                            <p className="text-xs font-bold mt-0.5" style={{ color: occupied ? '#ef4444' : '#10b981' }}>
                              ● {occupied ? (ar ? 'مشغول الآن' : 'Busy now') : (ar ? 'متاح الآن' : 'Available now')}
                            </p>
                          </div>

                          <button
                            onClick={() => setSelectedChair(null)}
                            className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0"
                          >
                            <X size={14} className="text-muted-foreground" />
                          </button>
                        </div>

                        {staff?.specialties && staff.specialties.length > 0 && (
                          <div className="flex gap-1.5 flex-wrap mb-3">
                            {staff.specialties.map(s => (
                              <span key={s} className="text-[11px] bg-primary/10 text-primary px-2.5 py-1 rounded-full font-semibold">{s}</span>
                            ))}
                          </div>
                        )}

                        {!staff && !occupied && (barber.services || []).length > 0 && (
                          <div className="space-y-1.5 mb-3">
                            {(barber.services || []).slice(0, 3).map(s => (
                              <div key={s.id} className="flex items-center justify-between py-1">
                                <span className="text-sm text-foreground">{s.icon} {s.name}</span>
                                <span className="text-sm font-bold text-primary">{s.price} JOD</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <button
                          onClick={() => navigate(staff ? `/book/${barber.id}?staff=${staff.id}` : `/book/${barber.id}`)}
                          className="w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95"
                          style={{
                            background: occupied ? 'hsl(var(--secondary))' : 'hsl(38 92% 52%)',
                            color: occupied ? 'hsl(var(--muted-foreground))' : '#fff',
                          }}
                        >
                          {occupied
                            ? (ar ? 'احجز لاحقاً' : 'Book for Later')
                            : (ar ? '⚡ احجز الآن' : '⚡ Book Now')}
                        </button>
                      </div>
                    );
                  })()}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <div className="bg-card border border-border rounded-2xl p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Shield size={14} className={trustColor} />
              <span className="text-sm font-bold text-foreground">{t.barberDetail.trustScore}</span>
            </div>
            <span className={`text-sm font-black ${trustColor}`}>{barber.trustScore}/100</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${barber.trustScore}%` }}
              transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
              className={`h-full rounded-full ${barber.trustScore >= 95 ? 'bg-green-400' : barber.trustScore >= 85 ? 'bg-primary' : 'bg-orange-400'}`}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            {t.barberDetail.trustScoreSubtitle} · {barber.reviewCount} {t.home.reviews}
          </p>
        </div>

        <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{barber.description}</p>
        <div className="flex gap-2 flex-wrap mb-5">
          {(barber.specialties || []).map(s => (
            <span key={s} className="text-xs bg-secondary text-secondary-foreground px-3 py-1 rounded-full">{s}</span>
          ))}
        </div>

        <div className="flex gap-1 bg-secondary rounded-xl p-1 mb-4">
          {(['services', 'reviews'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === tab ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
              {tab === 'services' ? t.barberDetail.services : t.barberDetail.reviews}
            </button>
          ))}
        </div>

        {activeTab === 'services' && (
          <div className="flex flex-col gap-2">
            {(barber.services || []).map(s => (
              <ServiceItem
                key={s.id}
                service={s}
                onView={() => {
                  import('@/lib/db').then(({ updateBarberProfile }) => {
                    const updated = (barber.services || []).map(sv =>
                      sv.id === s.id
                        ? { ...sv, viewCount: ((sv as any).viewCount || 0) + 1 }
                        : sv
                    );
                    updateBarberProfile(barber.id, { services: updated } as any).catch(() => {});
                  }).catch(() => {});
                }}
              />
            ))}
          </div>
        )}
        {activeTab === 'reviews' && (
          <div className="flex flex-col gap-3">
            {reviews.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">{ar ? 'لا توجد تقييمات بعد' : 'No reviews yet'}</p>
            ) : (
              reviews.map(r => (
                <div key={r.id} className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-start gap-3 mb-2">
                    <div className="flex-1">
                      <p className="font-bold text-foreground">{r.userName || 'Customer'}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} size={12} className={i < r.rating ? 'fill-primary text-primary' : 'text-muted-foreground'} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{r.comment}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="fixed bottom-4 left-0 right-0 flex justify-center px-5 z-40">
        <div className="w-full max-w-sm">
          {live.status === 'closed' ? (
            <Button disabled className="w-full h-14 text-base font-bold rounded-2xl opacity-60 gap-2 bg-destructive/20 text-destructive">
              <Lock size={18} />
              {ar ? 'المحل مغلق' : 'Shop is Closed'}
            </Button>
          ) : live.status === 'busy' ? (
            <Button onClick={() => navigate(`/book/${barber.id}`)}
              className="w-full h-14 text-base font-bold rounded-2xl bg-orange-500 text-white shadow-xl gap-2">
              <Clock size={18} />
              {ar ? `احجز الآن · ~${live.liveEta || 20} دقيقة` : `Book Anyway · ~${live.liveEta || 20}m wait`}
            </Button>
          ) : barber.available ? (
            <Button onClick={() => navigate(`/book/${barber.id}`)}
              className="w-full h-14 text-base font-bold rounded-2xl bg-primary text-primary-foreground shadow-xl gap-2">
              <Zap size={18} />
              {t.barberDetail.bookNow} · {t.barberDetail.from} {barber.services[0]?.price} JOD
            </Button>
          ) : (
            <Button disabled className="w-full h-14 text-base font-bold rounded-2xl opacity-50">{t.barberDetail.closed}</Button>
          )}
        </div>
      </div>
    </div>
  );
}
