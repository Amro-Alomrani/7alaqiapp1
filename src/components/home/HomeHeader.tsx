import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { subscribeNotifications } from '@/lib/db';

export default function HomeHeader() {
  const navigate = useNavigate();
  const { customer } = useAuth();
  const { language } = useLanguage();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!customer?.uid) return;
    const unsub = subscribeNotifications(customer.uid, items => {
      setUnread(items.filter(n => !n.read).length);
    });
    return () => unsub();
  }, [customer?.uid]);

  const ar = language === 'ar';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? (ar ? 'صباح الخير' : 'Good morning') : hour < 17 ? (ar ? 'مساء الخير' : 'Good afternoon') : (ar ? 'مساء الخير' : 'Good evening');
  const userName = customer?.name?.split(' ')[0] || (ar ? 'مستخدم' : 'User');
  const userAvatar = customer?.avatar || '/logo.png';

  return (
    <div className="flex items-center justify-between px-5 pt-14 pb-3">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,hsl(38 92% 52%),hsl(28 90% 36%))' }}>
          <span className="text-lg font-black text-white">✂</span>
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium">{greeting} 👋</p>
          <h1 className="text-xl font-bold text-foreground leading-tight">{userName}</h1>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/notifications')}
          className="relative w-10 h-10 bg-card border border-border rounded-full flex items-center justify-center"
          style={{ touchAction: 'manipulation' }}
        >
          <Bell size={18} className="text-foreground" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-primary text-white text-[10px] font-black rounded-full flex items-center justify-center px-1">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
        <button
          onClick={() => navigate('/profile')}
          className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary"
          style={{ touchAction: 'manipulation' }}
        >
          <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
        </button>
      </div>
    </div>
  );
}
