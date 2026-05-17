import { motion } from 'framer-motion';
import { Users, Clock } from 'lucide-react';

type CrowdLevel = 'low' | 'medium' | 'busy';

const config: Record<CrowdLevel, {
  label: string; sublabel: string;
  wrapperClass: string; dotActive: string; textClass: string; dotCount: number;
}> = {
  low:    { label: 'Low Crowd',   sublabel: 'Great time to visit', wrapperClass: 'bg-card border-border',           dotActive: 'bg-foreground/30', textClass: 'text-foreground',   dotCount: 2 },
  medium: { label: 'Moderate',    sublabel: 'Some wait expected',  wrapperClass: 'bg-primary/10 border-primary/20', dotActive: 'bg-primary',       textClass: 'text-primary',     dotCount: 4 },
  busy:   { label: 'Very Busy',   sublabel: 'Long wait ahead',     wrapperClass: 'bg-destructive/10 border-destructive/20', dotActive: 'bg-destructive', textClass: 'text-destructive', dotCount: 6 },
};

export default function CrowdIndicator({ level, waitTime }: { level: CrowdLevel; waitTime: number }) {
  const c = config[level];
  return (
    <div className={`flex items-center justify-between px-4 py-3.5 rounded-2xl border ${c.wrapperClass}`}>
      <div className="flex items-center gap-3">
        <div className="flex gap-1 items-end">
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ height: 8 }}
              animate={{
                height: i < c.dotCount ? 8 + i * 2 : 8,
                opacity: i < c.dotCount ? 1 : 0.2,
              }}
              transition={{ delay: i * 0.05 }}
              className={`w-2 rounded-full ${i < c.dotCount ? c.dotActive : 'bg-border'}`}
            />
          ))}
        </div>
        <div>
          <p className={`text-sm font-bold ${c.textClass}`}>{c.label}</p>
          <p className="text-xs text-muted-foreground">{c.sublabel}</p>
        </div>
      </div>
      <div className={`flex items-center gap-1.5 text-xs font-semibold ${c.textClass}`}>
        <Clock size={13} />
        ~{waitTime} min
      </div>
    </div>
  );
}
