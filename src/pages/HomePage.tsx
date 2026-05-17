import { Search, MapPin, ChevronRight, Sparkles, Clock, Star, Zap, Trophy, Bell, Map, Sun, Moon, Languages } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useBarbers, usePosts } from '@/contexts/DataContext';
import BarberCard from '@/components/BarberCard';
import { useTheme } from '@/contexts/ThemeContext';
import { useLiveBooking } from '@/contexts/LiveBookingContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { notifPrefs } from '@/lib/userPrefs';
import { getUser } from '@/lib/db';

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button onClick={toggleTheme}
      className="w-9 h-9 bg-card border border-border rounded-xl flex items-center justify-center text-muted-foreground shadow">
      {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}

function LanguageToggle() {
  const { language, toggleLanguage } = useLanguage();
  return (
    <button onClick={toggleLanguage}
      className="w-9 h-9 bg-card border border-border rounded-xl flex items-center justify-center text-foreground shadow gap-0.5">
      <Languages size={13} />
      <span className="text-[9px] font-bold">{language.toUpperCase()}</span>
    </button>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { activeBooking, allBookings } = useLiveBooking();
  const { t, language } = useLanguage();
  const { customer } = useAuth();
  const barbers = useBarbers();
  const feedPosts = usePosts();
  const ar = language === 'ar';
  const nearbyBarbers = barbers.filter(b => b.available || b.liveStatus === 'available').slice(0, 5);
  const topBarbers = [...barbers].filter(b => (b.rating || 0) > 0).sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 5);
  const availableNow = barbers.filter(b => b.available && b.liveStatus === 'available');

  const activeNotifs = allBookings.filter(b =>
    !['requested', 'cancelled', 'rejected'].includes(b.status)
  ).length;
  const unreadCount = Math.max(0, activeNotifs - notifPrefs.getRead().size);
  const firstName = customer?.name?.split(' ')[0] || (ar ? 'مرحباً' : 'Hi');

  const completedCount = allBookings.filter(b => b.status === 'completed').length;
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  useEffect(() => {
    if (!customer?.uid) return;
    getUser(customer.uid).then(u => {
      setLoyaltyPoints(u?.loyaltyPoints ?? completedCount * 30);
    }).catch(() => setLoyaltyPoints(completedCount * 30));
  }, [customer?.uid, completedCount]);
  const nextRewardAt = 500;
  const loyaltyProgress = Math.min((loyaltyPoints / nextRewardAt) * 100, 100);

  return (
    <div className="flex flex-col gap-4 pb-32 overflow-y-auto min-h-screen">
      <div className="px-5 pt-12 pb-1 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-medium">{t.home.welcomeBack}</p>
          <h1 className="text-xl font-black text-foreground">{firstName} 👋</h1>
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <button onClick={() => navigate('/notifications')}
            className="w-9 h-9 bg-card border border-border rounded-xl flex items-center justify-center relative">
            <Bell size={16} className="text-muted-foreground" />
            {unreadCount > 0 && (
              <div className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-1 bg-destructive rounded-full flex items-center justify-center">
                <span className="text-[8px] font-black text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>
              </div>
            )}
          </button>
          <ThemeToggle />
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="px-5"
        onClick={() => navigate('/explore')}>
        <div className="flex items-center gap-3 bg-card border border-border rounded-2xl px-4 py-3 cursor-pointer">
          <Search size={18} className="text-muted-foreground flex-shrink-0" />
          <span className="text-muted-foreground text-sm flex-1">{t.home.searchPlaceholder}</span>
          <MapPin size={16} className="text-primary" />
        </div>
      </motion.div>

      {activeBooking && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          onClick={() => navigate('/booking-status')}
          className="mx-5 rounded-2xl overflow-hidden border border-primary/30 cursor-pointer"
          style={{ background: 'linear-gradient(135deg, hsl(38 80% 15%) 0%, hsl(38 60% 10%) 100%)' }}>
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center flex-shrink-0">
              {activeBooking.status === 'in_progress' ? '✂️' :
               activeBooking.status === 'your_turn' ? '🔔' :
               activeBooking.status === 'preparing' ? '💈' :
               activeBooking.status === 'accepted' ? '✅' : '📤'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-primary">
                {activeBooking.status === 'requested' ? t.home.bookingRequested :
                 activeBooking.status === 'accepted' ? t.home.bookingAccepted :
                 activeBooking.status === 'preparing' ? t.home.gettingReady :
                 activeBooking.status === 'your_turn' ? t.home.yourTurn :
                 activeBooking.status === 'in_progress' ? t.home.inProgress : t.home.activeBooking}
              </p>
              <p className="text-xs text-primary/70 truncate">
                {activeBooking.barberName} - {activeBooking.service.name}
              </p>
            </div>
            <div className="flex items-center gap-1 bg-primary/20 px-2.5 py-1 rounded-xl flex-shrink-0">
              <span className="text-xs font-bold text-primary">{t.home.track}</span>
              <ChevronRight size={14} className="text-primary" />
            </div>
          </div>
        </motion.div>
      )}

      <div className="px-5">
        <div className="grid grid-cols-4 gap-2">
          {[
            { icon: '🗺️', label: t.home.quickActions.map, path: '/map', color: 'bg-blue-500/10' },
            { icon: '⚡', label: t.home.quickActions.quickBook, path: '/explore', color: 'bg-yellow-500/10' },
            { icon: '🚶', label: t.home.quickActions.walkIn, path: availableNow[0] ? `/barbers/${availableNow[0].id}` : '/explore', color: 'bg-green-500/10' },
            { icon: '🏠', label: t.home.quickActions.homeService, path: '/home-service', color: 'bg-purple-500/10' },
          ].map((action, i) => (
            <motion.button
              key={action.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => navigate(action.path)}
              className={`${action.color} rounded-2xl p-3 flex flex-col items-center gap-1.5 border border-border/50`}
            >
              <span className="text-2xl">{action.icon}</span>
              <span className="text-[10px] text-foreground font-semibold">{action.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between px-5 mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-black text-foreground">{ar ? 'حلاقون بالقرب منك' : 'Barbers Near You'}</h2>
            <span className="text-[10px] bg-green-500/15 text-green-400 px-2 py-0.5 rounded-full font-bold">{nearbyBarbers.length} {t.home.openCount}</span>
          </div>
          <button onClick={() => navigate('/map')} className="text-primary text-xs font-bold flex items-center gap-0.5">
            <Map size={12} /> {t.home.quickActions.map} <ChevronRight size={13} />
          </button>
        </div>
        <div className="flex gap-3 px-5 overflow-x-auto pb-1">
          {nearbyBarbers.map((b, i) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              onClick={() => navigate(`/barbers/${b.id}`)}
              className="flex-shrink-0 w-56 bg-card border border-border rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
            >
              <div className="relative h-28 overflow-hidden">
                {b.coverImage && !b.coverImage.startsWith('/') ? (
                  <img src={b.coverImage} alt={b.name} className="w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, hsl(38 92% 28%) 0%, hsl(220 25% 12%) 100%)' }}>
                    <span className="text-3xl font-black text-primary/70">{b.shopName?.[0] || b.name?.[0] || '✂'}</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${b.liveStatus === 'available' ? 'bg-green-500' : b.liveStatus === 'finishing_soon' ? 'bg-yellow-500' : 'bg-red-500'}`} />
                    <span className={`text-[11px] font-bold ${b.liveStatus === 'available' ? 'text-green-400' : b.liveStatus === 'finishing_soon' ? 'text-yellow-400' : 'text-red-400'}`}>
                      {b.liveStatus === 'available' ? (ar ? 'متاح' : 'Available') : b.liveStatus === 'finishing_soon' ? (ar ? 'ينتهي قريباً' : 'Finishing Soon') : (ar ? 'مشغول' : 'Busy')}
                    </span>
                  </div>
                </div>
              </div>
              <div className="p-3">
                <p className="font-bold text-foreground text-sm truncate">{b.shopName || b.name}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{b.address}</p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-0.5">
                    <Star size={11} className="text-primary fill-primary" />
                    <span className="text-xs font-bold text-foreground">{b.rating?.toFixed(1) || '—'}</span>
                  </div>
                  <span className="text-muted-foreground text-[10px]">{b.reviewCount || 0} {t.home.reviews}</span>
                  {b.liveEta != null && (
                    <div className="flex items-center gap-0.5 ml-auto">
                      <Clock size={10} className="text-muted-foreground" />
                      <span className="text-xs text-muted-foreground font-medium">~{b.liveEta}m</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground">{b.services?.length || 0} {ar ? 'خدمات' : 'services'}</span>
                  <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-bold">{t.home.book}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {availableNow.length > 0 && (
        <div>
          <div className="flex items-center justify-between px-5 mb-3">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-green-400" />
              <h2 className="text-base font-black text-foreground">{t.home.availableNow}</h2>
            </div>
          </div>
          <div className="flex gap-3 px-5 overflow-x-auto pb-1">
            {availableNow.map((b, i) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => navigate(`/book/${b.id}`)}
                className="flex-shrink-0 bg-card border border-green-500/20 rounded-2xl p-3 w-48 cursor-pointer active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="relative">
                    <img src={b.avatar} alt={b.name} className="w-10 h-10 rounded-xl object-cover" />
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-card" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-foreground text-xs truncate">{b.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{b.shopName}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Star size={10} className="text-primary fill-primary" />
                    <span className="text-xs font-bold">{b.rating}</span>
                  </div>
                  <span className="text-[10px] bg-green-500/15 text-green-400 px-2 py-0.5 rounded-full font-bold">
                    {t.home.bookNow}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between px-5 mb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-primary" />
            <h2 className="text-base font-black text-foreground">{t.home.topRated}</h2>
            <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-medium">{t.home.aiPick}</span>
          </div>
          <button onClick={() => navigate('/explore')} className="text-primary text-xs font-bold flex items-center gap-0.5">
            {t.home.all} <ChevronRight size={13} />
          </button>
        </div>
        <div className="flex gap-3 px-5 overflow-x-auto pb-1">
          {topBarbers.length > 0 ? topBarbers.map((b, i) => (
            <motion.div key={b.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}>
              <BarberCard barber={b} variant="compact" />
            </motion.div>
          )) : (
            <p className="text-sm text-muted-foreground px-1 py-2">{ar ? 'لا يوجد حلاقون بعد' : 'No barbers yet'}</p>
          )}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={() => navigate('/profile')}
        className="mx-5 rounded-2xl p-4 cursor-pointer relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, hsl(260 60% 20%) 0%, hsl(280 50% 15%) 100%)' }}
      >
        <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white/5" />
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Trophy size={16} className="text-yellow-400" />
            <span className="text-xs font-bold text-yellow-300 uppercase tracking-wider">{t.home.loyaltyPoints}</span>
          </div>
          <span className="text-xs text-purple-300 font-medium">{t.home.goldMember}</span>
        </div>
        <div className="flex items-end justify-between mb-2">
          <p className="text-2xl font-black text-white">{loyaltyPoints}</p>
          <p className="text-xs text-purple-300 mb-0.5">{Math.max(0, nextRewardAt - loyaltyPoints)} {t.home.pointsToNext}</p>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${loyaltyProgress}%` }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-yellow-500" />
        </div>
      </motion.div>

      {feedPosts.length > 0 && (
        <div>
          <div className="flex items-center justify-between px-5 mb-3">
            <h2 className="text-base font-black text-foreground">{t.home.trendingLooks}</h2>
            <button onClick={() => navigate('/feed')} className="text-primary text-xs font-bold flex items-center gap-0.5">
              {t.home.feedShort} <ChevronRight size={13} />
            </button>
          </div>
          <div className="flex gap-2.5 px-5 overflow-x-auto pb-1">
            {feedPosts.slice(0, 4).map((post, i) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                onClick={() => navigate('/feed')}
                className="flex-shrink-0 w-32 relative rounded-2xl overflow-hidden cursor-pointer"
                style={{ aspectRatio: '3/4' }}
              >
                <img src={post.image} alt={post.hairStyle} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute bottom-2 left-2 right-2">
                  <p className="text-white text-[10px] font-bold leading-tight">{post.hairStyle}</p>
                  <p className="text-white/60 text-[9px] mt-0.5">{(post.likes / 1000).toFixed(1)}k ❤️</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <div className="px-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-black text-foreground">{t.home.allBarbers}</h2>
          <button onClick={() => navigate('/explore')} className="text-primary text-sm font-medium">{t.home.seeAll}</button>
        </div>
        <div className="flex flex-col gap-3">
          {barbers.slice(0, 4).map((b, i) => (
            <motion.div key={b.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}>
              <BarberCard barber={b} variant="full" />
            </motion.div>
          ))}
        </div>
      </div>

      <button
        onClick={() => navigate('/chat')}
        aria-label="AI Barber Assistant"
        className="fixed bottom-24 right-5 z-40 w-14 h-14 rounded-2xl bg-gold-gradient shadow-gold flex items-center justify-center active:scale-95 transition-transform"
      >
        <Sparkles size={22} className="text-primary-foreground" />
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full animate-pulse ring-2 ring-background" />
      </button>
    </div>
  );
}
