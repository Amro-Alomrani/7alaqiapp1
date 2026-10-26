import { useState, useRef, useEffect } from 'react';
import { useSafeBack } from "@/hooks/useSafeBack";
import { Send, ChevronLeft, Trash2, Scissors } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ASSISTANT_NAME } from '@/lib/grok-ai';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLiveBooking } from '@/contexts/LiveBookingContext';
import { useBarbers } from '@/contexts/DataContext';

interface UIMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  imageUrl?: string;
  generatedImage?: string;
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
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_PERSISTED))); }
  catch { /* Chat can continue when local storage is disabled or full. */ }
}

export default function ChatPage() {
  const navigate = useNavigate();
  const safeBack = useSafeBack();
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';
  const { activeBooking } = useLiveBooking();
  const allBarbers = useBarbers();

  const welcome: UIMessage = {
    id: 'welcome',
    role: 'assistant',
    text: ar
      ? `أهلاً! الذكاء الاصطناعي غير مفعّل حالياً. أقدر أعرض لك حالة حجزك أو الحلاقين المعلّمين كمتاحين حسب بيانات التطبيق الفعلية، بدون إرسال محادثتك إلى خدمة خارجية.`
      : `Hi! AI is currently disabled. I can show your booking status or barbers marked available in the app's live data, without sending your conversation to an external service.`,
  };

  const [messages, setMessages] = useState<UIMessage[]>(() => {
    const saved = loadHistory();
    return saved.length > 0 ? saved : [welcome];
  });
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageIdRef = useRef(0);

  useEffect(() => {
    saveHistory(messages);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    });
  }, [messages]);

  const suggestions = ar
    ? ['مين متاح هلا؟', 'شو حالة حجزي؟', 'كيف أحجز؟']
    : ['Who is available now?', 'What is my booking status?', 'How do I book?'];

  const answerFromAppData = (question: string): string => {
    const normalized = question.toLocaleLowerCase();
    if (/متاح|فاتح|مفتوح|available|open/.test(normalized)) {
      const available = allBarbers.filter(b => b.available && b.liveStatus === 'available' && b.isLive !== false && b.services?.length);
      if (!available.length) {
        return ar
          ? 'لا توجد صالونات منشورة ومعلّمة كمتاحة الآن في بيانات التطبيق. ستظهر هنا بعد أن يكمل الحلاق إعداد صالونه ويفتحه.'
          : 'No published salons are marked available in the app right now. They will appear here after a barber completes setup and opens the salon.';
      }
      const rows = available.slice(0, 8).map(b => `• ${b.shopName} — ${b.name}`);
      return ar ? `الحلاقون المعلّمون كمتاحين الآن:\n${rows.join('\n')}` : `Barbers marked available now:\n${rows.join('\n')}`;
    }
    if (/حجز|حجزي|booking|appointment/.test(normalized)) {
      if (!activeBooking) return ar ? 'ما عندك حجز نشط حالياً. افتح قائمة الصالونات لاختيار حلاق وخدمة.' : 'You have no active booking. Open the salon list to choose a barber and service.';
      const labels: Record<string, [string, string]> = {
        requested: ['بانتظار موافقة الحلاق', 'Waiting for the barber'],
        accepted: ['تم تأكيد الحجز', 'Confirmed'],
        preparing: ['الحلاق يجهّز للحجز', 'The barber is preparing'],
        your_turn: ['حان دورك', 'It is your turn'],
        in_progress: ['الحلاقة جارية', 'In progress'],
        completed: ['مكتمل', 'Completed'],
        cancelled: ['ملغى', 'Cancelled'],
        rejected: ['مرفوض', 'Declined'],
      };
      const status = labels[activeBooking.status]?.[ar ? 0 : 1] || activeBooking.status;
      return ar
        ? `حجزك مع ${activeBooking.barberShop} — ${activeBooking.service.name}: ${status}.`
        : `Your ${activeBooking.service.name} booking at ${activeBooking.barberShop}: ${status}.`;
    }
    if (/احجز|كيف.*حجز|book/.test(normalized)) {
      return ar ? 'افتح الخريطة أو قائمة الصالونات، اختر صالوناً منشوراً وخدمة، ثم أرسل طلب الحجز.' : 'Open the map or salon list, choose a published salon and service, then send a booking request.';
    }
    return ar
      ? 'الذكاء الاصطناعي متوقف حالياً. أقدر أجيب فقط من بيانات التطبيق: اسألني عن الحلاقين المتاحين الآن أو حالة حجزك.'
      : 'AI is currently disabled. I can answer from app data only: ask about currently available barbers or your booking status.';
  };

  const send = (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text) return;
    messageIdRef.current += 1;
    const id = messageIdRef.current;
    const userMsg: UIMessage = { id: `u-${id}`, role: 'user', text };
    const assistantMsg: UIMessage = { id: `a-${id}`, role: 'assistant', text: answerFromAppData(text) };
    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setInput('');
  };

  const clearChat = () => {
    setMessages([welcome]);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* Local history is optional. */ }
  };

  return (
    <div className="flex flex-col h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-3 px-4 pt-12 pb-3 border-b border-border bg-card/80 backdrop-blur-sm">
        <button onClick={() => safeBack()} className="w-9 h-9 rounded-2xl bg-secondary flex items-center justify-center">
          <ChevronLeft size={18} className={`text-foreground ${ar ? 'rotate-180' : ''}`} />
        </button>
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg"
          style={{ background: 'linear-gradient(135deg, hsl(38 92% 52%) 0%, hsl(28 90% 40%) 100%)' }}>
          <Scissors size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-foreground">{ASSISTANT_NAME}</p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
            <p className="text-[11px] text-muted-foreground">
              {ar ? 'الردود من بيانات التطبيق · الذكاء الاصطناعي متوقف' : 'App data only · AI is off'}
              {activeBooking ? ` · ${ar ? 'لديك حجز نشط' : 'Active booking'}` : ''}
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
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

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

      <div className="px-4 py-3 border-t border-border bg-card/80 backdrop-blur-sm safe-area-bottom">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            onKeyUp={e => { if (e.key === 'Enter') { e.preventDefault(); } }}
            placeholder={ar ? 'اكتب سؤالك...' : 'Ask anything...'}
            enterKeyHint="send"
            inputMode="text"
            className="flex-1 bg-secondary rounded-2xl px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            dir={isRTL ? 'rtl' : 'ltr'}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim()}
            className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 disabled:opacity-40 shadow-lg"
            style={{ background: 'linear-gradient(135deg, hsl(38 92% 52%) 0%, hsl(28 90% 40%) 100%)' }}
          >
            <Send size={15} className="text-white" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-1.5">
          {ar ? 'لا تُرسل رسالتك إلى أي مزوّد ذكاء اصطناعي خارجي' : 'Messages are not sent to an external AI provider'}
        </p>
      </div>
    </div>
  );
}
