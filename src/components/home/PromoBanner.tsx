import { motion } from 'framer-motion';
import { Tag } from 'lucide-react';

export default function PromoBanner() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="mx-5 rounded-2xl overflow-hidden relative"
      style={{ background: 'linear-gradient(135deg, hsl(38 92% 52% / 1) 0%, hsl(30 90% 42% / 1) 100%)' }}
    >
      <div className="px-5 py-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Tag size={13} className="text-primary-foreground/80" />
            <span className="text-xs font-semibold text-primary-foreground/80 uppercase tracking-wider">Limited Offer</span>
          </div>
          <p className="text-primary-foreground font-bold text-lg leading-tight">20% Off</p>
          <p className="text-primary-foreground/80 text-sm">Your first home service</p>
        </div>
        <div className="text-right">
          <div className="bg-primary-foreground/20 rounded-xl px-3 py-1.5">
            <p className="text-primary-foreground font-black text-2xl">💈</p>
          </div>
          <p className="text-primary-foreground/70 text-[10px] mt-1">Use: FIRST20</p>
        </div>
      </div>
      <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white/10" />
      <div className="absolute -right-2 -bottom-6 w-16 h-16 rounded-full bg-white/10" />
    </motion.div>
  );
}
