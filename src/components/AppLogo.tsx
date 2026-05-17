import { Scissors } from 'lucide-react';

interface AppLogoProps {
  size?: number;   // px, default 80
  className?: string;
}

export default function AppLogo({ size = 80, className = '' }: AppLogoProps) {
  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <img
        src="/logo.png"
        alt="7alaqi"
        className="w-full h-full object-contain drop-shadow-2xl"
        onError={e => {
          const t = e.currentTarget;
          t.style.display = 'none';
          const fb = t.nextElementSibling as HTMLElement;
          if (fb) fb.style.display = 'flex';
        }}
      />
      <div
        className="hidden w-full h-full rounded-3xl items-center justify-center shadow-xl"
        style={{ background: 'linear-gradient(135deg, hsl(38 92% 52%) 0%, hsl(28 90% 36%) 100%)' }}
      >
        <Scissors size={Math.round(size * 0.42)} className="text-white" strokeWidth={1.4} />
      </div>
    </div>
  );
}
