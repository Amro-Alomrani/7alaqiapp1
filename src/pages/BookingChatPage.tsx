import { useState, useEffect, useRef } from 'react';
import { useSafeBack } from "@/hooks/useSafeBack";
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Send, Phone, MapPin, Bell, Camera, X, ImageIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLiveBooking } from '@/contexts/LiveBookingContext';
import { subscribeBookingMessages, sendBookingMessage, pushNotification, type MessageDoc } from '@/lib/db';
import { describeImageUploadError, uploadImage } from '@/lib/storage';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

export default function BookingChatPage() {
  const navigate = useNavigate();
  const safeBack = useSafeBack();
  const { bookingId } = useParams<{ bookingId: string }>();
  const { barberUser, customer } = useAuth();
  const { allBookings } = useLiveBooking();
  const { language } = useLanguage();
  const ar = language === 'ar';

  const [messages, setMessages] = useState<(MessageDoc & { id: string })[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const booking = allBookings.find(b => b.id === bookingId);
  const isBarber = !!barberUser;
  const myUid = barberUser?.uid || customer?.uid || '';
  const myName = barberUser?.name || customer?.name || (ar ? 'أنا' : 'Me');
  const myAvatar = barberUser?.avatar || customer?.avatar || '';
  const otherUid = isBarber ? (booking?.customerId || '') : (booking?.barberId || '');
  const otherName = isBarber
    ? (booking?.customerName || (ar ? 'العميل' : 'Customer'))
    : (booking?.barberName || (ar ? 'الحلاق' : 'Barber'));
  const otherAvatar = isBarber ? booking?.customerAvatar : booking?.barberAvatar;

  useEffect(() => {
    if (!bookingId) return;
    return subscribeBookingMessages(bookingId, setMessages);
  }, [bookingId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const pickImage = () => fileRef.current?.click();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error(ar ? 'الصورة كبيرة جداً (الحد 10MB)' : 'Image too large (max 10MB)');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    e.target.value = '';
  };

  const clearImage = () => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
  };

  const send = async () => {
    if ((!text.trim() && !imageFile) || !bookingId || !otherUid || !myUid) return;
    setSending(true);
    const msgText = text.trim();
    setText('');
    let uploadedUrl: string | undefined;

    try {
      if (imageFile) {
        setUploading(true);
        setUploadPct(0);
        const path = `chats/${bookingId}/${myUid}-${Date.now()}.jpg`;
        uploadedUrl = await uploadImage(imageFile, path, pct => setUploadPct(Math.round(pct)));
        setUploading(false);
        clearImage();
      }

      await sendBookingMessage(
        bookingId,
        { uid: myUid, name: myName, avatar: myAvatar },
        otherUid,
        otherName,
        msgText || (ar ? '📷 صورة' : '📷 Image'),
        uploadedUrl,
      );
    } catch (error) {
      toast.error(ar ? 'فشل إرسال الرسالة' : 'Failed to send message', {
        description: imageFile ? describeImageUploadError(error, ar) : undefined,
      });
      setText(msgText);
      setUploading(false);
    } finally {
      setSending(false);
    }
  };

  const sendAlert = async () => {
    if (!otherUid || !bookingId) return;
    await pushNotification(otherUid, {
      type: 'message',
      title: isBarber ? `💈 ${myName}` : `👤 ${myName}`,
      body: isBarber
        ? (ar ? 'الحلاق أرسل لك تنبيهاً' : 'Your barber sent you an alert')
        : (ar ? 'العميل أرسل لك تنبيهاً' : 'Your customer sent you an alert'),
      fromUid: myUid,
      fromName: myName,
      bookingId,
    });
    toast.success(ar ? '✅ تم إرسال التنبيه' : '✅ Alert sent');
  };

  return (
    <div className="flex flex-col min-h-screen bg-background" dir={ar ? 'rtl' : 'ltr'}>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button className="absolute top-14 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
            <X size={20} className="text-white" />
          </button>
          <img src={lightboxUrl} alt="" className="max-w-full max-h-full object-contain rounded-2xl" />
        </div>
      )}

      <div className="px-4 pt-14 pb-4 border-b border-border bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => safeBack()}
            className="w-10 h-10 bg-card border border-border rounded-full flex items-center justify-center flex-shrink-0"
          >
            <ArrowLeft size={18} className={ar ? 'rotate-180' : ''} />
          </button>
          {otherAvatar ? (
            <img src={otherAvatar} alt={otherName} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <span className="font-bold text-primary">{otherName?.[0]?.toUpperCase()}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-foreground text-sm truncate">{otherName}</p>
            <p className="text-xs text-muted-foreground truncate">
              {booking?.service?.name} · {booking?.date} {booking?.time}
            </p>
          </div>
          <button
            onClick={sendAlert}
            className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0"
          >
            <Bell size={16} className="text-primary" />
          </button>
          {isBarber && booking?.customerPhone && (
            <a
              href={`tel:${booking.customerPhone}`}
              className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center flex-shrink-0"
            >
              <Phone size={16} className="text-green-400" />
            </a>
          )}
          {isBarber && booking?.customerLocation && (
            <button
              onClick={() => navigate(`/barber/customer/${bookingId}`)}
              className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center flex-shrink-0"
            >
              <MapPin size={16} className="text-blue-400" />
            </button>
          )}
        </div>
      </div>

      {booking && (
        <div className="mx-4 mt-3 bg-card border border-border rounded-2xl px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 bg-primary/15 rounded-lg flex items-center justify-center text-base flex-shrink-0">
            {booking.service?.icon || '✂️'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-foreground truncate">{booking.service?.name}</p>
            <p className="text-[11px] text-muted-foreground">{booking.date} {booking.time} · {booking.totalPrice} JOD</p>
          </div>
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
            booking.status === 'in_progress' ? 'bg-green-500/15 text-green-400' :
            booking.status === 'completed' ? 'bg-muted text-muted-foreground' :
            'bg-primary/15 text-primary'
          }`}>
            {ar
              ? ({ requested: 'بانتظار الرد', accepted: 'مقبول', preparing: 'يتجهز', your_turn: 'دورك', in_progress: 'جارٍ', completed: 'مكتمل', cancelled: 'ملغي', rejected: 'مرفوض' } as Record<string, string>)[booking.status] || booking.status
              : booking.status.replace(/_/g, ' ').toUpperCase()}
          </span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-36">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-2">💬</p>
            <p className="text-sm text-muted-foreground">
              {ar ? 'لا توجد رسائل بعد. ابدأ المحادثة!' : 'No messages yet. Start the conversation!'}
            </p>
          </div>
        )}
          {messages.map(msg => {
            const isMe = msg.fromUid === myUid;
            return (
              <div
                key={msg.id}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'} items-end gap-2`}
              >
                {!isMe && (
                  <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0 mb-0.5 overflow-hidden">
                    {msg.fromAvatar
                      ? <img src={msg.fromAvatar} alt="" className="w-full h-full object-cover" />
                      : msg.fromName?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <div className={`max-w-[78%] rounded-2xl overflow-hidden ${
                  isMe
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-card border border-border text-foreground rounded-bl-sm'
                }`}>
                  {msg.imageUrl && (
                    <button
                      onClick={() => setLightboxUrl(msg.imageUrl!)}
                      className="block w-full"
                    >
                      <img
                        src={msg.imageUrl}
                        alt=""
                        className="w-full max-h-60 object-cover"
                        loading="lazy"
                      />
                    </button>
                  )}
                  {msg.text && msg.text !== '📷 صورة' && msg.text !== '📷 Image' && (
                    <div className="px-4 py-2.5">
                      <p className="text-sm leading-relaxed">{msg.text}</p>
                    </div>
                  )}
                  <div className={`px-4 pb-2 ${msg.imageUrl && !msg.text ? 'pt-1' : ''}`}>
                    <p className={`text-[10px] ${isMe ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                      {new Date(msg.createdAt).toLocaleTimeString(ar ? 'ar' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        <div ref={endRef} />
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border">
        <div className="px-4 py-3 max-w-2xl mx-auto">
          {imagePreview && (
            <div className="overflow-hidden">
              <div className="relative inline-block mb-2">
                <img src={imagePreview} alt="" className="h-20 w-20 object-cover rounded-xl border border-border" />
                <button
                  onClick={clearImage}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive rounded-full flex items-center justify-center"
                >
                  <X size={11} className="text-white" />
                </button>
                {uploading && (
                  <div className="absolute inset-0 bg-black/50 rounded-xl flex flex-col items-center justify-center">
                    <p className="text-white text-xs font-bold">{uploadPct}%</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex items-end gap-2">
            <button
              onClick={pickImage}
              className="w-11 h-11 bg-card border border-border rounded-2xl flex items-center justify-center flex-shrink-0"
            >
              <Camera size={18} className="text-muted-foreground" />
            </button>

            <div className="flex-1 bg-card border border-border rounded-2xl px-4 py-3 flex items-end gap-2">
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
                placeholder={ar ? 'اكتب رسالة...' : 'Type a message...'}
                rows={1}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none max-h-24"
              />
            </div>

            <button
              onClick={() => void send()}
              disabled={(!text.trim() && !imageFile) || sending || uploading}
              className="w-11 h-11 bg-primary rounded-2xl flex items-center justify-center disabled:opacity-40 flex-shrink-0"
            >
              {uploading
                ? <ImageIcon size={16} className="text-primary-foreground animate-pulse" />
                : <Send size={16} className="text-primary-foreground" />
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

