import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, ChevronLeft, Globe, Mail, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { loginEmail, resetPassword } from '@/lib/auth-providers';
import { mapAuthError } from './LoginPage';

export default function BarberLoginPage() {
  const navigate = useNavigate();
  const { loginBarber } = useAuth();
  const { language, setLanguage, t } = useLanguage();
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
      const { getUser, getBarber, createBarberProfile } = await import('@/lib/db');

      const profile = await getUser(user.uid).catch(() => null);
      if (profile?.role === 'customer') {
        const { signOutAll } = await import('@/lib/auth-providers');
        await signOutAll().catch(() => {});
        toast.error(ar
          ? 'هذا الحساب مسجّل كزبون. استخدم صفحة دخول الزبائن.'
          : 'This account is registered as a customer. Use the customer login page.');
        return;
      }

      let barberDoc = await getBarber(user.uid).catch(() => null);
      if (!barberDoc) {
        barberDoc = await createBarberProfile(user.uid, {
          name: user.name || email.split('@')[0],
          shopName: `${user.name || email.split('@')[0]}'s Shop`,
          avatar: user.avatar || `https://i.pravatar.cc/150?u=${encodeURIComponent(email)}`,
        });
      }
      loginBarber(user.email || email, user.uid, barberDoc.name || user.name, barberDoc.shopName);
      toast.success(ar ? `أهلاً ${barberDoc.name || user.name || ''} ✂️` : `Welcome, ${barberDoc.name || user.name || ''} ✂️`);
      navigate((barberDoc as any).onboardingComplete ? '/barber' : '/barber/onboarding');
    } catch (e: any) {
      toast.error(mapAuthError(e?.code, ar));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email.trim()) {
      toast.error(ar ? 'أدخل بريدك أولاً' : 'Enter your email first');
      return;
    }
    try {
      await resetPassword(email.trim());
      toast.success(ar ? '📧 تم إرسال رابط استعادة كلمة المرور' : '📧 Reset link sent');
    } catch (e: any) {
      toast.error(mapAuthError(e?.code, ar));
    }
  };

  const bl = t.barberLogin;

  return (
    <div className="min-h-screen flex flex-col px-6 justify-center bg-background relative overflow-hidden" dir={ar ? 'rtl' : 'ltr'}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[280px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(ellipse, hsl(38 92% 52%) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 right-0 w-56 h-56 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, hsl(38 92% 52%) 0%, transparent 70%)' }} />
        <svg className="absolute bottom-0 left-0 w-full opacity-5" viewBox="0 0 400 200" preserveAspectRatio="none">
          <path d="M0,80 C80,180 320,0 400,80 L400,200 L0,200 Z" fill="hsl(38 92% 52%)" />
        </svg>
      </div>
      <button
        onClick={() => navigate('/select-role')}
        className={`absolute top-14 ${ar ? 'right-5' : 'left-5'} flex items-center gap-1 text-muted-foreground`}
      >
        <ChevronLeft size={18} className={ar ? 'rotate-180' : ''} /><span className="text-sm">{bl.customerLink}</span>
      </button>

      <div className={`absolute top-14 ${ar ? 'left-5' : 'right-5'}`}>
        <button
          onClick={() => setLanguage(ar ? 'en' : 'ar')}
          className="flex items-center gap-1.5 bg-card border border-border rounded-xl px-3 py-2 text-sm font-bold text-foreground"
        >
          <Globe size={13} className="text-primary" />
          {ar ? 'EN' : 'عربي'}
        </button>
      </div>

      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center mb-10">
        <img src="/logo.png" alt="HALAQI" className="w-20 h-20 object-contain mb-1 drop-shadow-xl" />
        <h1 className="text-2xl font-black text-foreground">{bl.title}</h1>
        <p className="text-muted-foreground text-sm mt-1">{bl.subtitle}</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="space-y-4">
        <div>
          <h2 className="text-xl font-black text-foreground mb-1">{bl.heading}</h2>
          <p className="text-sm text-muted-foreground">{bl.subheading}</p>
        </div>

        <div className="bg-card border-2 border-border rounded-2xl px-4 py-4 focus-within:border-primary transition-colors">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-semibold">{bl.emailLabel}</p>
          <div className="flex items-center gap-2" dir="ltr">
            <Mail size={15} className="text-muted-foreground" />
            <input
              type="email"
              placeholder="ahmed@barbershop.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              className="bg-transparent text-foreground text-base placeholder:text-muted-foreground w-full outline-none"
            />
          </div>
        </div>
        <div className="bg-card border-2 border-border rounded-2xl px-4 py-4 focus-within:border-primary transition-colors">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-semibold">{bl.passwordLabel}</p>
          <div className="flex items-center gap-2" dir="ltr">
            <Lock size={15} className="text-muted-foreground" />
            <input
              type={showPw ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              autoComplete="current-password"
              className="bg-transparent text-foreground text-base placeholder:text-muted-foreground flex-1 outline-none"
            />
            <button onClick={() => setShowPw(!showPw)} type="button">
              {showPw ? <EyeOff size={16} className="text-muted-foreground" /> : <Eye size={16} className="text-muted-foreground" />}
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={handleReset} className="text-xs text-primary font-semibold">
            {ar ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
          </button>
        </div>

        <Button onClick={handleLogin} disabled={loading}
          className="w-full h-14 text-base font-bold rounded-2xl bg-primary text-primary-foreground mt-2">
          {loading ? bl.signingIn : bl.signIn}
        </Button>

        <p className="text-center text-xs text-muted-foreground pt-2">
          {ar ? 'حلاق جديد؟' : 'New barber?'}{' '}
          <button onClick={() => navigate('/register')} className="text-primary font-bold">
            {ar ? 'سجّل حسابك الآن' : 'Create your account'}
          </button>
        </p>

      </motion.div>
    </div>
  );
}
