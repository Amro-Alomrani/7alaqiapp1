import { Scissors, Sparkles, Star, Zap, User, Shield, Award, Target } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const ICON_MAP: Record<string, { Icon: LucideIcon; bg: string; text: string }> = {
  '✂️': { Icon: Scissors, bg: 'bg-blue-500/15',   text: 'text-blue-400' },
  '💈': { Icon: Zap,      bg: 'bg-red-500/15',    text: 'text-red-400' },
  '🪒': { Icon: Shield,   bg: 'bg-slate-500/15',  text: 'text-slate-400' },
  '👑': { Icon: Award,    bg: 'bg-amber-500/15',  text: 'text-amber-500' },
  '⭐': { Icon: Star,     bg: 'bg-yellow-500/15', text: 'text-yellow-400' },
  '🔥': { Icon: Sparkles, bg: 'bg-orange-500/15', text: 'text-orange-400' },
  '💇': { Icon: User,     bg: 'bg-purple-500/15', text: 'text-purple-400' },
  '🎯': { Icon: Target,   bg: 'bg-green-500/15',  text: 'text-green-400' },
};

const FALLBACK_COLORS = [
  { bg: 'bg-blue-500/15',   text: 'text-blue-400' },
  { bg: 'bg-green-500/15',  text: 'text-green-400' },
  { bg: 'bg-purple-500/15', text: 'text-purple-400' },
  { bg: 'bg-amber-500/15',  text: 'text-amber-500' },
  { bg: 'bg-red-500/15',    text: 'text-red-400' },
  { bg: 'bg-cyan-500/15',   text: 'text-cyan-400' },
];

function hashStr(s: string): number {
  let h = 0;
  for (const c of s) h = ((h * 31) + c.charCodeAt(0)) & 0xffff;
  return h;
}

interface Props {
  icon?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  rounded?: string;
}

export default function ServiceIconBadge({ icon = '', name = '', size = 'md', rounded = 'rounded-xl' }: Props) {
  const mapped = ICON_MAP[icon];
  const colorIdx = hashStr(name || icon || 'service') % FALLBACK_COLORS.length;
  const colors = mapped ? { bg: mapped.bg, text: mapped.text } : FALLBACK_COLORS[colorIdx];
  const Icon = mapped?.Icon ?? Scissors;

  const dim = { xs: 'w-7 h-7', sm: 'w-9 h-9', md: 'w-11 h-11', lg: 'w-14 h-14' }[size];
  const iconPx = { xs: 13, sm: 16, md: 18, lg: 22 }[size];

  return (
    <div className={`${dim} ${colors.bg} ${rounded} flex items-center justify-center flex-shrink-0`}>
      <Icon size={iconPx} className={colors.text} strokeWidth={1.5} />
    </div>
  );
}
