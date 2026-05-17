import { useState } from 'react';
import { Sparkles, Zap, ArrowRight, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { styleMoods } from '@/data/mockData';
import { useBarbers } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { StyleMood } from '@/types';
import { Button } from '@/components/ui/button';

function MoodCard({ mood, selected, onSelect }: { mood: StyleMood; selected: boolean; onSelect: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onSelect}
      className={`relative rounded-2xl p-4 text-left transition-all border-2 overflow-hidden ${
        selected ? 'border-primary bg-primary/10' : 'border-border bg-card'
      }`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${mood.gradient} opacity-60`} />
      <div className="relative z-10">
        <span className="text-3xl block mb-2">{mood.emoji}</span>
        <p className="font-bold text-foreground text-sm leading-tight">{mood.label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{mood.description}</p>
      </div>
      {selected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center"
        >
          <span className="text-primary-foreground text-[10px] font-black">✓</span>
        </motion.div>
      )}
    </motion.button>
  );
}

function MatchedBarberCard({ barberId, styles, ar }: { barberId: string; styles: string[]; ar: boolean }) {
  const navigate = useNavigate();
  const allBarbers = useBarbers();
  const barber = allBarbers.find(b => b.id === barberId);
  if (!barber) return null;
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-card border border-border rounded-2xl overflow-hidden"
    >
      <div className="relative h-32">
        <img src={barber.coverImage} alt={barber.shopName} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
        <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between">
          <div>
            <p className="font-bold text-foreground text-sm">{barber.shopName}</p>
            <div className="flex items-center gap-1">
              <Star size={10} className="text-primary fill-primary" />
              <span className="text-xs text-foreground font-medium">{barber.rating}</span>
              <span className="text-xs text-muted-foreground">· {barber.distance}</span>
            </div>
          </div>
          <img src={barber.avatar} alt={barber.name} className="w-9 h-9 rounded-xl object-cover border-2 border-primary" />
        </div>
      </div>
      <div className="px-3 py-2.5">
        <div className="flex gap-1 flex-wrap mb-2.5">
          {styles.slice(0, 3).map(s => (
            <span key={s} className="text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{s}</span>
          ))}
        </div>
        <Button
          size="sm"
          className="w-full h-8 rounded-xl bg-primary text-primary-foreground font-bold text-xs gap-1"
          onClick={() => navigate(`/book/${barber.id}`)}
        >
          <Zap size={12} /> {ar ? 'احجز هذا الستايل' : 'Book This Style'}
        </Button>
      </div>
    </motion.div>
  );
}

export default function StyleMatchPage() {
  const [selectedMood, setSelectedMood] = useState<StyleMood | null>(null);
  const allBarbers = useBarbers();
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';

  return (
    <div className="min-h-screen pb-28 overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="px-5 pt-14 pb-5">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={18} className="text-primary" />
          <span className="text-xs text-primary font-bold uppercase tracking-wider">
            {ar ? 'DNA الستايل' : 'Style DNA'}
          </span>
        </div>
        <h1 className="text-2xl font-black text-foreground leading-tight">
          {ar ? 'ما هو ستايلك\nاليوم؟' : "What's Your\nVibe Today?"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {ar ? 'الذكاء الاصطناعي يختار الحلاق الأنسب لمزاجك' : 'AI matches the perfect barber for your mood'}
        </p>
      </div>

      <div className="px-5">
        <div className="grid grid-cols-2 gap-3 mb-6">
          {styleMoods.map(mood => {
            const moodWithBarbers = {
              ...mood,
              barberIds: mood.barberIds.length > 0 ? mood.barberIds : allBarbers.slice(0, 2).map((b) => b.id)
            };
            return (
              <MoodCard
                key={moodWithBarbers.id}
                mood={moodWithBarbers}
                selected={selectedMood?.id === moodWithBarbers.id}
                onSelect={() => setSelectedMood(selectedMood?.id === moodWithBarbers.id ? null : moodWithBarbers)}
              />
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {selectedMood && (
          <motion.div
            key={selectedMood.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="px-5"
          >
            <div className="bg-primary/10 border border-primary/25 rounded-2xl px-4 py-3 mb-4 flex items-center gap-3">
              <span className="text-2xl">{selectedMood.emoji}</span>
              <div>
                <p className="text-sm font-bold text-foreground">
                  {ar
                    ? <>أفضل تطابق لـ <span className="text-primary">{selectedMood.label}</span></>
                    : <>Best matches for <span className="text-primary">{selectedMood.label}</span></>}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {ar
                    ? `الذكاء الاصطناعي اختار ${selectedMood.barberIds.length} حلاقين لمزاجك`
                    : `AI selected ${selectedMood.barberIds.length} barbers for your vibe`}
                </p>
              </div>
            </div>

            <h2 className="text-base font-bold text-foreground mb-3">
              {ar ? 'الحلاقون المقترحون' : 'Matched Barbers'}
            </h2>
            <div className="flex flex-col gap-3 mb-5">
              {selectedMood.barberIds.map((id, i) => (
                <motion.div key={id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                  <MatchedBarberCard barberId={id} styles={selectedMood.styles} ar={ar} />
                </motion.div>
              ))}
            </div>

            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-sm font-bold text-foreground mb-3">
                {ar ? 'القصات الموصى بها' : 'Recommended Styles'}
              </p>
              <div className="flex gap-2 flex-wrap">
                {selectedMood.styles.map(s => (
                  <span key={s} className="bg-secondary text-foreground text-sm px-3 py-1.5 rounded-xl font-medium">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!selectedMood && (
        <div className="px-5 text-center py-4">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <ArrowRight size={16} />
            <p className="text-sm">
              {ar ? 'اختر مزاجك للحصول على توصيات الذكاء الاصطناعي' : 'Pick a mood above to get AI recommendations'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
