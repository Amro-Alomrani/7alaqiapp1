import { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBarbers } from '@/contexts/DataContext';
import BarberCard from '@/components/BarberCard';
import { useLanguage } from '@/contexts/LanguageContext';

type Filter = 'all' | 'available' | 'top-rated' | 'nearest' | 'cheap';

export default function ExplorePage() {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<Filter>('all');
  const barbers = useBarbers();
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';

  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: ar ? 'الكل' : 'All' },
    { id: 'available', label: ar ? 'مفتوح الآن' : 'Open Now' },
    { id: 'top-rated', label: ar ? 'الأعلى تقييماً' : 'Top Rated' },
    { id: 'nearest', label: ar ? 'الأقرب' : 'Nearest' },
    { id: 'cheap', label: ar ? 'الأرخص' : 'Budget' },
  ];

  const filtered = useMemo(() => {
    let list = [...barbers];
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(b =>
        (b.name || '').toLowerCase().includes(q) ||
        (b.shopName || '').toLowerCase().includes(q) ||
        (b.specialties || []).some(s => s.toLowerCase().includes(q))
      );
    }
    if (activeFilter === 'available') list = list.filter(b => b.available);
    if (activeFilter === 'top-rated') list = list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    if (activeFilter === 'nearest') list = list.sort((a, b) => parseFloat(a.distance || '0') - parseFloat(b.distance || '0'));
    if (activeFilter === 'cheap') list = list.sort((a, b) => (a.services?.[0]?.price || 0) - (b.services?.[0]?.price || 0));
    return list;
  }, [query, activeFilter, barbers]);

  return (
    <div className="flex flex-col min-h-screen pb-28" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="px-5 pt-14 pb-4 sticky top-0 bg-background/95 backdrop-blur-sm z-10">
        <h1 className="text-xl font-bold mb-4">{ar ? 'ابحث عن حلاق' : 'Find a Barber'}</h1>
        <div className="flex items-center gap-3 bg-card border border-border rounded-2xl px-4 py-3">
          <Search size={18} className="text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            placeholder={ar ? 'ابحث عن حلاق أو ستايل...' : 'Search barbers, styles, shops...'}
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground flex-1 outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')}>
              <X size={16} className="text-muted-foreground" />
            </button>
          )}
        </div>
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {filters.map(f => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeFilter === f.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border border-border text-muted-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5">
        <p className="text-xs text-muted-foreground mb-3 font-medium">
          {ar ? `${filtered.length} حلاق` : `${filtered.length} barbers found`}
        </p>
        <div className="flex flex-col gap-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((b, i) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.04 }}
              >
                <BarberCard barber={b} variant="full" />
              </motion.div>
            ))}
          </AnimatePresence>
          {filtered.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-4xl mb-3">💈</p>
              <p className="font-semibold">{ar ? 'لا يوجد حلاقون' : 'No barbers found'}</p>
              <p className="text-sm mt-1">{ar ? 'جرّب بحثاً آخر' : 'Try a different search'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
