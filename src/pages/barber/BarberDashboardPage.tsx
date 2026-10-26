import { useMemo, useCallback } from 'react';
import { TrendingUp, Sun, Moon, Zap, Calendar, Users, Check, X, MessageCircle, Bell, DollarSign, BarChart3, MapPin, Star, BellRing } from 'lucide-react';
import AppLogo from '@/components/AppLogo';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLiveBooking } from '@/contexts/LiveBookingContext';
import { useBarber } from '@/contexts/DataContext';
import BarberStatusControl from '@/components/barber/BarberStatusControl';
import { useState } from 'react';

export default function BarberDashboardPage() {
  const navigate = useNavigate();
  const { barberUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t, language } = useLanguage();
  const ar = language === 'ar';
  const { getBarberBookings, acceptBooking, rejectBooking, startBooking, completeBooking } = useLiveBooking();
  const [currentTab, setCurrentTab] = useState<'overview' | 'queue' | 'bookings'>('overview');
  const CURRENT_BARBER_ID = barberUser?.uid || 'b1';
  const myBarberDoc = useBarber(CURRENT_BARBER_ID);
  const staff = myBarberDoc?.staff ?? [];

  const myBookings = getBarberBookings(CURRENT_BARBER_ID);
  const pendingCount = myBookings.filter(b => b.status === 'requested').length;

  const earned = useMemo(() =>
    myBookings.filter(b => b.status === 'completed').reduce((s, b) => s + b.totalPrice, 0),
    [myBookings]
  );

  const weekData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const sums: Record<string, number> = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
    myBookings.forEach(b => {
      if (b.status === 'completed' && b.completedAt) {
        const dayName = days[new Date(b.completedAt).getDay()];
        sums[dayName] += b.totalPrice || 0;
      }
    });
    return [
      { day: 'Mon', amount: sums['Mon'] },
      { day: 'Tue', amount: sums['Tue'] },
      { day: 'Wed', amount: sums['Wed'] },
      { day: 'Thu', amount: sums['Thu'] },
      { day: 'Fri', amount: sums['Fri'] },
      { day: 'Sat', amount: sums['Sat'] },
      { day: 'Sun', amount: sums['Sun'] },
    ];
  }, [myBookings]);

  const current = myBookings.find(b => b.status === 'in_progress') || null;
  const waiting = myBookings.filter(b => b.status === 'accepted' || b.status === 'preparing' || b.status === 'your_turn').map((b, i) => ({ ...b, position: i + 1, waitTime: i * 15 }));
  const maxWeeklyAmount = Math.max(0, ...weekData.map(day => day.amount));

  const handleNotify = useCallback(async (booking: typeof myBookings[0]) => {
    try {
      const { pushNotification } = await import('@/lib/db');
      const sent = await pushNotification(booking.customerId, {
        type: 'booking_update',
        title: '💈 ' + (ar ? 'رسالة من حلاقك' : 'Message from your barber'),
        body: ar
          ? `${barberUser?.shopName || 'الصالون'} يذكّرك بموعدك - ${booking.service?.name || ''}`
          : `${barberUser?.shopName || 'Barber'} is reminding you about your ${booking.service?.name || 'appointment'}`,
        fromUid: barberUser?.uid,
        fromName: barberUser?.name || barberUser?.shopName,
        bookingId: booking.id,
      });
      if (sent) toast.success(ar ? '🔔 تم إرسال الإشعار' : '🔔 Notification sent');
      else toast.error(ar ? 'تعذر إرسال الإشعار. تحقق من الاتصال.' : 'Could not send the notification. Check your connection.');
    } catch {
      toast.error(ar ? 'فشل الإرسال' : 'Failed to send');
    }
  }, [barberUser, ar]);

  const handleAccept = async (id: string) => {
    if (await acceptBooking(id)) toast.success(t.barberDash.acceptedToast);
    else toast.error(ar ? 'تعذر تحديث الحجز. تحقق من الاتصال وحاول مجدداً.' : 'Could not update the booking. Check your connection and try again.');
  };
  const handleReject = async (id: string) => {
    if (await rejectBooking(id)) toast.success(t.barberDash.rejectedToast);
    else toast.error(ar ? 'تعذر تحديث الحجز. تحقق من الاتصال وحاول مجدداً.' : 'Could not update the booking. Check your connection and try again.');
  };
  const handleStart = async (id: string) => {
    if (!await startBooking(id)) toast.error(ar ? 'تعذر تحديث الحجز. تحقق من الاتصال وحاول مجدداً.' : 'Could not update the booking. Check your connection and try again.');
  };
  const handleComplete = async (id: string) => {
    if (await completeBooking(id)) toast.success(t.barberDash.completedToast);
    else toast.error(ar ? 'تعذر تحديث الحجز. تحقق من الاتصال وحاول مجدداً.' : 'Could not update the booking. Check your connection and try again.');
  };

  return (
    <div className="min-h-screen pb-28 overflow-y-auto">
      <div className="px-5 pt-6 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AppLogo size={40} />
          <div>
            <p className="text-xs text-muted-foreground font-medium">
              {(() => { const h = new Date().getHours(); return h < 12 ? (ar ? 'صباح الخير' : 'Good morning') : h < 17 ? (ar ? 'مرحباً' : 'Good afternoon') : (ar ? 'مساء الخير' : 'Good evening'); })()}
            </p>
            <h1 className="text-xl font-black text-foreground">{barberUser?.name || (ar ? 'حلاق' : 'Barber')} 💈</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/barber/bookings')}
            className="relative w-9 h-9 bg-card border border-border rounded-xl flex items-center justify-center">
            <Bell size={16} className="text-muted-foreground" />
            {pendingCount > 0 && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full flex items-center justify-center">
                <span className="text-[9px] font-bold text-white">{pendingCount}</span>
              </div>
            )}
          </button>
          <button onClick={toggleTheme}
            className="w-9 h-9 bg-card border border-border rounded-xl flex items-center justify-center">
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 px-5 mb-5">
        {[
          { icon: DollarSign, label: ar ? 'إجمالي الأرباح' : 'Total Earned', value: `${earned} JOD`, color: 'text-green-400', bg: 'bg-green-500/10' },
          { icon: Users, label: ar ? 'حجوزات اليوم' : 'Today\'s Bookings', value: `${myBookings.filter(b => b.date === new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })).length}`, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { icon: Check, label: ar ? 'مكتملة' : 'Completed', value: `${myBookings.filter(b => b.status === 'completed').length}`, color: 'text-primary', bg: 'bg-primary/10' },
          { icon: Calendar, label: ar ? 'إجمالي الحجوزات' : 'Total Bookings', value: `${myBookings.filter(b => b.status !== 'cancelled').length}`, color: 'text-purple-400', bg: 'bg-purple-500/10' },
        ].map(stat => (
          <div key={stat.label} className="bg-card border border-border rounded-2xl p-3 text-center">
            <div className={`w-8 h-8 ${stat.bg} rounded-xl flex items-center justify-center mx-auto mb-2`}>
              <stat.icon size={16} className={stat.color} />
            </div>
            <p className="text-lg font-black text-foreground">{stat.value}</p>
            <p className="text-[10px] text-muted-foreground font-medium">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 px-5 mb-4">
        {([
          { key: 'overview', label: ar ? 'نظرة عامة' : 'Overview' },
          { key: 'queue', label: ar ? 'قائمة الانتظار' : 'Queue' },
          { key: 'bookings', label: ar ? 'الحجوزات' : 'Bookings' },
        ] as { key: typeof currentTab; label: string }[]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setCurrentTab(tab.key)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
              currentTab === tab.key ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {currentTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-5 space-y-4">
            <BarberStatusControl
              barberId={CURRENT_BARBER_ID}
              defaultStatus={myBarberDoc?.liveStatus || 'closed'}
            />

            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-foreground">{ar ? 'الكراسي المباشرة' : 'Live Chairs'}</p>
                <span className="text-xs text-muted-foreground bg-secondary px-2.5 py-1 rounded-full">
                  {(myBarberDoc?.totalChairs || 1) - (myBarberDoc?.occupiedChairs || 0)}/{myBarberDoc?.totalChairs || 1} {ar ? 'متاح' : 'free'}
                </span>
              </div>
              <div className="flex gap-3 flex-wrap">
                {Array.from({ length: myBarberDoc?.totalChairs || 1 }).map((_, i) => {
                  const occupied = i < (myBarberDoc?.occupiedChairs || 0);
                  const ringColor = occupied ? '#ef4444' : '#10b981';
                  return (
                    <div key={i} className="flex flex-col items-center gap-1.5 min-w-[60px]">
                      <div
                        className="w-14 h-14 rounded-full overflow-hidden"
                        style={{ border: `3px solid ${ringColor}`, boxShadow: `0 0 0 2px ${ringColor}33` }}
                      >
                        {occupied && barberUser?.avatar ? (
                          <img src={barberUser.avatar} alt={barberUser.name} className="w-full h-full object-cover" />
                        ) : (
                          <div
                            className="w-full h-full flex items-center justify-center text-lg font-black"
                            style={{ background: occupied ? '#ef444420' : '#10b98120', color: ringColor }}
                          >
                            {occupied ? (barberUser?.name?.[0]?.toUpperCase() || '✂') : '+'}
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] font-bold text-foreground text-center truncate max-w-[60px]">
                        {occupied ? (barberUser?.name || (ar ? 'الحلاق' : 'Barber')) : (ar ? `كرسي ${i + 1}` : `Chair ${i + 1}`)}
                      </p>
                      <p className="text-[9px] font-bold" style={{ color: ringColor }}>
                        {occupied ? (ar ? 'مشغول' : 'Busy') : (ar ? 'متاح' : 'Free')}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {current && (
              <div className="bg-card border border-primary/30 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-xs font-bold text-green-400 uppercase tracking-wider">{ar ? 'يُخدَم الآن' : 'Currently Serving'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <img src={current.customerAvatar || '/logo.png'} alt="" className="w-12 h-12 rounded-xl object-cover" />
                  <div className="flex-1">
                    <p className="font-bold text-foreground">{current.customerName || (ar ? 'عميل' : 'Customer')}</p>
                    <p className="text-xs text-muted-foreground">{current.service?.name}</p>
                  </div>
                  <button
                    onClick={() => handleComplete(current.id)}
                    className="bg-green-500 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1"
                  >
                    <Check size={14} /> {ar ? 'انتهى' : 'Done'}
                  </button>
                </div>
              </div>
            )}

            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 size={16} className="text-primary" />
                  <span className="text-sm font-bold text-foreground">{ar ? 'هذا الأسبوع' : 'This Week'}</span>
                </div>
                <span className="text-xs text-muted-foreground">{weekData.reduce((s, d) => s + d.amount, 0)} JOD {ar ? 'إجمالي' : 'total'}</span>
              </div>
              <div className="flex h-[120px] items-end gap-2" role="img" aria-label={ar ? 'الأرباح اليومية لهذا الأسبوع' : 'Daily earnings this week'}>
                {weekData.map(day => {
                  const height = maxWeeklyAmount > 0 ? (day.amount / maxWeeklyAmount) * 100 : 0;
                  return (
                    <div key={day.day} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
                      <div className="flex h-24 w-full items-end rounded-md bg-secondary/60">
                        <div
                          className="w-full rounded-t-md bg-primary transition-[height]"
                          style={{ height: `${height}%`, minHeight: day.amount > 0 ? 3 : 0 }}
                          title={`${day.day}: ${day.amount} JOD`}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{day.day}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-foreground">{ar ? 'جدول اليوم' : 'Today\'s Schedule'}</span>
                <span className="text-xs text-muted-foreground">{myBookings.length} {ar ? 'موعد' : 'appointments'}</span>
              </div>
              <div className="space-y-2">
                {myBookings.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">{ar ? 'لا توجد حجوزات بعد' : 'No bookings yet'}</p>}
                {myBookings.map(item => (
                  <div key={item.id} className="flex items-center gap-3 py-2">
                    <span className="text-xs text-muted-foreground w-16 flex-shrink-0">{item.time || '—'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.customerName || (ar ? 'عميل' : 'Customer')}</p>
                      <p className="text-xs text-muted-foreground">{item.service?.name || ''}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${
                      item.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                      item.status === 'in_progress' ? 'bg-primary/10 text-primary' :
                      'bg-blue-500/10 text-blue-400'
                    }`}>
                      {item.status === 'completed' ? (ar ? 'منتهي' : 'Done') :
                       item.status === 'in_progress' ? (ar ? 'الآن' : 'Now') : (ar ? 'قيد الانتظار' : 'Pending')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {staff.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Star size={16} className="text-yellow-500" />
                    <span className="text-sm font-bold text-foreground">{ar ? 'أداء فريق العمل' : 'Staff Performance'}</span>
                  </div>
                </div>
                <div className="space-y-4">
                  {staff.map(s => {
                    const staffBookings = myBookings.filter(b => b.status === 'completed' && b.staffId === s.id);
                    const revenue = staffBookings.reduce((sum, b) => sum + b.totalPrice, 0);
                    return (
                      <div key={s.id} className="flex items-center gap-3">
                        {s.avatar ? (
                          <img src={s.avatar} alt={s.name} className="w-10 h-10 rounded-xl object-cover" />
                        ) : (
                          <div aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-sm font-bold text-secondary-foreground">
                            {s.name?.trim().slice(0, 1) || '?'}
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-bold text-foreground">{s.name}</p>
                          <div className="h-1.5 w-full bg-secondary rounded-full mt-1 overflow-hidden">
                             <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, (staffBookings.length / 10) * 100)}%` }} />
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-foreground">{staffBookings.length} {ar ? 'حجز' : 'Jobs'}</p>
                          <p className="text-[10px] text-green-400 font-bold">{revenue} JOD</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => navigate('/barber/earnings')}
                className={`bg-card border border-border rounded-2xl p-4 ${ar ? 'text-right' : 'text-left'}`}>
                <TrendingUp size={20} className="text-green-400 mb-2" />
                <p className="text-sm font-bold text-foreground">{ar ? 'الأرباح' : 'Earnings'}</p>
                <p className="text-xs text-muted-foreground">{ar ? 'عرض التقرير التفصيلي' : 'View detailed report'}</p>
              </button>
              <button onClick={() => navigate('/barber/services')}
                className={`bg-card border border-border rounded-2xl p-4 ${ar ? 'text-right' : 'text-left'}`}>
                <Zap size={20} className="text-purple-400 mb-2" />
                <p className="text-sm font-bold text-foreground">{ar ? 'الخدمات' : 'Services'}</p>
                <p className="text-xs text-muted-foreground">{ar ? 'إدارة الأسعار' : 'Manage pricing'}</p>
              </button>
            </div>

            <div className="bg-card border border-primary/20 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap size={14} className="text-primary" />
                <span className="text-xs font-bold text-primary uppercase tracking-wider">{ar ? 'تحليلات ذكية' : 'AI Insights'}</span>
              </div>
              <div className="space-y-2">
                {myBookings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{ar ? 'ابدأ باستقبال الحجوزات لتظهر التحليلات هنا' : 'Start accepting bookings to see insights here'}</p>
                ) : (
                  <>
                    <p className="text-sm text-foreground">
                      <span className="text-primary font-bold">{ar ? 'الأرباح: ' : 'Revenue: '}</span>
                      {ar ? `${earned} JOD من ${myBookings.filter(b => b.status === 'completed').length} حجز مكتمل` : `${earned} JOD from ${myBookings.filter(b => b.status === 'completed').length} completed bookings`}
                    </p>
                    {pendingCount > 0 && (
                      <p className="text-sm text-foreground">
                        <span className="text-amber-400 font-bold">{ar ? 'تنبيه: ' : 'Alert: '}</span>
                        {ar ? `${pendingCount} حجز بانتظار ردك` : `${pendingCount} booking${pendingCount > 1 ? 's' : ''} awaiting your response`}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

          </motion.div>
        )}

        {currentTab === 'queue' && (
          <motion.div key="queue" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-5 space-y-3">
            {current && (
              <div className="bg-card border border-green-500/30 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-xs font-bold text-green-400 uppercase">{ar ? 'يُخدَم الآن' : 'In Service'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <img src={current.customerAvatar || '/logo.png'} alt="" className="w-12 h-12 rounded-xl object-cover" />
                  <div className="flex-1">
                    <p className="font-bold text-foreground">{current.customerName || (ar ? 'عميل' : 'Customer')}</p>
                    <p className="text-xs text-muted-foreground">{current.service?.name}</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="bg-blue-500/10 text-blue-400 p-2 rounded-xl">
                      <MessageCircle size={16} />
                    </button>
                    <button onClick={() => handleComplete(current.id)} className="bg-green-500 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1">
                      <Check size={14} /> {ar ? 'انتهى' : 'Finish'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {waiting.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-3xl mb-2">🎉</p>
                <p className="font-bold text-foreground">{ar ? 'قائمة الانتظار فارغة' : 'Queue is Empty'}</p>
                <p className="text-xs text-muted-foreground mt-1">{ar ? 'لا أحد ينتظر' : 'No one is waiting'}</p>
              </div>
            ) : (
              waiting.map((q) => (
                <div key={q.id} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center">
                    <span className="text-sm font-black text-primary">#{q.position}</span>
                  </div>
                  <img src={q.customerAvatar || '/logo.png'} alt="" className="w-10 h-10 rounded-xl object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground text-sm">{q.customerName || (ar ? 'عميل' : 'Customer')}</p>
                    <p className="text-xs text-muted-foreground">{q.service?.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{ar ? 'انتظار' : 'Wait'}</p>
                    <p className="text-sm font-bold text-foreground">{q.waitTime}{ar ? 'د' : 'm'}</p>
                  </div>
                  <button onClick={() => handleStart(q.id)} className="bg-primary text-primary-foreground text-xs font-bold px-3 py-2 rounded-xl">
                    {ar ? 'التالي' : 'Next'}
                  </button>
                </div>
              ))
            )}
          </motion.div>
        )}

        {currentTab === 'bookings' && (
          <motion.div key="bookings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-5 space-y-3">
            {myBookings.filter(b => b.status !== 'cancelled' && b.status !== 'rejected').length === 0 ? (
              <div className="text-center py-10">
                <p className="text-3xl mb-2">📋</p>
                <p className="font-bold text-foreground">{ar ? 'لا توجد حجوزات' : 'No Bookings'}</p>
                <button onClick={() => navigate('/barber/bookings')}
                  className="mt-3 text-xs text-primary font-bold">{ar ? 'عرض جميع الحجوزات ←' : 'View all bookings →'}</button>
              </div>
            ) : (
              myBookings.filter(b => b.status !== 'cancelled' && b.status !== 'rejected').map(booking => (
                <div key={booking.id} className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <img
                      src={booking.customerAvatar || '/logo.png'}
                      alt=""
                      className="w-10 h-10 rounded-xl object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground text-sm truncate">{booking.customerName || 'Customer'}</p>
                      <p className="text-xs text-muted-foreground">{booking.service.icon} {booking.service.name} · {booking.totalPrice} JOD</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <p className="text-xs font-bold text-foreground">{booking.date}</p>
                      <p className="text-xs text-muted-foreground">{booking.time}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${
                      booking.status === 'requested' ? 'bg-yellow-500/10 text-yellow-400' :
                      booking.status === 'accepted' || booking.status === 'preparing' || booking.status === 'your_turn' ? 'bg-green-500/10 text-green-400' :
                      booking.status === 'in_progress' ? 'bg-primary/10 text-primary' :
                      booking.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                      'bg-destructive/10 text-destructive'
                    }`}>
                      {ar
                        ? ({ requested: 'بانتظار الرد', accepted: 'مقبول', preparing: 'يتجهز', your_turn: 'دورك', in_progress: 'جارٍ', completed: 'مكتمل', cancelled: 'ملغي', rejected: 'مرفوض' }[booking.status] || booking.status)
                        : booking.status.replace('_', ' ').toUpperCase()}
                    </span>

                    <div className="flex gap-2">
                      {booking.status === 'requested' && (
                        <>
                          <button onClick={() => handleReject(booking.id)}
                            className="bg-destructive/10 text-destructive text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1">
                            <X size={12} /> {ar ? 'رفض' : 'Reject'}
                          </button>
                          <button onClick={() => handleAccept(booking.id)}
                            className="bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1">
                            <Check size={12} /> {ar ? 'قبول' : 'Accept'}
                          </button>
                        </>
                      )}
                      {(booking.status === 'accepted' || booking.status === 'preparing' || booking.status === 'your_turn') && (
                        <button onClick={() => handleStart(booking.id)}
                          className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1">
                          <Zap size={12} /> {ar ? 'ابدأ' : 'Start'}
                        </button>
                      )}
                      {booking.status === 'in_progress' && (
                        <button onClick={() => handleComplete(booking.id)}
                          className="bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1">
                          <Check size={12} /> {ar ? 'أكمل' : 'Complete'}
                        </button>
                      )}
                      {booking.customerLocation && (
                        <button onClick={() => navigate(`/barber/customer/${booking.id}`)}
                          className="bg-blue-500/10 text-blue-400 p-1.5 rounded-xl" title="View customer location">
                          <MapPin size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => handleNotify(booking)}
                        className="bg-primary/10 text-primary p-1.5 rounded-xl"
                        title={ar ? 'إرسال إشعار للزبون' : 'Notify customer'}
                      >
                        <BellRing size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
