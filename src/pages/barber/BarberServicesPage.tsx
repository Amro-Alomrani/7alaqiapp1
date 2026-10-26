import { useEffect, useState, useRef } from 'react';
import { Plus, Trash2, Check, Pencil, ImagePlus, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getBarber, updateBarberProfile } from '@/lib/db';
import { describeImageUploadError, uploadImage } from '@/lib/storage';
import type { Service } from '@/types';

const SERVICE_ICONS = ['✂️', '💈', '🪒', '👑', '⭐', '🔥', '💇', '🎯'];

const CARD_GRADIENTS = [
  'from-blue-500/20 to-blue-600/5 border-blue-500/20',
  'from-purple-500/20 to-purple-600/5 border-purple-500/20',
  'from-green-500/20 to-green-600/5 border-green-500/20',
  'from-orange-500/20 to-orange-600/5 border-orange-500/20',
  'from-pink-500/20 to-pink-600/5 border-pink-500/20',
  'from-teal-500/20 to-teal-600/5 border-teal-500/20',
];

function ServiceSheet({
  initial,
  onSave,
  onClose,
  ar,
  barberUid,
}: {
  initial?: Service;
  onSave: (s: Service) => void;
  onClose: () => void;
  ar: boolean;
  barberUid: string;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [price, setPrice] = useState(String(initial?.price ?? ''));
  const [duration, setDuration] = useState(String(initial?.duration ?? ''));
  const [icon, setIcon] = useState(initial?.icon || '✂️');
  const [photo, setPhoto] = useState<string | undefined>(initial?.photo);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const canSave = name.trim() && price && duration;

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error(ar ? 'الصورة كبيرة جداً' : 'Image too large'); return; }
    setUploading(true);
    try {
      const serviceId = initial?.id || `s_${Date.now()}`;
      const url = await uploadImage(file, `barbers/${barberUid}/services/${serviceId}-${Date.now()}.jpg`);
      setPhoto(url);
      toast.success(ar ? 'تم رفع الصورة' : 'Photo uploaded');
    } catch (error) {
      toast.error(ar ? 'فشل رفع الصورة' : 'Upload failed', { description: describeImageUploadError(error, ar) });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center p-4 pb-8"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm bg-background border border-border rounded-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <h3 className="text-lg font-black text-foreground">
          {initial ? (ar ? 'تعديل الخدمة' : 'Edit Service') : (ar ? 'خدمة جديدة' : 'New Service')}
        </h3>

        <div>
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block mb-2">
            {ar ? 'صورة الخدمة (اختياري)' : 'Service Photo (optional)'}
          </label>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
        </div>
        <div>
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block mb-2">
            {ar ? 'الأيقونة' : 'Icon'}
          </label>
          <div className="flex gap-2 flex-wrap">
            {SERVICE_ICONS.map(ic => (
              <button
                key={ic}
                onClick={() => setIcon(ic)}
                className={`w-11 h-11 rounded-xl text-2xl flex items-center justify-center border-2 transition-all ${icon === ic ? 'border-primary bg-primary/10 scale-110' : 'border-border bg-card'}`}
              >
                {ic}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block mb-1.5">
            {ar ? 'اسم الخدمة' : 'Service Name'}
          </label>
          <input
            value={name} onChange={e => setName(e.target.value)}
            placeholder={ar ? 'مثال: قصة + فيد' : 'e.g. Fade & Taper'}
            className="w-full bg-card border border-border rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:border-primary transition"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block mb-1.5">
              {ar ? 'السعر (JOD)' : 'Price (JOD)'}
            </label>
            <input
              type="number" value={price} onChange={e => setPrice(e.target.value)}
              placeholder="20"
              className="w-full bg-card border border-border rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:border-primary transition"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block mb-1.5">
              {ar ? 'المدة (دق)' : 'Duration (min)'}
            </label>
            <input
              type="number" value={duration} onChange={e => setDuration(e.target.value)}
              placeholder="45"
              className="w-full bg-card border border-border rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:border-primary transition"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 bg-card border border-border h-12 rounded-2xl text-sm font-bold">
            {ar ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            onClick={() => {
              if (!canSave) return;
              onSave({
                id: initial?.id || Date.now().toString(),
                name: name.trim(),
                price: +price,
                duration: +duration,
                icon,
                photo,
              });
            }}
            disabled={!canSave || uploading}
            className="flex-1 bg-primary text-primary-foreground h-12 rounded-2xl text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-40"
          >
            <Check size={15} /> {ar ? 'حفظ' : 'Save'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function BarberServicesPage() {
  const { barberUser } = useAuth();
  const { language } = useLanguage();
  const ar = language === 'ar';

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Service | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!barberUser?.uid) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const profile = await getBarber(barberUser.uid);
        if (!cancelled) setServices(profile?.services || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [barberUser?.uid]);

  const persist = async (next: Service[]) => {
    if (!barberUser?.uid) return;
    try {
      await updateBarberProfile(barberUser.uid, { services: next });
    } catch {
      toast.error(ar ? 'فشل الحفظ' : 'Save failed');
    }
  };

  const save = (s: Service) => {
    setServices(prev => {
      const next = prev.some(x => x.id === s.id) ? prev.map(x => x.id === s.id ? s : x) : [...prev, s];
      void persist(next);
      return next;
    });
    setEditing(null);
    setAdding(false);
    toast.success(ar ? 'تم الحفظ' : 'Service saved');
  };

  const remove = (id: string) => {
    setServices(prev => {
      const next = prev.filter(x => x.id !== id);
      void persist(next);
      return next;
    });
    toast(ar ? 'تم الحذف' : 'Removed');
  };

  return (
    <div className="min-h-screen bg-background pb-28" dir={ar ? 'rtl' : 'ltr'}>
      <div className="px-5 pt-14 pb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground">{ar ? 'خدماتي' : 'My Services'}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {loading ? (ar ? 'جاري التحميل...' : 'Loading…') : `${services.length} ${ar ? 'خدمة نشطة' : 'active services'}`}
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2.5 rounded-2xl text-sm font-bold shadow-lg shadow-primary/25"
        >
          <Plus size={16} /> {ar ? 'إضافة' : 'Add'}
        </button>
      </div>

      <div className="px-5 space-y-3">
        {loading && (
          <div className="py-20 flex justify-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && services.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="text-center py-20 bg-card border border-dashed border-border rounded-3xl">
            <span className="text-5xl block mb-4">✂️</span>
            <h3 className="text-base font-black text-foreground mb-1">{ar ? 'لا توجد خدمات بعد' : 'No services yet'}</h3>
            <p className="text-xs text-muted-foreground mb-5">{ar ? 'أضف خدماتك ليراها العملاء' : 'Add services for customers to book'}</p>
            <button
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-5 py-2.5 rounded-2xl text-sm font-bold"
            >
              <Plus size={15} /> {ar ? 'أضف أول خدمة' : 'Add First Service'}
            </button>
          </motion.div>
        )}

        <AnimatePresence>
          {services.map((s, i) => (
            <motion.div
              key={s.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: i * 0.04 }}
              className={`relative bg-gradient-to-br border rounded-3xl p-4 overflow-hidden ${CARD_GRADIENTS[i % CARD_GRADIENTS.length]}`}
            >
              <span className="absolute -right-2 -bottom-3 text-7xl opacity-10 select-none pointer-events-none" aria-hidden>
                {s.icon}
              </span>

              <div className="flex items-center gap-3">
                {s.photo ? (
                  <img src={s.photo} alt={s.name} className="w-16 h-16 rounded-2xl object-cover flex-shrink-0 border border-border/40" />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-background/60 flex items-center justify-center text-3xl flex-shrink-0 shadow-sm">
                    {s.icon}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <p className="font-black text-foreground text-base leading-tight">{s.name}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xl font-black text-primary">{s.price} JOD</span>
                    <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                    <span className="text-xs text-muted-foreground font-bold">{s.duration} {ar ? 'دقيقة' : 'min'}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setEditing(s)}
                    className="w-9 h-9 bg-background/60 rounded-xl flex items-center justify-center"
                  >
                    <Pencil size={14} className="text-foreground" />
                  </button>
                  <button
                    onClick={() => remove(s.id)}
                    className="w-9 h-9 bg-destructive/10 rounded-xl flex items-center justify-center"
                  >
                    <Trash2 size={14} className="text-destructive" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {adding && (
          <ServiceSheet ar={ar} barberUid={barberUser?.uid || ''} onSave={save} onClose={() => setAdding(false)} />
        )}
        {editing && (
          <ServiceSheet ar={ar} barberUid={barberUser?.uid || ''} initial={editing} onSave={save} onClose={() => setEditing(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
