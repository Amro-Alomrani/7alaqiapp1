import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin, Image as ImageIcon, Scissors, Users, Loader2, ArrowRight,
  Clock, Trash2, Plus, Check, Camera, ChevronLeft, ChevronDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { updateBarberProfile, completeBarberOnboarding, addStaffMember, type BarberDoc } from '@/lib/db';
import { pickImage, uploadImage, profileImagePath, describeImageUploadError } from '@/lib/storage';
import { getCurrentLocation } from '@/lib/location';
import { MapContainer, Marker, useMapEvents } from 'react-leaflet';
import MapTileLayer from '@/components/maps/MapTileLayer';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const defaultIconPrototype = L.Icon.Default.prototype as typeof L.Icon.Default.prototype & { _getIconUrl?: string };
delete defaultIconPrototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/marker-icon-2x.png',
  iconUrl: '/marker-icon.png',
  shadowUrl: '/marker-shadow.png',
});

function FlyToPosition({ position }: { position: [number, number] | null }) {
  const map = useMapEvents({});
  useEffect(() => {
    if (position) map.flyTo(position, 15, { duration: 1 });
  }, [position, map]);
  return null;
}

function RegisterMapPicker({ onSelect }: { onSelect: (lat: number, lng: number) => void }) {
  useMapEvents({ click: event => onSelect(event.latlng.lat, event.latlng.lng) });
  return null;
}

function MapPicker({ onSelect, position }: { onSelect: (lat: number, lng: number) => void; position: [number, number] | null }) {
  const [locating, setLocating] = useState(false);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);

  const locateMe = () => {
    setLocating(true);
    void getCurrentLocation({ enableHighAccuracy: true, timeout: 30000 }).then(pos => {
      const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
      setUserPos(coords);
      onSelect(coords[0], coords[1]);
    }).catch(() => toast.error('تعذر تحديد الموقع'))
      .finally(() => setLocating(false));
  };

  return (
    <div className="relative">
      <div className="h-64 w-full rounded-2xl overflow-hidden border border-border relative z-0">
        <MapContainer center={position || userPos || [31.9539, 35.9106]} zoom={13} style={{ height: '100%', width: '100%' }}>
          <MapTileLayer />
          <RegisterMapPicker onSelect={onSelect} />
          <FlyToPosition position={position} />
          {position && <Marker position={position} />}
        </MapContainer>
      </div>
      <button
        onClick={locateMe}
        disabled={locating}
        className="absolute top-3 right-3 z-[1000] bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 flex items-center gap-1.5 shadow-md disabled:opacity-60"
      >
        {locating ? (
          <span className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          <span>📍</span>
        )}
        موقعي
      </button>
    </div>
  );
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SPECIALTY_COLORS = [
  'bg-blue-500/15 text-blue-400',
  'bg-purple-500/15 text-purple-400',
  'bg-green-500/15 text-green-400',
  'bg-orange-500/15 text-orange-400',
  'bg-pink-500/15 text-pink-400',
];

interface LocalStaff {
  id: string;
  name: string;
  specialties: string[];
  workingHours: { open: string; close: string };
  avatarFile: File | null;
  avatarPreview: string;
}

export default function BarberOnboardingPage() {
  const navigate = useNavigate();
  const { barberUser } = useAuth();
  const { language } = useLanguage();
  const ar = language === 'ar';
  const uid = barberUser?.uid || '';

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [salonName, setSalonName] = useState('');
  const [description, setDescription] = useState('');
  const [avatar, setAvatar] = useState<{ file: File; url: string } | null>(null);

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [workingHours, setWorkingHours] = useState({ open: '', close: '', days: [] as string[] });

  const [chairs, setChairs] = useState(2);

  const [services, setServices] = useState<{ id: string; name: string; price: number; duration: number; icon: string }[]>([]);
  const [svcName, setSvcName] = useState('');
  const [svcPrice, setSvcPrice] = useState('');
  const [svcDuration, setSvcDuration] = useState('');
  const [svcIcon, setSvcIcon] = useState('✂️');
  const SERVICE_ICONS = ['✂️', '💈', '🪒', '👑', '⭐', '🔥', '💇', '🎯'];

  const [staff, setStaff] = useState<LocalStaff[]>([]);
  const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffSpecialty, setNewStaffSpecialty] = useState('');
  const [newStaffHours, setNewStaffHours] = useState({ open: '', close: '' });
  const [newStaffAvatarFile, setNewStaffAvatarFile] = useState<File | null>(null);
  const [newStaffAvatarPreview, setNewStaffAvatarPreview] = useState('');
  const [addingStaff, setAddingStaff] = useState(false);

  const [galleryFiles, setGalleryFiles] = useState<{ file: File; url: string }[]>([]);

  const handlePickAvatar = async () => {
    const file = await pickImage();
    if (file) setAvatar({ file, url: URL.createObjectURL(file) });
  };

  const handlePickStaffAvatar = async () => {
    const file = await pickImage();
    if (!file) return;
    setNewStaffAvatarFile(file);
    setNewStaffAvatarPreview(URL.createObjectURL(file));
  };

  const handleAddStaff = async () => {
    if (!newStaffName.trim()) return;
    if (!newStaffHours.open || !newStaffHours.close || newStaffHours.open >= newStaffHours.close) {
      toast.error(ar ? 'أدخل ساعات عمل صحيحة للحلاق' : 'Enter valid working hours for this barber');
      return;
    }
    setAddingStaff(true);
    try {
      const id = Math.random().toString(36).slice(2);
      setStaff(prev => [...prev, {
        id,
        name: newStaffName.trim(),
        specialties: newStaffSpecialty.split(',').map(s => s.trim()).filter(Boolean),
        workingHours: { ...newStaffHours },
        avatarFile: newStaffAvatarFile,
        avatarPreview: newStaffAvatarPreview,
      }]);
      setShowAddStaff(false);
      setNewStaffName('');
      setNewStaffSpecialty('');
      setNewStaffHours({ open: '', close: '' });
      setNewStaffAvatarFile(null);
      setNewStaffAvatarPreview('');
    } catch (error) {
      toast.error(describeImageUploadError(error, ar));
    } finally {
      setAddingStaff(false);
    }
  };

  const addService = () => {
    const price = Number(svcPrice);
    const duration = Number(svcDuration);
    if (!svcName.trim() || !Number.isFinite(price) || price < 0 || !Number.isInteger(duration) || duration < 1) {
      toast.error(ar ? 'أدخل اسم الخدمة وسعراً صحيحاً ومدة بالدقائق' : 'Enter a service name, valid price, and duration in minutes');
      return;
    }
    setServices(prev => [...prev, { id: Math.random().toString(36).slice(2), name: svcName.trim(), price, duration, icon: svcIcon }]);
    setSvcName('');
    setSvcPrice('');
    setSvcDuration('');
  };

  const handleFinish = async () => {
    if (!uid) return;
    if (!salonName.trim() || !coords || services.length === 0) {
      toast.error(ar ? 'أكمل اسم الصالون وموقعه وأضف خدمة واحدة على الأقل' : 'Enter a salon name, pin its location, and add at least one service');
      return;
    }
    setLoading(true);
    try {
      let avatarUrl = '';
      const galleryUrls: string[] = [];
      const mediaFailures: unknown[] = [];
      if (avatar) {
        try { avatarUrl = await uploadImage(avatar.file, profileImagePath(uid, 'avatar')); }
        catch (error) { mediaFailures.push(error); }
      }

      for (const [i, g] of galleryFiles.entries()) {
        try {
          const url = await uploadImage(g.file, `${profileImagePath(uid, 'gallery')}_${i}`);
          galleryUrls.push(url);
        } catch (error) { mediaFailures.push(error); }
      }

      const barberPatch: Partial<BarberDoc> = {
        shopName: salonName.trim(),
        description: description.trim(),
        ...(avatarUrl ? { avatar: avatarUrl } : {}),
        lat: coords.lat,
        lng: coords.lng,
        workingHours,
        totalChairs: chairs,
        services,
        ...(galleryUrls.length ? { gallery: galleryUrls } : {}),
      };
      await updateBarberProfile(uid, barberPatch);

      for (const s of staff) {
        let staffAvatar = '';
        if (s.avatarFile) {
          try { staffAvatar = await uploadImage(s.avatarFile, `barbers/${uid}/staff/${s.id}.jpg`); }
          catch (error) { mediaFailures.push(error); }
        }
        await addStaffMember(uid, {
          barberId: uid,
          name: s.name,
          specialties: s.specialties,
          avatar: staffAvatar,
          workingHours: s.workingHours,
        });
      }

      await completeBarberOnboarding(uid);
      toast.success(ar ? '🎉 تم إعداد الصالون بنجاح!' : '🎉 Salon is ready!');
      if (mediaFailures.length) toast.error(describeImageUploadError(mediaFailures[0], ar));
      navigate('/barber', { replace: true });
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : (ar ? 'فشل الحفظ، حاول مجدداً' : 'Save failed, try again'));
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (step === 1 && !salonName.trim()) { toast.error(ar ? 'أدخل اسم الصالون' : 'Enter salon name'); return; }
    if (step === 2 && !coords) { toast.error(ar ? 'حدد الموقع على الخريطة' : 'Select location on map'); return; }
    if (step === 3 && (!workingHours.open || !workingHours.close || workingHours.open >= workingHours.close || workingHours.days.length === 0)) {
      toast.error(ar ? 'أدخل ساعات العمل واختر يوم عمل واحداً على الأقل' : 'Set valid opening hours and select at least one working day'); return;
    }
    if (step === 4 && services.length === 0) { toast.error(ar ? 'أضف خدمة واحدة على الأقل بسعر ومدة صحيحين' : 'Add at least one service with a valid price and duration'); return; }
    setStep(s => s + 1);
  };

  const TOTAL_STEPS = 7;

  return (
    <div className="min-h-screen bg-background flex flex-col pb-32 overflow-y-auto" dir={ar ? 'rtl' : 'ltr'}>
      <div className="px-6 pt-14 pb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center">
            <Scissors size={18} className="text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-black text-foreground">{ar ? 'إعداد الصالون' : 'Salon Setup'}</h1>
            <p className="text-xs text-muted-foreground">{ar ? `الخطوة ${step} من ${TOTAL_STEPS}` : `Step ${step} of ${TOTAL_STEPS}`}</p>
          </div>
        </div>
        <div className="flex gap-1.5">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <motion.div
              key={i}
              animate={{ flex: step > i ? 2 : 1 }}
              className={`h-1.5 rounded-full transition-colors ${step > i ? 'bg-primary' : step === i + 1 ? 'bg-primary/50' : 'bg-primary/15'}`}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 px-6">
        <AnimatePresence mode="wait">

          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-5">
              <h2 className="text-lg font-bold text-foreground">{ar ? 'معلومات الصالون' : 'Salon Info'}</h2>
              <div className="flex flex-col items-center gap-3 py-4">
                <button onClick={handlePickAvatar} className="w-28 h-28 rounded-3xl bg-card border-2 border-dashed border-border flex items-center justify-center overflow-hidden relative">
                  {avatar ? (
                    <img src={avatar.url} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <Camera size={28} />
                      <span className="text-[10px] font-bold">{ar ? 'شعار الصالون' : 'Logo'}</span>
                    </div>
                  )}
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-1.5 block">{ar ? 'اسم الصالون' : 'Salon Name'}</label>
                  <input
                    value={salonName} onChange={e => setSalonName(e.target.value)}
                    placeholder={ar ? 'مثال: صالون الأناقة' : 'e.g. Elegance Barbershop'}
                    className="w-full bg-card border border-border rounded-2xl px-4 py-3.5 text-sm font-bold outline-none focus:border-primary transition"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-1.5 block">{ar ? 'وصف مختصر' : 'Description'}</label>
                  <textarea
                    value={description} onChange={e => setDescription(e.target.value)}
                    placeholder={ar ? 'أخبر العملاء عن صالونك...' : 'Tell customers about your salon...'}
                    rows={3}
                    className="w-full bg-card border border-border rounded-2xl px-4 py-3 text-sm outline-none focus:border-primary transition resize-none"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
              <div className="flex items-center gap-2">
                <MapPin size={20} className="text-primary" />
                <h2 className="text-lg font-bold">{ar ? 'موقع الصالون' : 'Salon Location'}</h2>
              </div>
              <p className="text-xs text-muted-foreground">{ar ? 'اضغط على الخريطة لتحديد موقع صالونك' : 'Tap the map to pin your salon location'}</p>
              <MapPicker position={coords ? [coords.lat, coords.lng] : null} onSelect={(lat, lng) => setCoords({ lat, lng })} />
              {coords ? (
                <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-xl p-3">
                  <Check size={14} className="text-primary" />
                  <p className="text-xs text-primary font-bold">{ar ? 'تم تحديد الموقع' : 'Location pinned'} — {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</p>
                </div>
              ) : (
                <div className="bg-card border border-dashed border-border rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground">{ar ? 'لم يتم تحديد الموقع بعد' : 'No location selected yet'}</p>
                </div>
              )}
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-5">
              <div className="flex items-center gap-2">
                <Clock size={20} className="text-primary" />
                <h2 className="text-lg font-bold">{ar ? 'أوقات عمل الصالون' : 'Working Hours'}</h2>
              </div>
              <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block mb-1.5">{ar ? 'وقت الفتح' : 'Opens At'}</label>
                    <input
                      type="time" value={workingHours.open}
                      onChange={e => setWorkingHours(h => ({ ...h, open: e.target.value }))}
                      className="w-full bg-background border border-border rounded-xl px-3 py-3 text-sm font-bold outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block mb-1.5">{ar ? 'وقت الإغلاق' : 'Closes At'}</label>
                    <input
                      type="time" value={workingHours.close}
                      onChange={e => setWorkingHours(h => ({ ...h, close: e.target.value }))}
                      className="w-full bg-background border border-border rounded-xl px-3 py-3 text-sm font-bold outline-none focus:border-primary"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block mb-2">{ar ? 'أيام العمل' : 'Open Days'}</label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map(day => (
                      <button
                        key={day}
                        onClick={() => setWorkingHours(h => ({
                          ...h,
                          days: h.days.includes(day) ? h.days.filter(d => d !== day) : [...h.days, day],
                        }))}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${workingHours.days.includes(day) ? 'bg-primary border-primary text-primary-foreground' : 'bg-card border-border text-muted-foreground'}`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-black text-muted-foreground uppercase tracking-wider">{ar ? 'عدد الكراسي' : 'Total Chairs'}</p>
                  <span className="text-lg font-black text-primary">{chairs}</span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                    <button
                      key={n}
                      onClick={() => setChairs(n)}
                      className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 border-2 transition-all ${
                        n <= chairs
                          ? 'border-primary bg-primary/10 scale-105'
                          : 'border-border bg-card'
                      }`}
                    >
                      <span className="text-xl leading-none" style={{ filter: n <= chairs ? 'none' : 'grayscale(1) opacity(0.4)' }}>💺</span>
                      <span className={`text-[9px] font-black ${n <= chairs ? 'text-primary' : 'text-muted-foreground'}`}>{n}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 text-center">{ar ? 'اضغط لاختيار عدد الكراسي' : 'Tap to select number of chairs'}</p>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="s4" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
              <div className="flex items-center gap-2">
                <Scissors size={20} className="text-primary" />
                <h2 className="text-lg font-bold">{ar ? 'الخدمات' : 'Services'}</h2>
              </div>

              <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                <p className="text-xs font-black text-muted-foreground uppercase tracking-wider">{ar ? 'خدمة جديدة' : 'New Service'}</p>
                <div className="flex gap-2 flex-wrap">
                  {SERVICE_ICONS.map(ic => (
                    <button key={ic} onClick={() => setSvcIcon(ic)}
                      className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center border-2 transition ${svcIcon === ic ? 'border-primary bg-primary/10' : 'border-border bg-background'}`}>
                      {ic}
                    </button>
                  ))}
                </div>
                <input
                  value={svcName} onChange={e => setSvcName(e.target.value)}
                  placeholder={ar ? 'اسم الخدمة' : 'Service name'}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground font-bold block mb-1">{ar ? 'السعر (JOD)' : 'Price (JOD)'}</label>
                    <input type="number" min="0" step="0.01" value={svcPrice} onChange={e => setSvcPrice(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground font-bold block mb-1">{ar ? 'المدة (دقيقة)' : 'Duration (min)'}</label>
                    <input type="number" min="1" step="1" value={svcDuration} onChange={e => setSvcDuration(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary" />
                  </div>
                </div>
                <button onClick={addService} disabled={!svcName.trim()}
                  className="w-full bg-primary text-primary-foreground py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-40">
                  <Plus size={15} /> {ar ? 'إضافة' : 'Add Service'}
                </button>
              </div>

              <div className="space-y-2">
                {services.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground/50">
                    <Scissors size={32} className="mx-auto mb-2" />
                    <p className="text-xs">{ar ? 'لا توجد خدمات بعد' : 'No services yet'}</p>
                  </div>
                )}
                {services.map(s => (
                  <motion.div key={s.id} layout className="flex items-center gap-3 bg-card border border-border rounded-2xl p-3.5">
                    <span className="text-2xl">{s.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-foreground">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.price} JOD · {s.duration}m</p>
                    </div>
                    <button onClick={() => setServices(ss => ss.filter(x => x.id !== s.id))} className="text-destructive p-1">
                      <Trash2 size={15} />
                    </button>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div key="s5" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users size={20} className="text-primary" />
                  <h2 className="text-lg font-bold">{ar ? 'فريق العمل' : 'Staff'}</h2>
                </div>
                <button
                  onClick={() => setShowAddStaff(true)}
                  className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-2 rounded-xl text-xs font-bold"
                >
                  <Plus size={14} /> {ar ? 'إضافة' : 'Add'}
                </button>
              </div>

              {staff.length === 0 && (
                <div className="text-center py-12 bg-card border border-dashed border-border rounded-2xl">
                  <Users size={36} className="mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-bold text-foreground">{ar ? 'لا يوجد فريق عمل بعد' : 'No staff added yet'}</p>
                  <p className="text-xs text-muted-foreground mt-1">{ar ? 'اضغط + إضافة لإضافة حلاق' : 'Tap + Add to add a barber'}</p>
                </div>
              )}

              <div className="space-y-3">
                {staff.map((s) => {
                  const isExpanded = expandedStaffId === s.id;
                  return (
                    <motion.div key={s.id} layout className="bg-card border border-border rounded-2xl overflow-hidden">
                      <button
                        onClick={() => setExpandedStaffId(isExpanded ? null : s.id)}
                        className="w-full flex items-center gap-3 p-4"
                      >
                        {s.avatarPreview ? (
                          <img src={s.avatarPreview} alt={s.name} className="w-11 h-11 rounded-xl object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-lg flex-shrink-0">
                            {s.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 text-left">
                          <p className="font-bold text-foreground text-sm">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{s.specialties.slice(0, 2).join(', ')}{s.specialties.length > 2 ? '…' : ''}</p>
                        </div>
                        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                          <ChevronDown size={16} className="text-muted-foreground" />
                        </motion.div>
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            key="expanded"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-4 space-y-3 border-t border-border">
                              {s.avatarPreview && (
                                <img src={s.avatarPreview} alt={s.name} className="w-full h-40 rounded-xl object-cover mt-3" />
                              )}

                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5 bg-primary/10 rounded-xl px-3 py-2">
                                  <Clock size={13} className="text-primary" />
                                  <span className="text-xs font-bold text-primary">{s.workingHours.open}</span>
                                </div>
                                <span className="text-xs text-muted-foreground">→</span>
                                <div className="flex items-center gap-1.5 bg-primary/10 rounded-xl px-3 py-2">
                                  <Clock size={13} className="text-primary" />
                                  <span className="text-xs font-bold text-primary">{s.workingHours.close}</span>
                                </div>
                              </div>

                              {s.specialties.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {s.specialties.map((sp, idx) => (
                                    <span key={sp} className={`px-2.5 py-1 rounded-full text-xs font-bold ${SPECIALTY_COLORS[idx % SPECIALTY_COLORS.length]}`}>
                                      {sp}
                                    </span>
                                  ))}
                                </div>
                              )}

                              <button
                                onClick={() => { setStaff(ss => ss.filter(x => x.id !== s.id)); setExpandedStaffId(null); }}
                                className="flex items-center gap-1.5 text-destructive text-xs font-bold pt-1"
                              >
                                <Trash2 size={13} /> {ar ? 'حذف' : 'Remove'}
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {step === 6 && (
            <motion.div key="s6" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
              <div className="flex items-center gap-2">
                <ImageIcon size={20} className="text-primary" />
                <h2 className="text-lg font-bold">{ar ? 'معرض الصور' : 'Photo Gallery'}</h2>
              </div>
              <p className="text-xs text-muted-foreground">{ar ? 'أضف صور لأعمالك لجذب العملاء' : 'Add photos of your work to attract customers'}</p>
              <div className="grid grid-cols-2 gap-3">
                {galleryFiles.map((g, i) => (
                  <div key={i} className="aspect-square rounded-2xl overflow-hidden border border-border relative">
                    <img src={g.url} className="w-full h-full object-cover" alt="" />
                    <button
                      onClick={() => setGalleryFiles(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center"
                    >
                      <Trash2 size={12} className="text-white" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={async () => { const f = await pickImage(); if (f) setGalleryFiles(p => [...p, { file: f, url: URL.createObjectURL(f) }]); }}
                  className="aspect-square rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition"
                >
                  <Plus size={28} />
                  <span className="text-[10px] mt-1 font-bold">{ar ? 'إضافة صورة' : 'Add Photo'}</span>
                </button>
              </div>
            </motion.div>
          )}

          {step === 7 && (
            <motion.div key="s7" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
              <div className="flex items-center gap-2">
                <Check size={20} className="text-green-500" />
                <h2 className="text-lg font-bold">{ar ? 'مراجعة أخيرة' : 'Final Review'}</h2>
              </div>

              <div className="bg-card border border-border rounded-3xl p-5 space-y-4">
                <div className="flex items-center gap-4">
                  {avatar ? (
                    <img src={avatar.url} className="w-16 h-16 rounded-2xl object-cover" alt="" />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <Scissors size={24} className="text-primary" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-black text-foreground">{salonName || (ar ? 'بدون اسم' : 'Unnamed')}</h3>
                    <p className="text-xs text-muted-foreground">{description || (ar ? 'بدون وصف' : 'No description')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border">
                  {[
                    { label: ar ? 'الخدمات' : 'Services', value: services.length },
                    { label: ar ? 'فريق العمل' : 'Staff', value: staff.length },
                    { label: ar ? 'الكراسي' : 'Chairs', value: chairs },
                    { label: ar ? 'صور المعرض' : 'Gallery', value: galleryFiles.length },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-secondary/50 rounded-xl py-3 text-center">
                      <p className="text-base font-black text-foreground">{value}</p>
                      <p className="text-[10px] text-muted-foreground font-bold">{label}</p>
                    </div>
                  ))}
                </div>

                {coords && (
                  <div className="flex items-center gap-2 bg-green-500/10 rounded-xl p-2.5">
                    <Check size={14} className="text-green-500" />
                    <p className="text-xs text-green-500 font-bold">{ar ? 'الموقع محدد' : 'Location set'}</p>
                  </div>
                )}
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 text-center">
                <p className="text-sm font-bold text-primary">{ar ? '🎉 صالونك جاهز للانطلاق!' : '🎉 Your salon is ready to launch!'}</p>
                <p className="text-xs text-muted-foreground mt-1">{ar ? 'سيظهر صالونك للعملاء على الخريطة وقوائم الحلاقين' : 'Your salon will appear on the map and barber listings'}</p>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-sm border-t border-border p-5 flex justify-center">
        <div className="w-full max-w-sm flex gap-3">
          {step > 1 && (
            <button onClick={() => setStep(s => s - 1)} className="w-14 h-14 bg-card border border-border rounded-2xl flex items-center justify-center">
              <ChevronLeft size={22} className={ar ? 'rotate-180' : ''} />
            </button>
          )}
          {step < TOTAL_STEPS ? (
            <button
              onClick={nextStep}
              className="flex-1 bg-primary text-primary-foreground font-black h-14 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-primary/25"
            >
              {ar ? 'التالي' : 'Next'} <ArrowRight size={18} className={ar ? 'rotate-180' : ''} />
            </button>
          ) : (
            <button
              onClick={handleFinish} disabled={loading}
              className="flex-1 bg-green-500 text-white font-black h-14 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-green-500/25 disabled:opacity-50"
            >
              {loading ? <Loader2 size={22} className="animate-spin" /> : (ar ? '🚀 افتح الصالون' : '🚀 Launch Salon')}
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showAddStaff && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end justify-center p-4 pb-6"
            onClick={() => setShowAddStaff(false)}
          >
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm bg-background border border-border rounded-3xl p-6 space-y-4"
            >
              <h3 className="text-lg font-black text-foreground">{ar ? 'إضافة حلاق' : 'Add Barber'}</h3>

              <div className="flex justify-center">
                <button onClick={handlePickStaffAvatar}
                  className="w-24 h-24 rounded-2xl bg-card border-2 border-dashed border-border flex items-center justify-center overflow-hidden">
                  {newStaffAvatarPreview ? (
                    <img src={newStaffAvatarPreview} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <Camera size={24} />
                      <span className="text-[10px] font-bold">{ar ? 'صورة' : 'Photo'}</span>
                    </div>
                  )}
                </button>
              </div>

              <div>
                <label className="text-xs font-black text-muted-foreground uppercase tracking-wider block mb-1.5">{ar ? 'الاسم' : 'Name'}</label>
                <input
                  value={newStaffName} onChange={e => setNewStaffName(e.target.value)}
                  placeholder={ar ? 'مثال: أحمد' : 'e.g. Ahmed'}
                  className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-primary transition"
                />
              </div>

              <div>
                <label className="text-xs font-black text-muted-foreground uppercase tracking-wider block mb-1.5">{ar ? 'التخصصات (مفصولة بفاصلة)' : 'Specialties (comma separated)'}</label>
                <input
                  value={newStaffSpecialty} onChange={e => setNewStaffSpecialty(e.target.value)}
                  placeholder={ar ? 'مثال: فيد، لحية، ستايل' : 'e.g. Fades, Beards, Styling'}
                  className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-primary transition"
                />
              </div>

              <div>
                <label className="text-xs font-black text-muted-foreground uppercase tracking-wider block mb-2">{ar ? 'ساعات العمل' : 'Working Hours'}</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground font-bold block mb-1">{ar ? 'يبدأ' : 'Starts'}</label>
                    <input type="time" value={newStaffHours.open}
                      onChange={e => setNewStaffHours(h => ({ ...h, open: e.target.value }))}
                      className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground font-bold block mb-1">{ar ? 'ينتهي' : 'Ends'}</label>
                    <input type="time" value={newStaffHours.close}
                      onChange={e => setNewStaffHours(h => ({ ...h, close: e.target.value }))}
                      className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-primary" />
                  </div>
                </div>
              </div>

              <button
                onClick={handleAddStaff}
                disabled={addingStaff || !newStaffName.trim()}
                className="w-full bg-primary text-primary-foreground font-black py-3.5 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {addingStaff ? <Loader2 size={18} className="animate-spin" /> : <><Plus size={16} /> {ar ? 'إضافة للفريق' : 'Add to Team'}</>}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
