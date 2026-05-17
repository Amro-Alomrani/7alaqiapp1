import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Power, Coffee, Clock, Scissors, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import {
  setBarberStatus,
  clearBarberStatus,
  getBarberStatusOverride,
  type BarberStatus,
} from '@/lib/barberStatus';

const OPTIONS: {
  value: BarberStatus;
  label: string;
  desc: string;
  icon: typeof Power;
  color: string;
  bg: string;
  border: string;
}[] = [
  { value: 'available',     label: 'Open',           desc: 'Walk-ins welcome',          icon: Scissors, color: 'text-green-400',     bg: 'bg-green-500/10',     border: 'border-green-500/30' },
  { value: 'finishing_soon', label: 'Finishing Soon', desc: 'Wrapping up current cut',   icon: Clock,    color: 'text-primary',       bg: 'bg-primary/10',       border: 'border-primary/30' },
  { value: 'busy',          label: 'Busy',           desc: 'In service · long wait',    icon: Coffee,   color: 'text-orange-400',    bg: 'bg-orange-500/10',    border: 'border-orange-500/30' },
  { value: 'closed',        label: 'Closed',         desc: 'Shop is offline',           icon: Power,    color: 'text-destructive',   bg: 'bg-destructive/10',   border: 'border-destructive/30' },
];

interface Props {
  barberId: string;
  defaultStatus?: BarberStatus;
}

export default function BarberStatusControl({ barberId, defaultStatus = 'available' }: Props) {
  const [open, setOpen] = useState(false);
  const [eta, setEta] = useState<number | undefined>(undefined);
  const [activity, setActivity] = useState<string>('');
  const [status, setStatusState] = useState<BarberStatus>(() => {
    const o = getBarberStatusOverride(barberId);
    return o?.status || defaultStatus;
  });

  useEffect(() => {
    const o = getBarberStatusOverride(barberId);
    if (o) {
      setStatusState(o.status);
      setEta(o.liveEta);
      setActivity(o.liveActivity || '');
    }
  }, [barberId]);

  const current = OPTIONS.find(o => o.value === status) || OPTIONS[0];

  const apply = (next: BarberStatus) => {
    setStatusState(next);
    setBarberStatus(barberId, next, {
      liveEta: next === 'finishing_soon' || next === 'busy' ? eta : undefined,
      liveActivity: next === 'finishing_soon' || next === 'busy' ? activity || undefined : undefined,
    });
    const opt = OPTIONS.find(o => o.value === next)!;
    toast.success(`Status updated: ${opt.label}`, { description: opt.desc });
    setOpen(false);
  };

  const reset = () => {
    clearBarberStatus(barberId);
    setStatusState(defaultStatus);
    setEta(undefined);
    setActivity('');
    toast('Reset to default status');
  };

  const Icon = current.icon;

  return (
    <div className={`bg-card border ${current.border} rounded-2xl overflow-hidden`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full p-4 flex items-center gap-3"
      >
        <div className={`w-11 h-11 ${current.bg} rounded-xl flex items-center justify-center`}>
          <Icon size={20} className={current.color} />
        </div>
        <div className="flex-1 text-left">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">My Status</p>
          <p className={`text-sm font-black ${current.color}`}>{current.label}</p>
          {(status === 'finishing_soon' || status === 'busy') && (eta || activity) && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {activity && `${activity}`}{activity && eta ? ' · ' : ''}{eta ? `~${eta}m` : ''}
            </p>
          )}
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }}>
          <ChevronDown size={18} className="text-muted-foreground" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border"
          >
            <div className="p-3 space-y-2">
              {OPTIONS.map(opt => {
                const OptIcon = opt.icon;
                const active = opt.value === status;
                return (
                  <button
                    key={opt.value}
                    onClick={() => apply(opt.value)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                      active ? `${opt.bg} ${opt.border}` : 'bg-secondary/40 border-transparent hover:bg-secondary'
                    }`}
                  >
                    <div className={`w-9 h-9 ${opt.bg} rounded-lg flex items-center justify-center`}>
                      <OptIcon size={16} className={opt.color} />
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-bold ${active ? opt.color : 'text-foreground'}`}>{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </div>
                    {active && <div className={`w-2 h-2 rounded-full ${opt.color.replace('text-', 'bg-')}`} />}
                  </button>
                );
              })}

              {(status === 'finishing_soon' || status === 'busy') && (
                <div className="pt-2 grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">ETA (min)</label>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={eta ?? ''}
                      onChange={e => setEta(e.target.value ? Math.max(1, parseInt(e.target.value, 10)) : undefined)}
                      onBlur={() => apply(status)}
                      placeholder="e.g. 10"
                      className="mt-1 w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Activity</label>
                    <input
                      type="text"
                      value={activity}
                      onChange={e => setActivity(e.target.value)}
                      onBlur={() => apply(status)}
                      placeholder="e.g. Fade & Beard"
                      className="mt-1 w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                    />
                  </div>
                </div>
              )}

              <button
                onClick={reset}
                className="w-full text-xs text-muted-foreground font-bold py-2 mt-1 hover:text-foreground transition-colors"
              >
                Reset to default
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
