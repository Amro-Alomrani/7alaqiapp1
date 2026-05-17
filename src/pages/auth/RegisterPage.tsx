import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Globe, User, Phone, Mail, Lock, Scissors, MapPin, Loader2, Eye, EyeOff, Gift, Shield, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { registerEmail, sendPhoneOTP, verifyPhoneOTP } from '@/lib/auth-providers';
import { mapAuthError } from './LoginPage';
import { processReferralSignup } from '@/lib/db';

type Role = 'customer' | 'barber';

export default function RegisterPage() {
  const navigate = useNavigate();
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
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [referralCode, setReferralCode] = useState('');

  const [otpStep, setOtpStep] = useState(false);
  const [verificationId, setVerificationId] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const fullPhone = () => phone ? `+962${phone.replace(/^0+/, '')}` : '';

  const captureLocation = () => {
    if (!navigator.geolocation) {
      toast.error(ar ? 'جهازك لا يدعم تحديد الموقع' : 'Geolocation not supported');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
        toast.success(ar ? '📍 تم تحديد موقع الصالون' : '📍 Salon location captured');
      },
      err => {
        setLocating(false);
        toast.error(
          err.code === 1
            ? (ar ? 'تم رفض إذن الموقع — فعّله من إعدادات المتصفح' : 'Permission denied — enable in settings')
            : (ar ? 'فشل تحديد الموقع' : 'Failed to get location')
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const canSubmit = () => {
    if (!name.trim() || !email.trim() || password.length < 6) return false;
    if (role === 'customer' && phone.replace(/\D/g, '').length < 7) return false;
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
        if (referralCode.trim()) {
          const referred = await processReferralSignup(user.uid, user.name || name.trim(), referralCode.trim());
          if (referred) {
            toast.success(ar ? '🎁 ربحت 50 نقطة كمكافأة ترحيب!' : '🎁 You earned 50 welcome points!');
          } else {
            toast(ar ? 'كود الإحالة غير صحيح أو منتهي' : 'Referral code not found');
          }
        }
        toast.success(ar ? `مرحباً ${user.name} 🎉` : `Welcome, ${user.name} 🎉`);
        navigate('/');
      } else {
        loginBarber(user.email || email, user.uid, user.name, shopName.trim() || undefined);
        toast.success(ar ? `مرحباً ${user.name} ✂️` : `Welcome, ${user.name} ✂️`);
        navigate('/barber');
      }
    } catch (e: any) {
      toast.error(mapAuthError(e?.code, ar));
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
    if (role === 'customer' && phone.replace(/\D/g, '').length >= 7) {
      setLoading(true);
      try {
        const result = await sendPhoneOTP(fullPhone());
        setVerificationId(result.verificationId);
        setOtpCode('');
        setOtpStep(true);
        toast.success(ar ? `📲 تم إرسال رمز التحقق إلى ${fullPhone()}` : `📲 OTP sent to ${fullPhone()}`);
      } catch {
        toast.error(ar ? 'فشل إرسال الرمز' : 'Failed to send OTP');
      } finally {
        setLoading(false);
      }
      return;
    }
    await doCreateAccount();
  };

  const handleVerifyOTP = async () => {
    if (otpCode.length !== 6) {
      toast.error(ar ? 'أدخل الرمز المكوّن من 6 أرقام' : 'Enter the 6-digit code');
      return;
    }
    setOtpLoading(true);
    try {
      await verifyPhoneOTP(verificationId, otpCode, fullPhone());
      setOtpStep(false);
      await doCreateAccount();
    } catch {
      toast.error(ar ? 'رمز التحقق غير صحيح' : 'Invalid verification code');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleOtpInput = (i: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const chars = otpCode.split('');
    chars[i] = digit;
    const next = chars.join('').slice(0, 6);
    setOtpCode(next);
    if (digit && i < 5) otpRefs.current[i + 1]?.focus();
  };

  return (
    <div className="min-h-screen flex flex-col px-6 pt-20 pb-8 bg-background relative overflow-hidden" dir={ar ? 'rtl' : 'ltr'}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[250px] rounded-full opacity-15"
          style={{ background: 'radial-gradient(ellipse, hsl(38 92% 52%) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, hsl(38 92% 52%) 0%, transparent 70%)' }} />
      </div>
      <button
        onClick={() => navigate(-1)}
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
            onClick={() => setRole('customer')}
            className={`rounded-2xl p-4 border-2 text-center transition-all ${role === 'customer' ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}
          >
            <User size={22} className={`mx-auto mb-1 ${role === 'customer' ? 'text-primary' : 'text-muted-foreground'}`} />
            <p className="text-sm font-bold text-foreground">{ar ? 'زبون' : 'Customer'}</p>
            <p className="text-[10px] text-muted-foreground">{ar ? 'للحجز والمتابعة' : 'Book & follow'}</p>
          </button>
          <button
            onClick={() => setRole('barber')}
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
                  : <><MapPin size={16} /> {ar ? 'حدد موقع الصالون على الخريطة' : 'Capture salon location'}</>}
            </button>
            {!coords && (
              <p className="text-[11px] text-muted-foreground text-center -mt-2">
                {ar ? 'الزبائن سيرون موقعك على الخريطة' : 'Customers will see your salon on the map'}
              </p>
            )}
          </>
        )}

        {role === 'customer' && (
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

      <AnimatePresence>
        {otpStep && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setOtpStep(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm bg-background border border-border rounded-t-3xl p-6 pb-10"
              dir={ar ? 'rtl' : 'ltr'}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center">
                    <Shield size={18} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-black text-foreground text-base">{ar ? 'التحقق من الهاتف' : 'Phone Verification'}</p>
                    <p className="text-xs text-muted-foreground">{ar ? `تم الإرسال إلى ${fullPhone()}` : `Sent to ${fullPhone()}`}</p>
                  </div>
                </div>
                <button onClick={() => setOtpStep(false)} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                  <X size={14} />
                </button>
              </div>

              <p className="text-sm text-muted-foreground mb-4 text-center">
                {ar ? 'أدخل رمز التحقق المكوّن من 6 أرقام' : 'Enter the 6-digit verification code'}
              </p>

              <div className="flex justify-center gap-2 mb-6" dir="ltr">
                {Array.from({ length: 6 }).map((_, i) => (
                  <input
                    key={i}
                    ref={el => { otpRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={otpCode[i] || ''}
                    onChange={e => handleOtpInput(i, e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Backspace' && !otpCode[i] && i > 0) {
                        otpRefs.current[i - 1]?.focus();
                        const chars = otpCode.split('');
                        chars[i - 1] = '';
                        setOtpCode(chars.join(''));
                      }
                    }}
                    className={`w-11 h-13 text-center text-xl font-black border-2 rounded-xl bg-card outline-none transition-all ${
                      otpCode[i] ? 'border-primary text-foreground' : 'border-border text-muted-foreground'
                    }`}
                    style={{ height: '3.25rem' }}
                  />
                ))}
              </div>

              <Button
                onClick={handleVerifyOTP}
                disabled={otpCode.length < 6 || otpLoading}
                className="w-full h-12 text-base font-bold rounded-2xl bg-primary text-primary-foreground"
              >
                {otpLoading
                  ? <><Loader2 size={16} className="animate-spin me-2" />{ar ? 'جاري التحقق...' : 'Verifying...'}</>
                  : (ar ? 'تحقق وأنشئ الحساب ✓' : 'Verify & Create Account ✓')
                }
              </Button>

              <button
                onClick={async () => {
                  const result = await sendPhoneOTP(fullPhone());
                  setVerificationId(result.verificationId);
                  setOtpCode('');
                  toast.success(ar ? 'تم إعادة إرسال الرمز' : 'Code resent');
                }}
                className="w-full text-center text-xs text-primary font-bold mt-3"
              >
                {ar ? 'إعادة إرسال الرمز' : 'Resend code'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
