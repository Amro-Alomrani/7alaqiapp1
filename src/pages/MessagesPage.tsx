import { useEffect, useState } from 'react';
import { useSafeBack } from "@/hooks/useSafeBack";
import { ArrowLeft, MessageCircle, Camera, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLiveBooking } from '@/contexts/LiveBookingContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { subscribeBookingMessages } from '@/lib/db';
import type { MessageDoc } from '@/lib/db';

interface ConvMeta {
  bookingId: string;
  otherName: string;
  otherAvatar?: string;
  serviceName: string;
  date: string;
  time: string;
  status: string;
  lastMsg: string;
  lastTime: number;
  unread: number;
  hasImage: boolean;
}

const STATUS_LABEL: Record<string, { ar: string; en: string; color: string }> = {
  requested:  { ar: 'بانتظار الرد',   en: 'Pending',      color: 'text-amber-500 bg-amber-500/10' },
  accepted:   { ar: 'مقبول',          en: 'Accepted',     color: 'text-blue-400 bg-blue-500/10' },
  preparing:  { ar: 'يتجهز',          en: 'Preparing',    color: 'text-blue-400 bg-blue-500/10' },
  your_turn:  { ar: 'دورك',           en: 'Your Turn',    color: 'text-primary bg-primary/10' },
  in_progress:{ ar: 'جارٍ',           en: 'In Progress',  color: 'text-green-400 bg-green-500/10' },
  completed:  { ar: 'مكتمل',          en: 'Completed',    color: 'text-muted-foreground bg-muted' },
  cancelled:  { ar: 'ملغي',           en: 'Cancelled',    color: 'text-destructive bg-destructive/10' },
  rejected:   { ar: 'مرفوض',          en: 'Rejected',     color: 'text-destructive bg-destructive/10' },
};

function usageTime(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'الآن';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}د`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}س`;
  return new Date(ts).toLocaleDateString('ar');
}

export default function MessagesPage() {
  const navigate = useNavigate();
  const safeBack = useSafeBack();
  const { allBookings } = useLiveBooking();
  const { customer, barberUser } = useAuth();
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';

  const [convMeta, setConvMeta] = useState<ConvMeta[]>([]);

  const myUid = customer?.uid || barberUser?.uid || '';
  const isBarber = !!barberUser;

  const myBookings = allBookings.filter(b =>
    isBarber ? b.barberId === myUid : b.customerId === myUid
  ).sort((a, b) => b.createdAt - a.createdAt);

  useEffect(() => {
    if (myBookings.length === 0) { setConvMeta([]); return; }

    const unsubs: (() => void)[] = [];
    const metaMap = new Map<string, ConvMeta>();

    myBookings.forEach(booking => {
      const otherName = isBarber
        ? (booking.customerName || (ar ? 'عميل' : 'Customer'))
        : (booking.barberName || (ar ? 'الحلاق' : 'Barber'));
      const otherAvatar = isBarber ? booking.customerAvatar : booking.barberAvatar;

      metaMap.set(booking.id, {
        bookingId: booking.id,
        otherName,
        otherAvatar,
        serviceName: booking.service?.name || '',
        date: booking.date || '',
        time: booking.time || '',
        status: booking.status,
        lastMsg: ar ? 'اضغط لفتح المحادثة' : 'Tap to open chat',
        lastTime: booking.createdAt,
        unread: 0,
        hasImage: false,
      });

      const unsub = subscribeBookingMessages(booking.id, (msgs: (MessageDoc & { id: string })[]) => {
        const last = msgs[msgs.length - 1];
        const unread = msgs.filter(m => m.fromUid !== myUid && !m.read).length;

        metaMap.set(booking.id, {
          ...metaMap.get(booking.id)!,
          lastMsg: last
            ? (last.imageUrl
              ? (ar ? '📷 صورة' : '📷 Image')
              : last.text)
            : (ar ? 'اضغط لفتح المحادثة' : 'Tap to open chat'),
          lastTime: last ? last.createdAt : booking.createdAt,
          unread,
          hasImage: !!last?.imageUrl,
        });

        setConvMeta(
          Array.from(metaMap.values()).sort((a, b) => b.lastTime - a.lastTime)
        );
      });
      unsubs.push(unsub);
    });

    setConvMeta(Array.from(metaMap.values()));

    return () => unsubs.forEach(u => u());
  }, [myBookings.length, myUid, ar]);

  const chatPath = (bookingId: string) =>
    isBarber ? `/barber/chat/${bookingId}` : `/booking-chat/${bookingId}`;

  return (
    <div className="min-h-screen pb-28" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="px-5 pt-14 pb-4 sticky top-0 bg-background/95 backdrop-blur-sm z-10 border-b border-border">
        <div className="flex items-center gap-3">
          <button onClick={() => safeBack()}
            className="w-10 h-10 bg-card border border-border rounded-full flex items-center justify-center">
            <ArrowLeft size={18} className={isRTL ? 'rotate-180' : ''} />
          </button>
          <div>
            <h1 className="text-xl font-black text-foreground">{ar ? 'المحادثات' : 'Messages'}</h1>
            <p className="text-xs text-muted-foreground">
              {ar ? `${myBookings.length} حجز` : `${myBookings.length} booking${myBookings.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 pt-3 space-y-2">
        {convMeta.length === 0 ? (
          <div className="text-center py-20">
            <MessageCircle size={48} className="text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-bold text-foreground">{ar ? 'لا توجد محادثات بعد' : 'No conversations yet'}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {ar ? 'احجز موعداً لتبدأ المحادثة مع الحلاق' : 'Book an appointment to start chatting'}
            </p>
            {!isBarber && (
              <button onClick={() => navigate('/explore')}
                className="mt-4 bg-primary text-primary-foreground px-6 py-2.5 rounded-2xl font-bold text-sm">
                {ar ? 'اكتشف الحلاقين' : 'Explore Barbers'}
              </button>
            )}
          </div>
        ) : (
          convMeta.map(conv => {
            const sl = STATUS_LABEL[conv.status] || STATUS_LABEL.completed;
            return (
              <button
                key={conv.bookingId}
                onClick={() => navigate(chatPath(conv.bookingId))}
                style={{ touchAction: 'manipulation' }}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-card border border-border text-start"
              >
                <div className="relative flex-shrink-0">
                  {conv.otherAvatar ? (
                    <img src={conv.otherAvatar} alt={conv.otherName}
                      className="w-12 h-12 rounded-2xl object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center">
                      <span className="font-black text-primary text-base">
                        {conv.otherName?.[0]?.toUpperCase() || '?'}
                      </span>
                    </div>
                  )}
                  {conv.unread > 0 && (
                    <div className="absolute -top-1 -end-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                      <span className="text-[10px] font-black text-primary-foreground">{conv.unread}</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <p className={`text-sm font-bold text-foreground truncate ${conv.unread > 0 ? 'font-black' : ''}`}>
                      {conv.otherName}
                    </p>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0 flex items-center gap-0.5">
                      <Clock size={9} />
                      {usageTime(conv.lastTime)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {conv.serviceName} · {conv.date} {conv.time}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className={`text-xs truncate flex-1 ${conv.unread > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                      {conv.hasImage && <Camera size={10} className="inline me-1" />}
                      {conv.lastMsg}
                    </p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0 ${sl.color}`}>
                      {ar ? sl.ar : sl.en}
                    </span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
