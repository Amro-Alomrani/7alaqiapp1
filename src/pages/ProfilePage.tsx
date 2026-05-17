import { useNavigate } from 'react-router-dom';
import { MapPin, Phone, Gift, ChevronRight, LogOut, Heart, Bell, Settings, Calendar, Sparkles, Brain, Users, MessageSquare, Languages, Sun, Moon, QrCode, Copy, Check, Camera, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useLiveBooking } from '@/contexts/LiveBookingContext';
import { favPrefs, notifPrefs } from '@/lib/userPrefs';
import { toast } from 'sonner';
import { getUser, upsertUser } from '@/lib/db';
import { uploadImage } from '@/lib/storage';

type Tab = 'profile' | 'dna' | 'history';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { customer, logoutCustomer, updateCustomerAvatar } = useAuth();
  const { t, language, toggleLanguage, isRTL } = useLanguage();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { allBookings } = useLiveBooking();
  const ar = language === 'ar';
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  const [favCount, setFavCount] = useState(0);
  useEffect(() => {
    const update = () => setFavCount(favPrefs.getBarbers().size + favPrefs.getSalons().size);
    update();
    window.addEventListener('storage', update);
    return () => window.removeEventListener('storage', update);
  }, []);

  const totalBookings = allBookings.filter(b => b.status === 'completed').length;
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [realReferralCode, setRealReferralCode] = useState('');
  const [referralCount, setReferralCount] = useState(0);

  useEffect(() => {
    if (!customer?.uid) return;
    getUser(customer.uid).then(u => {
      if (u?.loyaltyPoints != null) setLoyaltyPoints(u.loyaltyPoints);
      else setLoyaltyPoints(totalBookings * 30);
      if (u?.referralCode) setRealReferralCode(u.referralCode);
      if (u?.referralCount) setReferralCount(u.referralCount);
    }).catch(() => setLoyaltyPoints(totalBookings * 30));
  }, [customer?.uid, totalBookings]);

  const activeNotifs = allBookings.filter(b =>
    !['requested', 'cancelled', 'rejected'].includes(b.status)
  ).length;
  const unreadNotifs = Math.max(0, activeNotifs - notifPrefs.getRead().size);

  const userName = customer?.name || (ar ? 'مستخدم' : 'User');
  const userPhone = customer?.phone || '';
  const userAvatar = customer?.avatar || `https://i.pravatar.cc/150?u=${encodeURIComponent(userPhone || 'guest')}`;

  const nextRewardAt = 500;
  const progress = Math.min((loyaltyPoints / nextRewardAt) * 100, 100);

  const REWARDS = [
    { points: 100, label: ar ? 'خصم 10%' : '10% discount', icon: '💸' },
    { points: 250, label: ar ? 'تشذيب لحية مجاني' : 'Free beard trim', icon: '🪒' },
    { points: 500, label: ar ? 'حلاقة مجانية' : 'Free haircut', icon: '✂️' },
    { points: 1000, label: ar ? 'عضوية VIP' : 'VIP membership', icon: '👑' },
  ];

  const referralCode = realReferralCode || (customer
    ? `${((customer.name || '').split(' ')[0] || 'USER').toUpperCase()}-2026`
    : 'GUEST-2026');
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(referralCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success(ar ? 'تم نسخ الرمز' : 'Code copied');
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !customer?.uid) return;
    if (file.size > 5 * 1024 * 1024) { toast.error(ar ? 'الصورة كبيرة جداً' : 'Image too large'); return; }
    setAvatarUploading(true);
    try {
      const url = await uploadImage(file, `users/${customer.uid}/avatar-${Date.now()}.jpg`);
      updateCustomerAvatar(url);
      await upsertUser(customer.uid, { avatar: url });
      toast.success(ar ? 'تم تحديث الصورة ✅' : 'Photo updated ✅');
    } catch {
      toast.error(ar ? 'فشل رفع الصورة' : 'Upload failed');
    } finally {
      setAvatarUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="min-h-screen pb-28 overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="px-5 pt-14 pb-5">
        <div className="flex items-center justify-end gap-2 mb-3">
          <button onClick={toggleLanguage} className="w-9 h-9 bg-card border border-border rounded-xl flex items-center justify-center gap-0.5 text-foreground">
            <Languages size={13} />
            <span className="text-[9px] font-bold">{language.toUpperCase()}</span>
          </button>
          <button onClick={toggleTheme} className="w-9 h-9 bg-card border border-border rounded-xl flex items-center justify-center text-muted-foreground">
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>

        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
          <div className="relative">
            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarUploading}
              className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-primary relative group"
            >
              <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                {avatarUploading ? <Loader2 size={18} className="text-white animate-spin" /> : <Camera size={18} className="text-white" />}
              </div>
            </button>
            <div className="absolute -bottom-1 -end-1 bg-primary w-6 h-6 rounded-full flex items-center justify-center pointer-events-none">
              <Camera size={11} className="text-primary-foreground" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black text-foreground truncate">{userName}</h1>
            {userPhone && (
              <div className="flex items-center gap-1.5 mt-0.5" dir="ltr">
                <Phone size={11} className="text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{userPhone}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-0.5">
              <MapPin size={11} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{ar ? 'عمّان، الأردن' : 'Amman, Jordan'}</span>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-3 gap-2 mt-4">
          {[
            { label: t.profile.bookings, value: totalBookings },
            { label: t.profile.points, value: loyaltyPoints },
            { label: ar ? 'مفضّل' : 'Favorites', value: favCount },
          ].map(({ label, value }) => (
            <div key={label} className="bg-card border border-border rounded-2xl p-3 text-center">
              <p className="text-lg font-black text-foreground">{value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 mb-5">
        <div className="flex gap-1 bg-secondary rounded-xl p-1">
          {([
            { id: 'profile', label: t.profile.tabLoyalty, icon: Gift },
            { id: 'dna', label: t.profile.tabDna, icon: Brain },
            { id: 'history', label: t.profile.tabHistory, icon: Calendar },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id as Tab)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5">
        {activeTab === 'profile' && (
          <div className="space-y-4">
            <div className="rounded-2xl p-5 relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, hsl(38 92% 52% / 1) 0%, hsl(28 90% 40% / 1) 100%)' }}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-primary-foreground/70 text-xs font-medium uppercase tracking-wider">{t.profile.loyaltyPoints}</p>
                  <p className="text-4xl font-black text-primary-foreground">{loyaltyPoints}</p>
                </div>
                <Gift size={36} className="text-primary-foreground/30" />
              </div>
              <div className="mb-1.5 flex justify-between">
                <span className="text-xs text-primary-foreground/70">{t.profile.nextRewardAt}</span>
                <span className="text-xs font-bold text-primary-foreground">{loyaltyPoints}/{nextRewardAt}</span>
              </div>
              <div className="h-2 bg-primary-foreground/20 rounded-full overflow-hidden">
                <div className="h-full bg-primary-foreground rounded-full" style={{ width: `${progress}%` }} />
              </div>
              <div className="absolute -end-6 -top-6 w-24 h-24 rounded-full bg-white/10" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {REWARDS.map(r => {
                const unlocked = loyaltyPoints >= r.points;
                return (
                  <div key={r.label}
                    className={`bg-card border rounded-2xl p-3 flex items-center gap-2.5 ${unlocked ? 'border-primary/30' : 'border-border opacity-60'}`}>
                    <span className="text-2xl">{r.icon}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{r.label}</p>
                      <p className={`text-[10px] mt-0.5 ${unlocked ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                        {unlocked ? t.profile.unlocked : `${r.points} ${ar ? 'نقطة' : 'pts'}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-card border border-border rounded-2xl p-5 mt-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🎁</span>
                <div>
                  <p className="font-bold text-foreground">{t.profile.inviteTitle}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.profile.inviteDesc}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-xl px-4 py-3">
                <span className="font-black text-primary tracking-wider flex-1" dir="ltr">{referralCode}</span>
                <button onClick={copy} className="text-xs font-bold text-primary bg-primary/20 px-3 py-1.5 rounded-lg">
                  {copied ? t.profile.copied : t.profile.copy}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4">
                {[
                  { v: referralCount, l: t.profile.friendsInvited },
                  { v: totalBookings, l: t.profile.bookingsMade },
                  { v: loyaltyPoints, l: t.profile.pointsEarned },
                ].map(({ v, l }) => (
                  <div key={l} className="bg-secondary rounded-xl p-2.5 text-center">
                    <p className="text-lg font-black text-foreground">{v}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{l}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'dna' && (
          <div className="bg-card border border-primary/20 rounded-2xl p-6 text-center mt-2">
            <Brain size={32} className="text-primary mx-auto mb-2" />
            <p className="font-bold text-foreground">{t.profile.styleIdentity}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {ar
                ? 'احجز قصّتك الأولى ليبني الذكاء هويتك الخاصة'
                : 'Book your first cut so the AI can build your style profile'}
            </p>
            <button onClick={() => navigate('/explore')}
              className="mt-4 bg-primary text-primary-foreground rounded-2xl px-5 py-2.5 text-sm font-bold">
              {ar ? 'اختر حلاق' : 'Find a barber'}
            </button>
          </div>
        )}

        {activeTab === 'history' && (
          <Button variant="outline" onClick={() => navigate('/history')} className="w-full h-12 rounded-2xl gap-2">
            <Calendar size={16} />
            {t.profile.viewHistory}
            <ChevronRight size={14} className={`ms-auto ${isRTL ? 'rotate-180' : ''}`} />
          </Button>
        )}
      </div>

      <div className="px-5 mt-5">
        <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
          {[
            { icon: MessageSquare, label: ar ? 'محادثات الحجوزات' : 'Booking Chats', badge: undefined, path: '/messages' },
            { icon: QrCode, label: ar ? 'مسح QR واكسب نقاط' : 'QR Check-In', badge: undefined, path: '/qr-scan' },
            { icon: Heart, label: t.profile.favoriteBarbers, badge: favCount > 0 ? String(favCount) : undefined, path: '/favorites' },
            { icon: Bell, label: t.profile.notifications, badge: unreadNotifs > 0 ? String(unreadNotifs) : undefined, path: '/notifications' },
            { icon: Users, label: t.profile.following, badge: undefined, path: '/feed' },
            { icon: Settings, label: t.profile.preferences, path: '/styles' },
          ].map(({ icon: Icon, label, badge, path }) => (
            <button key={label} onClick={() => path && navigate(path)} className="w-full flex items-center gap-3 px-4 py-3.5">
              <Icon size={17} className="text-muted-foreground" />
              <span className="flex-1 text-sm font-medium text-foreground text-start">{label}</span>
              {badge && <span className="bg-primary text-primary-foreground text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{badge}</span>}
              <ChevronRight size={15} className={`text-muted-foreground ${isRTL ? 'rotate-180' : ''}`} />
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 mt-5 mb-4">
        <Button variant="outline" onClick={() => { logoutCustomer(); navigate('/login'); }}
          className="w-full h-12 rounded-2xl text-destructive border-destructive/20 gap-2">
          <LogOut size={16} />{t.profile.signOut}
        </Button>
      </div>
    </div>
  );
}
