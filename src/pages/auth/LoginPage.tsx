import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, ArrowRight, ChevronLeft, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { loginEmail, resetPassword } from '@/lib/auth-providers';

export default function LoginPage() {
  const navigate = useNavigate();
  const { loginCustomer, loginBarber } = useAuth();
  const { language, setLanguage, isRTL } = useLanguage();
  const ar = language === 'ar';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || password.length < 6) {
      toast.error(ar ? 'أدخل البريد وكلمة مرور 6 أحرف على الأقل' : 'Enter email and 6+ char password');
      return;
    }
    setLoading(true);
    try {
      const user = await loginEmail(email.trim(), password);
      const { getUser } = await import('@/lib/db');
      const profile = await getUser(user.uid).catch(() => null);
      const role = profile?.role;
      if (role === 'barber') {
        const { getBarber } = await import('@/lib/db');
        const barberDoc = await getBarber(user.uid).catch(() => null);
        loginBarber(user.email || email.trim(), user.uid, barberDoc?.name || user.name, barberDoc?.shopName);
        toast.success(ar ? `أهلاً ${user.name || ''} ✂️` : `Welcome, ${user.name || ''} ✂️`);
        navigate('/barber');
      } else {
        loginCustomer(user.phone || '', user.name, user.uid);
        toast.success(ar ? `أهلاً ${user.name || ''} 👋` : `Welcome, ${user.name || ''} 👋`);
        navigate('/');
      }
    } catch (e: any) {
      toast.error(mapAuthError(e?.code || e?.message, ar));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email.trim()) {
      toast.error(ar ? 'أدخل بريدك الإلكتروني أولاً' : 'Enter your email first');
      return;
    }
    try {
      await resetPassword(email.trim());
      toast.success(ar ? '📧 تم إرسال رابط إعادة تعيين كلمة المرور' : '📧 Password reset link sent');
    } catch (e: any) {
      toast.error(mapAuthError(e?.code, ar));
    }
  };

  return (
    <div className="min-h-screen flex flex-col px-6 justify-center bg-background relative overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(ellipse, hsl(38 92% 52%) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, hsl(38 92% 52%) 0%, transparent 70%)' }} />
        <svg className="absolute bottom-0 left-0 w-full opacity-5" viewBox="0 0 400 200" preserveAspectRatio="none">
          <path d="M0,100 C100,0 300,200 400,100 L400,200 L0,200 Z" fill="hsl(38 92% 52%)" />
        </svg>
      </div>
      <button
        onClick={() => navigate('/select-role')}
        className={`absolute top-14 ${isRTL ? 'right-5' : 'left-5'} flex items-center gap-1 text-muted-foreground z-10`}
      >
        <ChevronLeft size={16} className={isRTL ? 'rotate-180' : ''} />
        <span className="text-sm">{ar ? 'رجوع' : 'Back'}</span>
      </button>

      <div className={`absolute top-14 ${isRTL ? 'left-5' : 'right-5'} z-10`}>
        <button
          onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
          className="flex items-center gap-1.5 bg-card border border-border rounded-xl px-3 py-2 text-sm font-bold text-foreground"
        >
          <Globe size={13} className="text-primary" />
          {language === 'en' ? 'عربي' : 'EN'}
        </button>
      </div>

      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center mb-10">
        <img src="/logo.png" alt="HALAQI" className="w-24 h-24 object-contain mb-2 drop-shadow-xl" />
        <p className="text-muted-foreground text-sm mt-1">
          {ar ? 'سجّل دخولك للحجز ومتابعة حلاقك' : 'Sign in to book & follow your barbers'}
        </p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <div className="bg-card border-2 border-border rounded-2xl px-4 py-3 focus-within:border-primary transition-colors">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-semibold">
            {ar ? 'البريد الإلكتروني' : 'Email'}
          </p>
          <div className="flex items-center gap-2">
            <Mail size={15} className="text-muted-foreground" />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="bg-transparent text-foreground text-base placeholder:text-muted-foreground flex-1 outline-none"
              dir="ltr"
            />
          </div>
        </div>

        <div className="bg-card border-2 border-border rounded-2xl px-4 py-3 focus-within:border-primary transition-colors">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-semibold">
            {ar ? 'كلمة المرور' : 'Password'}
          </p>
          <div className="flex items-center gap-2">
            <Lock size={15} className="text-muted-foreground" />
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="••••••••"
              autoComplete="current-password"
              className="bg-transparent text-foreground text-base placeholder:text-muted-foreground flex-1 outline-none"
              dir="ltr"
            />
            <button onClick={() => setShowPw(s => !s)} type="button">
              {showPw ? <EyeOff size={16} className="text-muted-foreground" /> : <Eye size={16} className="text-muted-foreground" />}
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={handleReset} className="text-xs text-primary font-semibold">
            {ar ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
          </button>
        </div>

        <Button
          onClick={handleLogin}
          disabled={loading}
          className="w-full h-14 text-base font-bold rounded-2xl bg-primary text-primary-foreground gap-2"
        >
          {loading
            ? (ar ? 'جاري تسجيل الدخول...' : 'Signing in...')
            : <><span>{ar ? 'تسجيل الدخول' : 'Sign in'}</span><ArrowRight size={18} className={isRTL ? 'rotate-180' : ''} /></>}
        </Button>

        <p className="text-center text-sm text-muted-foreground pt-3">
          {ar ? 'ما عندك حساب؟' : "Don't have an account?"}{' '}
          <button onClick={() => navigate('/register')} className="text-primary font-bold">
            {ar ? 'سجّل الآن' : 'Sign up'}
          </button>
        </p>
        <p className="text-center text-xs text-muted-foreground">
          {ar ? 'هل أنت حلاق؟' : 'Are you a barber?'}{' '}
          <button onClick={() => navigate('/barber/login')} className="text-primary font-bold">
            {ar ? 'بوابة الحلاقين →' : 'Barber portal →'}
          </button>
        </p>

      </motion.div>
    </div>
  );
}

export function mapAuthError(code: string | undefined, ar: boolean): string {
  switch (code) {
    case 'auth/invalid-email':
      return ar ? 'بريد إلكتروني غير صالح' : 'Invalid email';
    case 'auth/user-not-found':
      return ar ? 'لا يوجد حساب بهذا البريد' : 'No account with this email';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return ar ? 'بريد أو كلمة مرور خاطئة' : 'Wrong email or password';
    case 'auth/email-already-in-use':
      return ar ? 'البريد مسجَّل مسبقاً' : 'Email already in use';
    case 'auth/weak-password':
      return ar ? 'كلمة المرور ضعيفة (6 أحرف على الأقل)' : 'Weak password (min 6 chars)';
    case 'auth/network-request-failed':
      return ar ? 'تعذّر الاتصال بالإنترنت' : 'Network error';
    case 'auth/too-many-requests':
      return ar ? 'محاولات كثيرة، انتظر قليلاً' : 'Too many attempts, try later';
    default:
      return ar ? `حدث خطأ: ${code || ''}` : `Error: ${code || 'unknown'}`;
  }
}
