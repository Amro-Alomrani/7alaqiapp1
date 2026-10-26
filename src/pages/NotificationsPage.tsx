import { useEffect, useState } from 'react';
import { useSafeBack } from "@/hooks/useSafeBack";
import { ArrowLeft, BellOff, Calendar, Heart, Bell, Check, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  subscribeNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationDoc,
} from '@/lib/db';

function timeAgo(ts: number, ar: boolean): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return ar ? 'الآن' : 'just now';
  if (m < 60) return ar ? `قبل ${m} د` : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return ar ? `قبل ${h} س` : `${h}h ago`;
  const d = Math.floor(h / 24);
  return ar ? `قبل ${d} ي` : `${d}d ago`;
}

function iconFor(type: NotificationDoc['type']) {
  switch (type) {
    case 'booking_request':
    case 'booking_update':
      return <Calendar size={18} className="text-primary" />;
    case 'new_post':
      return <Heart size={18} className="text-pink-500" />;
    case 'follow':
      return <Heart size={18} className="text-primary" />;
    default:
      return <Bell size={18} className="text-primary" />;
  }
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const safeBack = useSafeBack();
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';
  const { customer, barberUser } = useAuth();
  const uid = customer?.uid || barberUser?.uid;
  const [items, setItems] = useState<(NotificationDoc & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }
    const unsub = subscribeNotifications(uid, list => {
      setItems(list);
      setLoading(false);
    });
    return () => unsub();
  }, [uid]);

  const unread = items.filter(i => !i.read).length;

  const onTap = async (n: NotificationDoc & { id: string }) => {
    if (!uid) return;
    if (!n.read) await markNotificationRead(n.id).catch(() => {});
    // The router exposes /booking-status without an ID parameter; the page
    // resolves the active booking from the signed-in user's live bookings.
    if (n.bookingId) navigate('/booking-status');
    else if (n.postId) navigate('/feed');
  };

  return (
    <div className="min-h-screen bg-background pb-24" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <button onClick={() => safeBack()} className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center">
              <ArrowLeft size={18} className={`text-foreground ${isRTL ? 'rotate-180' : ''}`} />
            </button>
            <div>
              <h1 className="text-lg font-bold text-foreground">{ar ? 'الإشعارات' : 'Notifications'}</h1>
              <p className="text-[11px] text-muted-foreground">
                {unread > 0 ? (ar ? `${unread} غير مقروء` : `${unread} unread`) : (ar ? 'كل شيء محدّث' : 'All caught up')}
              </p>
            </div>
          </div>
          {unread > 0 && uid && (
            <button
              onClick={() => markAllNotificationsRead(uid)}
              className="flex items-center gap-1 text-xs font-bold text-primary"
            >
              <CheckCheck size={14} /> {ar ? 'تعليم الكل' : 'Mark all'}
            </button>
          )}
        </div>
      </div>

      {!uid ? (
        <Empty title={ar ? 'سجّل دخولك' : 'Sign in'} body={ar ? 'لتظهر إشعاراتك هنا' : 'to see your notifications'} cta={ar ? 'تسجيل الدخول' : 'Sign in'} onCta={() => navigate('/login')} />
      ) : loading ? (
        <div className="px-5 py-12 text-center text-sm text-muted-foreground">{ar ? 'جاري التحميل…' : 'Loading…'}</div>
      ) : items.length === 0 ? (
        <Empty title={ar ? 'لا توجد إشعارات' : 'No notifications yet'} body={ar ? 'ستصلك إشعارات الحجز ومنشورات الحلاقين هنا' : 'Bookings & barber posts will appear here'} />
      ) : (
        <div className="px-5 pt-3 space-y-2">
          <AnimatePresence initial={false}>
            {items.map(n => (
              <motion.button
                key={n.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onClick={() => onTap(n)}
                className={`w-full text-start flex gap-3 items-start p-3 rounded-2xl border transition-colors ${
                  n.read
                    ? 'bg-card border-border'
                    : 'bg-primary/5 border-primary/30'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center shrink-0 overflow-hidden">
                  {n.fromAvatar
                    ? <img src={n.fromAvatar} alt={n.fromName || ''} className="w-full h-full object-cover" />
                    : iconFor(n.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-foreground truncate">{n.title}</p>
                    {!n.read && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(n.createdAt, ar)}</p>
                </div>
                {n.read && <Check size={14} className="text-muted-foreground shrink-0 mt-1" />}
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function Empty({ title, body, cta, onCta }: { title: string; body: string; cta?: string; onCta?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 pt-20">
      <div className="w-16 h-16 rounded-full bg-card border border-border flex items-center justify-center mb-4">
        <BellOff size={26} className="text-muted-foreground" />
      </div>
      <h3 className="text-base font-bold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-xs">{body}</p>
      {cta && onCta && (
        <Button onClick={onCta} className="mt-5 rounded-2xl bg-primary text-primary-foreground font-bold px-6">
          {cta}
        </Button>
      )}
    </div>
  );
}
