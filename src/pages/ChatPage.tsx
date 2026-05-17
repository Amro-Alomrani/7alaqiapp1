import { useState, useRef, useEffect } from 'react';
import { Send, ChevronLeft, Trash2, ImagePlus, X, Calendar, Scissors, Wand2, Loader2, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  chatStream,
  analyzeImageStream,
  extractBookingAction,
  extractNotifyAction,
  cleanResponseText,
  generateImage,
  ASSISTANT_NAME,
  type GrokMessage,
  type BookingAction,
  type NotifyAction,
} from '@/lib/grok-ai';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLiveBooking } from '@/contexts/LiveBookingContext';
import { useAuth } from '@/contexts/AuthContext';
import { useBarbers } from '@/contexts/DataContext';
import { pushNotification } from '@/lib/db';

interface UIMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  imageUrl?: string;
  generatedImage?: string;
  booking?: BookingAction | null;
  notify?: NotifyAction | null;
}

const STORAGE_KEY = 'halaqi_chat_history';
const MAX_PERSISTED = 20;

function loadHistory(): UIMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveHistory(messages: UIMessage[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_PERSISTED))); } catch {}
}

export default function ChatPage() {
  const navigate = useNavigate();
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';
  const { activeBooking, bookingHistory } = useLiveBooking();
  const { customer } = useAuth();
  const allBarbers = useBarbers();

  const buildContext = (): string => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('ar-JO', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('ar-JO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const lines: string[] = [
      `التاريخ والوقت: ${dateStr} - ${timeStr}`,
      `المستخدم: ${customer?.name || 'زائر'} (${customer?.phone || 'بدون هاتف'})`,
    ];

    if (activeBooking) {
      const statusMap: Record<string, string> = {
        requested: 'طُلب الحجز - ينتظر موافقة الحلاق',
        accepted: 'الحلاق قبل الحجز',
        preparing: 'الحلاق عم يحضّر',
        your_turn: 'جاء دورك!',
        in_progress: 'عم تتحلق هلق',
        completed: 'انتهى',
        cancelled: 'ملغى',
        rejected: 'مرفوض',
      };
      lines.push(`\nالحجز النشط الحالي:`);
      lines.push(`  - الحلاق: ${activeBooking.barberName} (${activeBooking.barberShop})`);
      lines.push(`  - الخدمة: ${activeBooking.service.name} - ${activeBooking.service.price} JOD`);
      lines.push(`  - الوقت: ${activeBooking.date} - ${activeBooking.time}`);
      lines.push(`  - الحالة: ${statusMap[activeBooking.status] || activeBooking.status}`);
      lines.push(`  - barberId: ${activeBooking.barberId}`);
      if (activeBooking.estimatedWait > 0) lines.push(`  - وقت الانتظار المتوقع: ${activeBooking.estimatedWait} دقيقة`);
    } else {
      lines.push(`\nلا يوجد حجز نشط حالياً.`);
    }

    const recentBookings = bookingHistory.filter(b => ['completed', 'cancelled'].includes(b.status)).slice(0, 3);
    if (recentBookings.length) {
      lines.push(`\nآخر الحجوزات:`);
      recentBookings.forEach(b => lines.push(`  - ${b.barberName}: ${b.service.name} (${b.status})`));
    }

    const openBarbers = allBarbers.filter(b => b.liveStatus !== ('offline' as string) && b.services?.length);
    if (openBarbers.length) {
      lines.push(`\nالحلاقون المتاحون الآن (${openBarbers.length}):`);
      openBarbers.slice(0, 8).forEach(b => {
        const status = b.liveStatus === 'available' ? 'متاح ✅' : b.liveStatus === 'finishing_soon' ? 'ينتهي قريباً 🟡' : 'مشغول 🔴';
        lines.push(`  - ${b.name} | ${b.shopName} | تقييم: ${b.rating?.toFixed(1) || '—'} | ${status} | id: ${b.id}`);
      });
    }

    const closedBarbers = allBarbers.filter(b => (b.liveStatus as string) === 'offline');
    if (closedBarbers.length) {
      lines.push(`\nالحلاقون المغلقون حالياً: ${closedBarbers.map(b => b.name).join('، ')}`);
    }

    return lines.join('\n');
  };

  const welcome: UIMessage = {
    id: 'welcome',
    role: 'assistant',
    text: ar
      ? `أهلاً! أنا ${ASSISTANT_NAME} 👋\n\nأقدر أساعدك في:\n• 📅 حجز موعد مع أي حلاق\n• 📊 متابعة حالة حجزك الحالي\n• 🔔 إرسال رسالة للحلاق\n• ✂️ اقتراح قصات بناءً على وجهك\n• 🎨 توليد صور قصات بالذكاء الاصطناعي\n• 📸 تحليل صور القصات\n\nاكتب سؤالك أو أرسل صورة!`
      : `Hi! I'm ${ASSISTANT_NAME} 👋\n\nI can help you:\n• 📅 Book any barber\n• 📊 Track your booking status\n• 🔔 Send a message to your barber\n• ✂️ Get haircut suggestions\n• 🎨 Generate AI hairstyle images\n• 📸 Analyze haircut photos\n\nAsk me anything!`,
  };

  const [messages, setMessages] = useState<UIMessage[]>(() => {
    const saved = loadHistory();
    return saved.length > 0 ? saved : [welcome];
  });
  const [input, setInput] = useState('');
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    saveHistory(messages);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    });
  }, [messages]);

  const suggestions = ar
    ? ['شو حالة حجزي؟', 'مين متاح هلق؟', 'احجزلي قصة', 'ابعث رسالة للحلاق', 'اقترح قصة للوجه المربع']
    : ['What\'s my booking status?', 'Who\'s available now?', 'Book me a haircut', 'Message my barber'];

  const buildGrokHistory = (): GrokMessage[] =>
    messages.filter(m => m.id !== 'welcome').slice(-10).map(m => ({ role: m.role, content: m.text }));

  const streamReply = async (iter: AsyncGenerator<string>, assistantId: string) => {
    let acc = '';
    try {
      for await (const chunk of iter) {
        acc += chunk;
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, text: cleanResponseText(acc) } : m
        ));
      }
      const booking = extractBookingAction(acc);
      const notify = extractNotifyAction(acc);
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, text: cleanResponseText(acc), booking, notify } : m
      ));
    } catch (e) {
setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, text: ar ? 'تعذّر الاتصال. جرب لاحقاً.' : "Connection failed. Try again." }
          : m
      ));
    } finally {
      setStreaming(false);
    }
  };

  const send = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text && !pendingImage) return;
    if (streaming || generatingImage) return;

    const userMsg: UIMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: text || (ar ? '(صورة)' : '(image)'),
      imageUrl: pendingImage || undefined,
    };
    const assistantId = `a-${Date.now()}`;
    const imageForApi = pendingImage;
    const placeholderText = imageForApi
      ? (ar ? '🔍 جاري تحليل الصورة...' : '🔍 Analyzing image...')
      : '';

    setMessages(prev => [...prev, userMsg, { id: assistantId, role: 'assistant', text: placeholderText }]);
    setInput('');
    setPendingImage(null);
    setStreaming(true);

    if (imageForApi) {
      await streamReply(analyzeImageStream(imageForApi, text), assistantId);
    } else {
      const ctx = buildContext();
      await streamReply(chatStream([...buildGrokHistory(), { role: 'user', content: text }], ctx), assistantId);
    }
  };

  const handleGenerateImage = async () => {
    const prompt = input.trim();
    if (!prompt) { toast(ar ? 'اكتب وصف القصة أولاً' : 'Describe the hairstyle first'); return; }
    if (streaming || generatingImage) return;

    const userMsg: UIMessage = { id: `u-${Date.now()}`, role: 'user', text: (ar ? '🎨 توليد: ' : '🎨 Generate: ') + prompt };
    const assistantId = `a-${Date.now()}`;
    setMessages(prev => [...prev, userMsg, {
      id: assistantId, role: 'assistant',
      text: ar ? '🎨 جاري توليد الصورة بـ Imagen 4... (~20 ثانية)' : '🎨 Generating with Imagen 4... (~20s)',
    }]);
    setInput('');
    setGeneratingImage(true);

    try {
      const imageUrl = await generateImage(prompt);
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, text: ar ? 'إليك القصة التي طلبت 💈' : 'Here is the style you requested 💈', generatedImage: imageUrl }
          : m
      ));
    } catch (e: any) {
      const msg = e?.message?.includes('TIMEOUT')
        ? (ar ? '⚠️ انتهت المهلة، جرب مرة أخرى.' : '⚠️ Timed out, try again.')
        : (ar ? '⚠️ فشل التوليد. تأكد من رصيد Replicate.' : '⚠️ Generation failed. Check Replicate credit.');
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, text: msg } : m));
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleSendNotify = async (notify: NotifyAction) => {
    if (!customer?.uid) { toast.error(ar ? 'يجب تسجيل الدخول أولاً' : 'Please log in first'); return; }
    try {
      await pushNotification(notify.barberId, {
        type: 'message',
        title: `💬 ${customer.name || (ar ? 'عميل' : 'Customer')}`,
        body: notify.message,
        fromUid: customer.uid,
        fromName: customer.name || '',
        bookingId: activeBooking?.id || '',
      });
      toast.success(ar ? `✅ تم إرسال الرسالة لـ ${notify.barberName}` : `✅ Message sent to ${notify.barberName}`);
    } catch {
      toast.error(ar ? 'فشل الإرسال' : 'Failed to send');
    }
  };

  const compressImage = (dataUrl: string): Promise<string> =>
    new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const MAX = 768;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.src = dataUrl;
    });

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error(ar ? 'الصورة كبيرة (10MB حد أقصى)' : 'Image too large (10MB max)'); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      const compressed = await compressImage(reader.result as string);
      setPendingImage(compressed);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const clearChat = () => { setMessages([welcome]); localStorage.removeItem(STORAGE_KEY); };
  const goBook = (b: BookingAction) => navigate(`/book/${b.barberId || 'b1'}`, { state: { service: b.service, time: b.time } });
  const busy = streaming || generatingImage;

  return (
    <div className="flex flex-col h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-3 px-4 pt-12 pb-3 border-b border-border bg-card/80 backdrop-blur-sm">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-2xl bg-secondary flex items-center justify-center">
          <ChevronLeft size={18} className={`text-foreground ${ar ? 'rotate-180' : ''}`} />
        </button>
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg"
          style={{ background: 'linear-gradient(135deg, hsl(38 92% 52%) 0%, hsl(28 90% 40%) 100%)' }}>
          <Scissors size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-foreground">{ASSISTANT_NAME}</p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <p className="text-[11px] text-muted-foreground">
              {activeBooking
                ? (ar ? `حجزك نشط · ${activeBooking.barberName}` : `Active booking · ${activeBooking.barberName}`)
                : (ar ? 'مساعدك الذكي' : 'Your smart assistant')}
            </p>
          </div>
        </div>
        <button onClick={clearChat} className="w-9 h-9 rounded-2xl bg-secondary flex items-center justify-center">
          <Trash2 size={14} className="text-muted-foreground" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <AnimatePresence initial={false}>
          {messages.map(m => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.role === 'assistant' && (
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 self-end mb-0.5"
                  style={{ background: 'linear-gradient(135deg, hsl(38 92% 52%) 0%, hsl(28 90% 40%) 100%)' }}>
                  <Scissors size={14} className="text-white" />
                </div>
              )}
              <div className={`max-w-[80%] flex flex-col gap-1.5 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                {m.imageUrl && (
                  <img src={m.imageUrl} alt="" className="rounded-2xl max-h-48 object-cover border border-border" />
                )}
                {m.text && (
                  <div className={`rounded-2xl px-3.5 py-2.5 ${
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-card border border-border text-foreground rounded-bl-sm'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.text}</p>
                  </div>
                )}
                {m.generatedImage && (
                  <div className="rounded-2xl overflow-hidden border border-border shadow-lg w-full">
                    <img src={m.generatedImage} alt="AI generated hairstyle" className="w-full max-h-64 object-cover" />
                    <div className="bg-card px-3 py-1.5">
                      <span className="text-[10px] text-muted-foreground">✨ {ar ? 'صورة بالذكاء الاصطناعي' : 'AI generated'}</span>
                    </div>
                  </div>
                )}
                {m.booking && (
                  <button
                    onClick={() => goBook(m.booking!)}
                    className="w-full bg-primary/10 border border-primary/30 text-primary rounded-2xl px-3 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <Calendar size={13} /> {ar ? '📅 احجز الآن' : '📅 Book Now'}
                  </button>
                )}
                {m.notify && (
                  <button
                    onClick={() => handleSendNotify(m.notify!)}
                    className="w-full bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded-2xl px-3 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <Bell size={13} /> {ar ? `🔔 أرسل لـ ${m.notify.barberName}` : `🔔 Notify ${m.notify.barberName}`}
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {busy && messages[messages.length - 1]?.text === '' && (
          <div className="flex gap-2 justify-start">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, hsl(38 92% 52%) 0%, hsl(28 90% 40%) 100%)' }}>
              <Scissors size={14} className="text-white" />
            </div>
            <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5">
              {[0, 1, 2].map(i => (
                <motion.span key={i}
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                  className="w-1.5 h-1.5 rounded-full bg-primary block"
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {messages.length <= 1 && (
        <div className={`px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-none`}>
          {suggestions.map(s => (
            <button
              key={s}
              onClick={() => send(s)}
              className="flex-shrink-0 bg-primary/10 border border-primary/20 text-primary rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {pendingImage && (
        <div className="px-4 pb-2">
          <div className="relative inline-block">
            <img src={pendingImage} alt="" className="h-16 w-16 object-cover rounded-2xl border border-border" />
            <button
              onClick={() => setPendingImage(null)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center"
            >
              <X size={11} />
            </button>
          </div>
        </div>
      )}

      <div className="px-4 py-3 border-t border-border bg-card/80 backdrop-blur-sm safe-area-bottom">
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="w-10 h-10 rounded-2xl bg-secondary flex items-center justify-center flex-shrink-0 disabled:opacity-40"
          >
            <ImagePlus size={16} className="text-muted-foreground" />
          </button>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            onKeyUp={e => { if (e.key === 'Enter') { e.preventDefault(); } }}
            placeholder={ar ? 'اكتب سؤالك...' : 'Ask anything...'}
            disabled={busy}
            enterKeyHint="send"
            inputMode="text"
            className="flex-1 bg-secondary rounded-2xl px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            dir={isRTL ? 'rtl' : 'ltr'}
          />
          <button
            onClick={handleGenerateImage}
            disabled={busy || !input.trim()}
            title={ar ? 'توليد صورة' : 'Generate image'}
            className="w-10 h-10 rounded-2xl bg-secondary flex items-center justify-center flex-shrink-0 disabled:opacity-40"
          >
            {generatingImage ? <Loader2 size={16} className="text-primary animate-spin" /> : <Wand2 size={16} className="text-primary" />}
          </button>
          <button
            onClick={() => send()}
            disabled={busy || (!input.trim() && !pendingImage)}
            className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 disabled:opacity-40 shadow-lg"
            style={{ background: 'linear-gradient(135deg, hsl(38 92% 52%) 0%, hsl(28 90% 40%) 100%)' }}
          >
            <Send size={15} className="text-white" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-1.5">
          {ar ? '🎨 العصا لتوليد صورة · 📷 الصورة لتحليل القصة' : '🎨 Wand for image gen · 📷 Photo to analyze style'}
        </p>
      </div>
    </div>
  );
}
