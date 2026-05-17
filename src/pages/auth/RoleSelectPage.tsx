import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Scissors, User, Globe, ArrowRight } from 'lucide-react';

function RoleLogoBlock() {
  return (
    <div className="relative mb-2 flex items-center justify-center">
      <img src="/logo.png" alt="HALAQI" className="w-24 h-24 object-contain drop-shadow-xl" />
    </div>
  );
}
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';

export default function RoleSelectPage() {
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const { isCustomerLoggedIn, isBarberLoggedIn, customer, barberUser } = useAuth();
  const ar = language === 'ar';

  return (
    <div className="min-h-screen bg-background flex flex-col px-6 justify-center relative overflow-hidden" dir={ar ? 'rtl' : 'ltr'}>
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full opacity-10 pointer-events-none"
        style={{ background: 'radial-gradient(circle, hsl(38 92% 52%) 0%, transparent 70%)' }} />

      <div className={`absolute top-14 ${ar ? 'left-5' : 'right-5'} z-10`}>
        <button
          onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
          className="flex items-center gap-1.5 bg-card border border-border rounded-xl px-3 py-2 text-sm font-bold"
        >
          <Globe size={13} className="text-primary" />
          {language === 'en' ? 'عربي' : 'EN'}
        </button>
      </div>

      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center mb-10 relative z-10">
        <RoleLogoBlock />
        <p className="text-xs text-muted-foreground mt-1 font-bold tracking-wide">
          {ar ? 'حلاقك... بضغطة' : 'Your barber, one tap away'}
        </p>
      </motion.div>

      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
        className="text-center text-sm font-bold text-muted-foreground mb-5 relative z-10">
        {ar ? 'ادخل كـ...' : 'Continue as...'}
      </motion.p>

      <div className="flex flex-col gap-4 relative z-10">
        <motion.button
          initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate(isCustomerLoggedIn ? '/' : '/login')}
          className="group bg-card border-2 border-border rounded-3xl p-5 flex items-center gap-4 text-start hover:border-primary/40 transition-all"
        >
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center flex-shrink-0">
            <User size={26} className="text-primary" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-black text-foreground">{ar ? 'زبون' : 'Customer'}</p>
            {isCustomerLoggedIn && customer ? (
              <p className="text-xs text-primary font-bold mt-0.5 truncate">
                {ar ? `متابعة كـ ${customer.name}` : `Continue as ${customer.name}`}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5">{ar ? 'احجز واكتشف حلاقين' : 'Book & discover barbers'}</p>
            )}
          </div>
          <ArrowRight size={18} className={`text-muted-foreground group-hover:text-primary transition ${ar ? 'rotate-180' : ''}`} />
        </motion.button>

        <motion.button
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate(isBarberLoggedIn ? '/barber' : '/barber/login')}
          className="group bg-primary/5 border-2 border-primary/25 rounded-3xl p-5 flex items-center gap-4 text-start hover:border-primary/60 hover:bg-primary/10 transition-all"
        >
          <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md">
            <Scissors size={26} className="text-primary-foreground" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-black text-foreground">{ar ? 'حلاق / صالون' : 'Barber / Salon'}</p>
            {isBarberLoggedIn && barberUser ? (
              <p className="text-xs text-primary font-bold mt-0.5 truncate">
                {ar ? `متابعة كـ ${barberUser.shopName}` : `Continue as ${barberUser.shopName}`}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5">{ar ? 'أدر صالونك بكل سهولة' : 'Manage your salon easily'}</p>
            )}
          </div>
          <ArrowRight size={18} className={`text-primary transition ${ar ? 'rotate-180' : ''}`} />
        </motion.button>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
        className="text-center mt-8 relative z-10">
        <p className="text-xs text-muted-foreground">
          {ar ? 'مسجل لأول مرة؟' : 'New here?'}{' '}
          <button onClick={() => navigate('/register')} className="text-primary font-bold">
            {ar ? 'إنشاء حساب جديد' : 'Create account'}
          </button>
        </p>
      </motion.div>
    </div>
  );
}
