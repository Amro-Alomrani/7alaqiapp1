import { useState } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { styleMoods } from '@/data/styleIdeas';
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

export default function StyleMatchPage() {
  const navigate = useNavigate();
  const [selectedMood, setSelectedMood] = useState<StyleMood | null>(null);
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';

  return (
    <div className="min-h-screen pb-28 overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="px-5 pt-14 pb-5">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={18} className="text-primary" />
          <span className="text-xs text-primary font-bold uppercase tracking-wider">
            {ar ? 'أفكار للستايل' : 'Style ideas'}
          </span>
        </div>
        <h1 className="text-2xl font-black text-foreground leading-tight">
          {ar ? 'أي ستايل\nيعجبك اليوم؟' : 'Find a style\nfor today'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {ar ? 'اختر مزاجًا لعرض أفكار قصّات عامة. هذه الأفكار لا تطابقك تلقائيًا مع حلاق.' : 'Choose a mood for general haircut inspiration. These ideas do not match you to a barber.'}
        </p>
      </div>

      <div className="px-5">
        <div className="grid grid-cols-2 gap-3 mb-6">
          {styleMoods.map(mood => {
            return (
              <MoodCard
                key={mood.id}
                mood={mood}
                selected={selectedMood?.id === mood.id}
                onSelect={() => setSelectedMood(selectedMood?.id === mood.id ? null : mood)}
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
                  {ar ? <>أفكار تناسب مزاج <span className="text-primary">{selectedMood.label}</span></> : <>Ideas for <span className="text-primary">{selectedMood.label}</span></>}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {ar
                    ? 'هذه أمثلة إلهامية فقط. تحقق من خدمات كل حلاق قبل الحجز.'
                    : 'General inspiration only. Check each barber’s listed services before booking.'}
                </p>
              </div>
            </div>

            <h2 className="text-base font-bold text-foreground mb-3">
              {ar ? 'قصّات مقترحة' : 'Style ideas'}
            </h2>
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-sm font-bold text-foreground mb-3">
                {ar ? 'أسماء قصّات للاستلهام' : 'For inspiration'}
              </p>
              <div className="flex gap-2 flex-wrap">
                {selectedMood.styles.map(s => (
                  <span key={s} className="bg-secondary text-foreground text-sm px-3 py-1.5 rounded-xl font-medium">
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <Button className="w-full mt-4" onClick={() => navigate('/explore')}>
              {ar ? 'استكشف الحلاقين والخدمات المسجلة' : 'Browse barbers and listed services'}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {!selectedMood && (
        <div className="px-5 text-center py-4">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <ArrowRight size={16} />
            <p className="text-sm">
              {ar ? 'اختر مزاجًا لعرض أفكار قصّات عامة' : 'Choose a mood to see general haircut ideas'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
