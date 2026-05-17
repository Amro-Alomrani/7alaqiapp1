import { Scissors, Home, QrCode, Navigation } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';

export default function QuickActions() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const actions = [
    { label: t.home.quickActions.quickBook, icon: Scissors,   color: 'bg-primary text-primary-foreground',     path: '/explore' },
    { label: t.home.quickActions.walkIn,    icon: Navigation, color: 'bg-secondary text-secondary-foreground', path: '/map' },
    { label: t.home.quickActions.homeService, icon: Home,     color: 'bg-secondary text-secondary-foreground', path: '/home-service' },
    { label: 'QR',                           icon: QrCode,    color: 'bg-secondary text-secondary-foreground', path: '/qr-scan' },
  ];

  return (
    <div className="px-5">
      <div className="grid grid-cols-4 gap-2">
        {actions.map(({ label, icon: Icon, color, path }, i) => (
          <motion.button
            key={label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => navigate(path)}
            className="flex flex-col items-center gap-2"
          >
            <div className={`w-14 h-14 rounded-2xl ${color} flex items-center justify-center shadow-sm`}>
              <Icon size={22} strokeWidth={1.8} />
            </div>
            <span className="text-[11px] font-medium text-muted-foreground text-center leading-tight">{label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
