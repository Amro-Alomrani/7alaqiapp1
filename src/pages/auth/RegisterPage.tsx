import { useEffect, useRef, useState } from 'react';
import { useSafeBack } from "@/hooks/useSafeBack";
import { Capacitor } from '@capacitor/core';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, Globe, User, Phone, Mail, Lock, Scissors, MapPin, Loader2, Eye, EyeOff, Gift } from 'lucide-react';
import { MapContainer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { registerEmail } from '@/lib/auth-providers';
import { mapAuthError } from '@/lib/authErrors';
import { processReferralSignup } from '@/lib/db';
import { getCurrentLocation } from '@/lib/location';
import MapTileLayer from '@/components/maps/MapTileLayer';
import { loyaltyEnabled } from '@/lib/features';

const PICKER_ICON = L.divIcon({
  className: '',
  html: '<div style="width:22px;height:22px;border:3px solid white;border-radius:50%;background:#f59e0b;box-shadow:0 2px 8px #0008"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function RegisterMapPicker({ onPick }: { onPick: (position: { lat: number; lng: number }) => void }) {
  useMapEvents({ click: event => onPick({ lat: event.latlng.lat, lng: event.latlng.lng }) });
  return null;
}

function CenterSelectedLocation({ position }: { position: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo([position.lat, position.lng], Math.max(map.getZoom(), 16), { duration: 0.6 });
  }, [map, position]);
  return null;
}

type Role = 'customer' | 'barber';

export default function RegisterPage() {
  const navigate = useNavigate();
  const safeBack = useSafeBack();
  const { loginCustomer, loginBarber } = useAuth();
  const { language, setLanguage } = useLanguage();
  const ar = language === 'ar';

  const [role, setRole] = useState<Role>('customer');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shopName, setShopName] = useState('');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const locationRequest = useRef<AbortController | null>(null);

  useEffect(() => () => { locationRequest.current?.abort(); }, []);

  const cancelLocation = () => {
    locationRequest.current?.abort();
    locationRequest.current = null;
    setLocating(false);
  };
  const selectCoordinates = (position: { lat: number; lng: number }) => {
    cancelLocation();
    setCoords(position);
  };


  const fullPhone = () => {
    const digits = phone.replace(/\D/g, '').replace(/^962/, '').replace(/^0+/, '');
    return digits ? `+962${digits}` : '';
  };

  const captureLocation = () => {
    if (locating) return;
    const request = new AbortController();
    locationRequest.current = request;
    setLocating(true);
    const isNative = Capacitor.isNativePlatform();
    void getCurrentLocation({
      // Desktop browsers can use their network location without waiting for
      // a GPS receiver. The returned real pin is shown for salon verification.
      enableHighAccuracy: isNative,
      timeout: isNative ? 20000 : 8000,
      maximumAge: isNative ? 0 : 30000,
      signal: request.signal,
    }).then(pos => {
      if (request.signal.aborted) return;
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setMapPickerOpen(true);
      toast.success(ar ? '📍 تم تحديد موقع الصالون' : '📍 Salon location captured');
    }).catch(error => {
      if (request.signal.aborted) return;
      setMapPickerOpen(true);
      toast.error(error?.code === 1
        ? (ar ? 'اسمح بالوصول إلى الموقع ثم حاول مجددًا.' : 'Allow location access and try again.')
        : (ar ? 'تعذر تحديد الموقع تلقائيًا. حدّد نقطة الصالون على الخريطة.' : 'Automatic location is unavailable. Choose the salon pin on the map.'));
    }).finally(() => {
      if (locationRequest.current === request) {
        locationRequest.current = null;
        setLocating(false);
      }
    });
  };

  const canSubmit = () => {
    if (!name.trim() || !email.trim() || password.length < 6) return false;
    if (role === 'customer' && !/^7\d{8}$/.test(phone.replace(/\D/g, '').replace(/^962/, '').replace(/^0+/, ''))) return false;
    if (role === 'barber' && (!shopName.trim() || !address.trim() || !coords)) return false;
    return true;
  };

  const doCreateAccount = async () => {
    setLoading(true);
    try {
      const user = await registerEmail({
        email: email.trim(),
        password,
        name: name.trim(),
        phone: fullPhone(),
        role,
        shopName: shopName.trim() || undefined,
        address: address.trim() || undefined,
        lat: coords?.lat,
        lng: coords?.lng,
      });
      if (role === 'customer') {
        loginCustomer(user.phone || '', user.name, user.uid);
        if (loyaltyEnabled && referralCode.trim()) {
          try {
            const referred = await processReferralSignup(referralCode.trim());
            if (referred === 'awarded') {
              toast.success(ar ? '🎁 ربحت 50 نقطة كمكافأة ترحيب!' : '🎁 You earned 50 welcome points!');
            } else if (referred === 'already_processed') {
              toast.success(ar ? 'تم تسجيل الدعوة مسبقاً' : 'This invite was already processed');
            } else {
              toast.error(ar ? 'كود الدعوة غير صحيح، لم تُضف نقاط' : 'Invalid invite code; no points were added');
            }
          } catch (error) {
            toast.error(ar ? 'تم إنشاء الحساب، لكن تعذرت معالجة الدعوة. تواصل مع الدعم قبل إعادة المحاولة.' : 'Account created, but the invite could not be processed. Contact support before trying again.', {
              description: error instanceof Error ? error.message : undefined,
            });
          }
        }
        toast.success(ar ? `مرحباً ${user.name} 🎉` : `Welcome, ${user.name} 🎉`);
        navigate('/');
      } else {
        loginBarber(user.email || email, user.uid, user.name, shopName.trim() || undefined);
        toast.success(ar ? `مرحباً ${user.name} ✂️` : `Welcome, ${user.name} ✂️`);
        navigate('/barber');
      }
    } catch (error: unknown) {
      const code = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
        ? error.code
        : undefined;
      toast.error(mapAuthError(code, ar));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit()) {
      if (role === 'barber' && !coords) {
        toast.error(ar ? 'حدد موقع صالونك أولاً' : 'Capture your salon location first');
        return;
      }
      toast.error(ar ? 'املأ جميع الحقول' : 'Fill in all required fields');
      return;
    }
    await doCreateAccount();
  };

  return (
    <div className="min-h-screen flex flex-col px-6 pt-20 pb-8 bg-background relative overflow-x-hidden" dir={ar ? 'rtl' : 'ltr'}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[250px] rounded-full opacity-15"
          style={{ background: 'radial-gradient(ellipse, hsl(38 92% 52%) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, hsl(38 92% 52%) 0%, transparent 70%)' }} />
      </div>
      <button
        onClick={() => safeBack()}
        className={`absolute top-14 ${ar ? 'right-5' : 'left-5'} flex items-center gap-1 text-muted-foreground z-10`}
      >
        <ChevronLeft size={16} className={ar ? 'rotate-180' : ''} />
        <span className="text-sm">{ar ? 'رجوع' : 'Back'}</span>
      </button>

      <div className={`absolute top-14 ${ar ? 'left-5' : 'right-5'} z-10`}>
        <button
          onClick={() => setLanguage(ar ? 'en' : 'ar')}
          className="flex items-center gap-1.5 bg-card border border-border rounded-xl px-3 py-2 text-sm font-bold text-foreground"
        >
          <Globe size={13} className="text-primary" />
          {ar ? 'EN' : 'عربي'}
        </button>
      </div>

      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center mb-6">
        <img src="/logo.png" alt="HALAQI" className="w-16 h-16 object-contain mb-1 drop-shadow-xl" />
        <h1 className="text-2xl font-black text-foreground">{ar ? 'إنشاء حساب جديد' : 'Create your account'}</h1>
        <p className="text-muted-foreground text-xs mt-1">{ar ? 'ابدأ رحلتك مع حلاقي' : 'Start your 7alaqi journey'}</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => { cancelLocation(); setRole('customer'); }}
            className={`rounded-2xl p-4 border-2 text-center transition-all ${role === 'customer' ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}
          >
            <User size={22} className={`mx-auto mb-1 ${role === 'customer' ? 'text-primary' : 'text-muted-foreground'}`} />
            <p className="text-sm font-bold text-foreground">{ar ? 'زبون' : 'Customer'}</p>
            <p className="text-[10px] text-muted-foreground">{ar ? 'للحجز والمتابعة' : 'Book & follow'}</p>
          </button>
          <button
            onClick={() => { cancelLocation(); setRole('barber'); }}
            className={`rounded-2xl p-4 border-2 text-center transition-all ${role === 'barber' ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}
          >
            <Scissors size={22} className={`mx-auto mb-1 ${role === 'barber' ? 'text-primary' : 'text-muted-foreground'}`} />
            <p className="text-sm font-bold text-foreground">{ar ? 'حلاق' : 'Barber'}</p>
            <p className="text-[10px] text-muted-foreground">{ar ? 'صالون أو مستقل' : 'Solo or shop'}</p>
          </button>
        </div>

        <Field label={ar ? 'الاسم الكامل' : 'Full name'} icon={<User size={15} />}
          value={name} onChange={setName} placeholder={ar ? 'مثال: أحمد الراشد' : 'e.g. Ahmed Al-Rasheed'} />

        <Field label={ar ? 'البريد الإلكتروني' : 'Email'} icon={<Mail size={15} />}
          type="email" value={email} onChange={setEmail} placeholder="you@example.com" ltr />

        <div className="bg-card border-2 border-border rounded-2xl px-4 py-3 focus-within:border-primary transition">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-semibold">
            {ar ? 'كلمة المرور' : 'Password'}
          </p>
          <div className="flex items-center gap-2" dir="ltr">
            <Lock size={15} className="text-muted-foreground" />
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              className="bg-transparent text-base text-foreground placeholder:text-muted-foreground flex-1 outline-none"
            />
            <button onClick={() => setShowPw(s => !s)} type="button">
              {showPw ? <EyeOff size={15} className="text-muted-foreground" /> : <Eye size={15} className="text-muted-foreground" />}
            </button>
          </div>
        </div>

        <div className="bg-card border-2 border-border rounded-2xl px-4 py-3 focus-within:border-primary transition" dir="ltr">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-semibold">
            {ar ? 'رقم الهاتف *' : 'Phone number *'}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm">🇯🇴</span>
            <span className="text-sm font-bold text-muted-foreground">+962</span>
            <div className="w-px h-5 bg-border" />
            <Phone size={14} className="text-muted-foreground" />
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
              placeholder="750 123 4567"
              className="bg-transparent text-base text-foreground placeholder:text-muted-foreground flex-1 outline-none"
            />
          </div>
        </div>

        {role === 'barber' && (
          <>
            <Field label={ar ? 'اسم الصالون' : 'Shop name'} icon={<Scissors size={14} />}
              value={shopName} onChange={setShopName} placeholder={ar ? 'مثال: كلاسيك كَت' : 'e.g. Classic Cuts'} />
            <Field label={ar ? 'العنوان' : 'Address'} icon={<MapPin size={14} />}
              value={address} onChange={setAddress} placeholder={ar ? 'مثال: عمّان، الدوار السابع' : 'e.g. Amman, 7th Circle'} />

            <button
              onClick={captureLocation}
              disabled={locating}
              type="button"
              className={`w-full flex items-center justify-center gap-2 h-14 rounded-2xl border-2 font-bold transition ${
                coords ? 'border-green-500/50 bg-green-500/10 text-green-500' : 'border-primary/40 bg-primary/5 text-primary'
              }`}
            >
              {locating
                ? <><Loader2 size={16} className="animate-spin" /> {ar ? 'جاري التحديد...' : 'Locating...'}</>
                : coords
                  ? <><MapPin size={16} /> {ar ? `📍 الموقع جاهز (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})` : `📍 Location set (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`}</>
                  : <><MapPin size={16} /> {ar ? 'استخدم موقعي الحالي' : 'Use my current location'}</>}
            </button>
            {role === 'barber' && (
              <div className="-mt-2 space-y-2">
                <p className="text-[11px] text-muted-foreground text-center">
                  {coords
                    ? (ar ? 'تأكد من النقطة أو صححها يدوياً على الخريطة.' : 'Verify or adjust the pin manually on the map.')
                    : (ar ? 'يمكنك اختيار موقع الصالون يدوياً إذا لم يعمل GPS.' : 'Choose the salon location manually if GPS is unavailable.')}
                </p>
                <button type="button" onClick={() => setMapPickerOpen(open => !open)}
                  className="w-full rounded-xl border border-border bg-card py-2 text-xs font-bold text-foreground">
                  {mapPickerOpen ? (ar ? 'إغلاق الخريطة' : 'Close map') : (ar ? 'اختيار الموقع على الخريطة' : 'Choose location on map')}
                </button>
                {mapPickerOpen && (
                  <div className="overflow-hidden rounded-2xl border border-border">
                    <p className="bg-card px-3 py-2 text-[11px] text-muted-foreground">
                      {ar ? 'اضغط على موقع الصالون بدقة. مركز الخريطة في عمّان للعرض فقط وليس موقع جهازك.' : 'Tap the exact salon location. Amman is only the initial map view, not your device location.'}
                    </p>
                    <MapContainer center={coords ? [coords.lat, coords.lng] : [31.9539, 35.9106]} zoom={coords ? 16 : 12}
                      style={{ height: 240, width: '100%' }} scrollWheelZoom>
                      <MapTileLayer />
                      <CenterSelectedLocation position={coords} />
                      <RegisterMapPicker onPick={selectCoordinates} />
                      {coords && <Marker position={[coords.lat, coords.lng]} icon={PICKER_ICON} draggable
                        eventHandlers={{ dragend: event => {
                          const point = (event.target as L.Marker).getLatLng();
                          selectCoordinates({ lat: point.lat, lng: point.lng });
                        } }} />}
                    </MapContainer>
                    {coords && <p className="bg-card px-3 py-2 text-center text-xs font-bold text-primary">
                      {ar ? `تم حفظ النقطة: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : `Selected: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`}
                    </p>}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {loyaltyEnabled && role === 'customer' && (
          <div className="bg-card border-2 border-border rounded-2xl px-4 py-3 focus-within:border-primary transition">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-semibold">
              {ar ? 'كود الدعوة (اختياري)' : 'Referral code (optional)'}
            </p>
            <div className="flex items-center gap-2" dir="ltr">
              <Gift size={15} className="text-muted-foreground" />
              <input
                type="text"
                value={referralCode}
                onChange={e => setReferralCode(e.target.value.toUpperCase())}
                placeholder="e.g. AHMED-X7F2"
                className="bg-transparent text-base text-foreground placeholder:text-muted-foreground flex-1 outline-none font-mono"
              />
            </div>
            <p className="text-[10px] text-green-500 mt-1">{ar ? '🎁 ربح 50 نقطة إذا استخدمت كود صديقك' : '🎁 Earn 50 bonus points with a friend\'s code'}</p>
          </div>
        )}

        <Button
          onClick={handleSubmit}
          disabled={loading || !canSubmit()}
          className="w-full h-14 text-base font-bold rounded-2xl bg-primary text-primary-foreground mt-2"
        >
          {loading
            ? (ar ? 'جاري إنشاء الحساب...' : 'Creating account...')
            : (ar ? 'إنشاء الحساب →' : 'Create account →')}
        </Button>

        <p className="text-center text-xs text-muted-foreground pt-2">
          {ar ? 'لديك حساب؟' : 'Already have an account?'}{' '}
          <button onClick={() => navigate('/login')} className="text-primary font-bold">
            {ar ? 'تسجيل الدخول' : 'Sign in'}
          </button>
        </p>
      </motion.div>

    </div>
  );
}

function Field({
  label, icon, value, onChange, placeholder, type = 'text', ltr = false,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  ltr?: boolean;
}) {
  return (
    <div className="bg-card border-2 border-border rounded-2xl px-4 py-3 focus-within:border-primary transition">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-semibold">{label}</p>
      <div className="flex items-center gap-2" dir={ltr ? 'ltr' : undefined}>
        <span className="text-muted-foreground">{icon}</span>
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="bg-transparent text-base text-foreground placeholder:text-muted-foreground flex-1 outline-none"
        />
      </div>
    </div>
  );
}
