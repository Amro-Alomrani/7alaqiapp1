import { LayoutDashboard, CalendarDays, Users, Scissors, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';

export default function BarberBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const navItems = [
    { path: '/barber',          icon: LayoutDashboard, label: t.nav.dashboard },
    { path: '/barber/bookings', icon: CalendarDays,    label: t.nav.bookings },
    { path: '/barber/queue',    icon: Users,           label: t.nav.queue },
    { path: '/barber/services', icon: Scissors,        label: t.nav.services },
    { path: '/barber/profile',  icon: User,            label: t.nav.profile },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none">
      <div className="w-full max-w-sm pointer-events-auto">
        <div className="mx-3 mb-3 bg-card/95 backdrop-blur-sm border border-border rounded-2xl px-2 shadow-xl">
          <div className="flex items-center justify-around py-2">
            {navItems.map(({ path, icon: Icon, label }) => {
              const active = location.pathname === path;
              return (
                <button key={path} onClick={() => navigate(path)} className="flex flex-col items-center gap-1 px-3 py-2 relative flex-1">
                  {active && (
                    <motion.div layoutId="barberNavPill" className="absolute inset-0 bg-primary/10 rounded-xl"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                  )}
                  <Icon size={20} className={`relative z-10 transition-colors ${active ? 'text-primary' : 'text-muted-foreground'}`}
                    strokeWidth={active ? 2.5 : 1.8} />
                  <span className={`text-[10px] font-medium relative z-10 transition-colors ${active ? 'text-primary' : 'text-muted-foreground'}`}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
