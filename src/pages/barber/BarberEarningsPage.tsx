import { ArrowLeft, TrendingUp, TrendingDown, BarChart3, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useMemo, useState, useEffect } from 'react';
import { useLiveBooking } from '@/contexts/LiveBookingContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { subscribePayouts, type PayoutDoc } from '@/lib/db';

const DAY_LABELS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LABELS_AR = ['أحد', 'اثن', 'ثلا', 'أرب', 'خام', 'جمع', 'سبت'];

export default function BarberEarningsPage() {
  const navigate = useNavigate();
  const { barberUser } = useAuth();
  const { getBarberBookings } = useLiveBooking();
  const { language } = useLanguage();
  const ar = language === 'ar';
  const completedBookings = getBarberBookings(barberUser?.uid || '').filter(b => b.status === 'completed');
  const [payouts, setPayouts] = useState<(PayoutDoc & { id: string })[]>([]);

  useEffect(() => {
    if (!barberUser?.uid) return;
    const unsub = subscribePayouts(barberUser.uid, setPayouts);
    return () => unsub();
  }, [barberUser?.uid]);

  const { weekData, weekTotal, todayEarned, todayCount, todayBookings } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const start = d.getTime();
      const end = start + 86400000;
      const dayBookings = completedBookings.filter(b => b.createdAt >= start && b.createdAt < end);
      days.push({
        day: ar ? DAY_LABELS_AR[d.getDay()] : DAY_LABELS_EN[d.getDay()],
        amount: dayBookings.reduce((s, b) => s + (b.totalPrice || 0), 0),
        clients: dayBookings.length,
        isToday: i === 0,
      });
    }
    const wt = days.reduce((s, d) => s + d.amount, 0);
    const todayStart = today.getTime();
    const todayEnd = todayStart + 86400000;
    const tBookings = completedBookings.filter(b => b.createdAt >= todayStart && b.createdAt < todayEnd);
    return {
      weekData: days,
      weekTotal: wt,
      todayEarned: tBookings.reduce((s, b) => s + (b.totalPrice || 0), 0),
      todayCount: tBookings.length,
      todayBookings: tBookings,
    };
  }, [completedBookings, ar]);

  const maxAmount = Math.max(1, ...weekData.map(d => d.amount));
  const totalAll = completedBookings.reduce((s, b) => s + (b.totalPrice || 0), 0);

  return (
    <div className="overflow-y-auto pb-10" dir={ar ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-3 px-5 pt-14 pb-5">
        <button onClick={() => navigate('/barber/profile')} className="w-10 h-10 bg-card border border-border rounded-full flex items-center justify-center">
          <ArrowLeft size={18} className={ar ? 'rotate-180' : ''} />
        </button>
        <div>
          <h1 className="text-xl font-black text-foreground">{ar ? 'الأرباح' : 'Earnings'}</h1>
          <p className="text-sm text-muted-foreground">{ar ? 'ملخص الإيرادات' : 'Revenue Overview'}</p>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="mx-5 mb-5 rounded-2xl p-5 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, hsl(38 92% 52%) 0%, hsl(28 90% 40%) 100%)' }}>
        <p className="text-primary-foreground/70 text-xs font-semibold uppercase tracking-wider">{ar ? 'هذا الأسبوع' : 'This Week'}</p>
        <p className="text-5xl font-black text-primary-foreground mt-1">{weekTotal} <span className="text-2xl">JOD</span></p>
        <div className="flex items-center gap-1 mt-2">
          <TrendingUp size={14} className="text-primary-foreground/80" />
          <p className="text-sm text-primary-foreground/80 font-medium">
            {completedBookings.length} {ar ? 'حجز مكتمل' : 'completed bookings'}
          </p>
        </div>
        <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10" />
      </motion.div>

      <div className="grid grid-cols-3 gap-2 px-5 mb-5">
        {[
          { label: ar ? 'اليوم' : 'Today', value: todayEarned, sub: `${todayCount} ${ar ? 'عميل' : 'clients'}`, trend: 'up' },
          { label: ar ? 'معدل يومي' : 'Avg/Day', value: Math.round(weekTotal / 7), sub: ar ? 'هذا الأسبوع' : 'This week', trend: 'up' },
          { label: ar ? 'الإجمالي' : 'Total', value: totalAll, sub: `${completedBookings.length} ${ar ? 'كل الوقت' : 'all-time'}`, trend: 'neutral' },
        ].map(({ label, value, sub, trend }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className="bg-card border border-border rounded-2xl p-3 text-center">
            <div className="flex items-center justify-center gap-1">
              <p className="text-sm font-black text-foreground">{value}<span className="text-[10px] text-muted-foreground ms-0.5">JOD</span></p>
              {trend === 'up' && <TrendingUp size={11} className="text-primary" />}
              {trend === 'down' && <TrendingDown size={11} className="text-destructive" />}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
            <p className="text-[10px] text-muted-foreground">{sub}</p>
          </motion.div>
        ))}
      </div>

      <div className="mx-5 mb-5 bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={16} className="text-primary" />
          <p className="text-sm font-bold text-foreground">{ar ? 'توزيع الأسبوع' : 'Weekly Breakdown'}</p>
        </div>
        <div className="flex items-end gap-2 h-28">
          {weekData.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <p className="text-[9px] text-primary font-bold">{d.amount > 0 ? d.amount : ''}</p>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${(d.amount / maxAmount) * 80}px` }}
                transition={{ delay: i * 0.05, duration: 0.5 }}
                className={`w-full rounded-t-xl ${d.isToday ? 'bg-primary' : 'bg-primary/30'}`}
              />
              <p className="text-[10px] text-muted-foreground font-medium">{d.day}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-5 mb-5 bg-card border border-border rounded-2xl p-4">
        <p className="text-sm font-bold text-foreground mb-3">{ar ? 'خدمات اليوم' : "Today's Services"}</p>
        {todayBookings.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">{ar ? 'لا توجد خدمات مكتملة اليوم بعد.' : 'No completed services today yet.'}</p>
        ) : (
          <div className="space-y-3">
            {todayBookings.map(item => (
              <div key={item.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-base">
                    {item.service?.icon || '✂️'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.service?.name || (ar ? 'خدمة' : 'Service')}</p>
                    <p className="text-xs text-muted-foreground">{item.customerName || (ar ? 'عميل' : 'Customer')} · {item.time || ''}</p>
                  </div>
                </div>
                <p className="font-bold text-primary">{item.totalPrice} JOD</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mx-5">
        <div className="flex items-center gap-2 mb-3">
          <Calendar size={15} className="text-primary" />
          <p className="text-sm font-bold text-foreground">{ar ? 'سجل المدفوعات' : 'Payout History'}</p>
        </div>
        {payouts.length === 0 ? (
          <div className="text-center py-8 bg-card border border-border rounded-2xl">
            <p className="text-2xl mb-2">💳</p>
            <p className="text-sm text-muted-foreground">{ar ? 'لا توجد مدفوعات بعد' : 'No payouts yet'}</p>
            <p className="text-xs text-muted-foreground mt-1">{ar ? 'ستظهر هنا عند المعالجة' : 'Payouts will appear here once processed'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {payouts.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 bg-card border border-border rounded-2xl p-3.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${p.status === 'paid' ? 'bg-primary/10' : 'bg-secondary'}`}>
                  <span className="text-base">💳</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {new Date(p.createdAt).toLocaleDateString(ar ? 'ar-JO' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                  <p className="text-xs text-muted-foreground">{p.method}</p>
                </div>
                <div className="text-right">
                  <p className="font-black text-foreground">{p.amount} JOD</p>
                  <p className={`text-[11px] font-bold ${p.status === 'paid' ? 'text-primary' : 'text-muted-foreground'}`}>
                    {p.status === 'paid' ? (ar ? '✓ مدفوع' : '✓ Paid') : (ar ? '⏳ معلق' : '⏳ Pending')}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
