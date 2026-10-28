import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

const G = '#d4af6f';
const GL = '#f4dca0';
const GD = '#6b4f24';
const GP = '#3d2c10';

const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInQuart  = (t: number) => t * t * t * t;
const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOutBack  = (t: number) => { const c = 1.70158 + 1; return 1 + c * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2); };
const linear       = (t: number) => t;

function interp(input: number[], output: number[], ease = linear) {
  return (t: number) => {
    if (t <= input[0]) return output[0];
    if (t >= input[input.length - 1]) return output[output.length - 1];
    for (let i = 0; i < input.length - 1; i++) {
      if (t >= input[i] && t <= input[i + 1]) {
        const local = (t - input[i]) / (input[i + 1] - input[i]);
        return output[i] + (output[i + 1] - output[i]) * ease(local);
      }
    }
    return output[output.length - 1];
  };
}

function anim(from: number, to: number, start: number, end: number, ease = easeInOutCubic) {
  return (t: number) => {
    if (t <= start) return from;
    if (t >= end) return to;
    return from + (to - from) * ease((t - start) / (end - start));
  };
}

const DURATION = 8.0;

function RealisticScissors({ size = 200 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 240 240">
      <defs>
        <linearGradient id="rsc-blade" x1="0.2" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#fafbfc" />
          <stop offset="38%" stopColor="#a8b0b8" />
          <stop offset="80%" stopColor="#3d4146" />
          <stop offset="100%" stopColor="#1f2226" />
        </linearGradient>
        <linearGradient id="rsc-blade-spec" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="rsc-gold-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={GL} />
          <stop offset="35%" stopColor={G} />
          <stop offset="70%" stopColor={GD} />
          <stop offset="100%" stopColor={GP} />
        </linearGradient>
        <radialGradient id="rsc-pivot" cx="0.3" cy="0.3" r="0.8">
          <stop offset="0%" stopColor="#fff5d8" />
          <stop offset="35%" stopColor={GL} />
          <stop offset="70%" stopColor={G} />
          <stop offset="100%" stopColor={GP} />
        </radialGradient>
        <filter id="rsc-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
          <feOffset dx="1" dy="3" />
          <feComponentTransfer><feFuncA type="linear" slope="0.6" /></feComponentTransfer>
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g transform="rotate(-18 120 120)" filter="url(#rsc-shadow)">
        <path d="M 120 120 L 222 110 Q 230 116 228 124 L 120 130 Z" fill="url(#rsc-blade)" />
        <path d="M 122 122 L 220 113 L 218 116 L 122 124 Z" fill="url(#rsc-blade-spec)" />
        <path d="M 122 130 L 226 124" stroke="#fff" strokeWidth="0.5" opacity="0.7" />
        <path d="M 96 116 L 120 114 L 120 126 L 96 124 Z" fill="url(#rsc-blade)" />
        <g transform="translate(60 120)">
          <ellipse rx="32" ry="26" fill="none" stroke="url(#rsc-gold-ring)" strokeWidth="9" />
          <ellipse rx="32" ry="26" fill="none" stroke={GP} strokeWidth="0.6" />
          <ellipse rx="27.5" ry="21.5" fill="none" stroke={GP} strokeWidth="0.4" />
          <ellipse rx="32" ry="26" fill="none" stroke={GL} strokeWidth="1.5" strokeDasharray="4 60" transform="rotate(-30)" opacity="0.8" />
        </g>
      </g>
      <g transform="rotate(18 120 120)" filter="url(#rsc-shadow)">
        <path d="M 120 120 L 222 130 Q 230 124 228 116 L 120 110 Z" fill="url(#rsc-blade)" />
        <path d="M 122 118 L 220 127 L 218 124 L 122 116 Z" fill="url(#rsc-blade-spec)" opacity="0.6" />
        <path d="M 122 110 L 226 116" stroke="#fff" strokeWidth="0.5" opacity="0.6" />
        <path d="M 96 124 L 120 126 L 120 114 L 96 116 Z" fill="url(#rsc-blade)" />
        <g transform="translate(60 120)">
          <ellipse rx="32" ry="26" fill="none" stroke="url(#rsc-gold-ring)" strokeWidth="9" />
          <ellipse rx="32" ry="26" fill="none" stroke={GP} strokeWidth="0.6" />
          <ellipse rx="27.5" ry="21.5" fill="none" stroke={GP} strokeWidth="0.4" />
          <ellipse rx="32" ry="26" fill="none" stroke={GL} strokeWidth="1.5" strokeDasharray="4 60" transform="rotate(150)" opacity="0.8" />
        </g>
      </g>
      <circle cx="120" cy="120" r="9" fill="url(#rsc-pivot)" />
      <circle cx="120" cy="120" r="9" fill="none" stroke={GP} strokeWidth="0.7" />
      <line x1="115" y1="120" x2="125" y2="120" stroke={GP} strokeWidth="1.2" />
      <circle cx="117" cy="117" r="2" fill="#fff5d8" opacity="0.7" />
    </svg>
  );
}

function RealisticRazor({ size = 280 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.42} viewBox="0 0 280 120" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="rrz-blade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fdfdfe" />
          <stop offset="40%" stopColor="#9aa1a8" />
          <stop offset="100%" stopColor="#2a2d31" />
        </linearGradient>
        <linearGradient id="rrz-handle" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a0e04" />
          <stop offset="42%" stopColor="#5a3818" />
          <stop offset="100%" stopColor="#0a0502" />
        </linearGradient>
        <linearGradient id="rrz-gold-cap" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={GL} />
          <stop offset="50%" stopColor={G} />
          <stop offset="100%" stopColor={GP} />
        </linearGradient>
      </defs>
      <rect x="10" y="48" width="120" height="22" rx="5" fill="url(#rrz-handle)" />
      <rect x="10" y="48" width="14" height="22" rx="3" fill="url(#rrz-gold-cap)" />
      <rect x="116" y="48" width="14" height="22" rx="3" fill="url(#rrz-gold-cap)" />
      <rect x="14" y="50" width="112" height="2.5" rx="1" fill="rgba(255,255,255,.18)" />
      <circle cx="135" cy="59" r="4.5" fill="url(#rrz-gold-cap)" />
      <circle cx="133.5" cy="57.5" r="1.3" fill="#fff5d8" opacity="0.7" />
      <g transform="rotate(-9 135 59)">
        <path d="M 135 50 L 262 42 Q 272 50 268 60 L 262 70 L 135 70 Z" fill="url(#rrz-blade)" />
        <path d="M 138 51 L 260 44 L 260 47 L 138 53 Z" fill="rgba(255,255,255,.55)" />
        <line x1="140" y1="69.5" x2="265" y2="69" stroke="#fff" strokeWidth="0.5" opacity="0.95" />
        <text x="200" y="62" fontFamily="serif" fontSize="7" fill="rgba(0,0,0,.4)" fontStyle="italic" textAnchor="middle">7alaqi</text>
      </g>
    </svg>
  );
}

function RealisticComb({ size = 280 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.42} viewBox="0 0 280 120" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="rcb-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#221915" />
          <stop offset="50%" stopColor="#3d2e26" />
          <stop offset="100%" stopColor="#0a0604" />
        </linearGradient>
        <linearGradient id="rcb-gold" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="35%" stopColor={G} />
          <stop offset="50%" stopColor={GL} />
          <stop offset="65%" stopColor={G} />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
        <linearGradient id="rcb-tooth" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a2c24" />
          <stop offset="100%" stopColor="#000" />
        </linearGradient>
      </defs>
      <rect x="14" y="38" width="252" height="26" rx="4" fill="url(#rcb-body)" />
      <rect x="22" y="50" width="236" height="1" fill="url(#rcb-gold)" />
      <text x="140" y="58.5" textAnchor="middle" fontFamily="serif" fontSize="6.5" fill={G} opacity="0.6" letterSpacing="2">7ALAQI</text>
      {Array.from({ length: 14 }).map((_, i) => {
        const x = 22 + i * 8.6;
        return <rect key={`c${i}`} x={x} y="64" width="2.6" height="44" rx="1" fill="url(#rcb-tooth)" />;
      })}
      {Array.from({ length: 32 }).map((_, i) => (
        <rect key={`f${i}`} x={144 + i * 3.8} y="64" width="1.3" height="42" rx="0.5" fill="url(#rcb-tooth)" />
      ))}
    </svg>
  );
}

function Shockwave({ at, start, t }: { at: [number, number]; start: number; t: number }) {
  const local = Math.max(0, Math.min(1, (t - start) / 0.7));
  if (local <= 0 || local >= 1) return null;
  const r = local * 90;
  const op = (1 - local) * 0.7;
  return (
    <div style={{
      position: 'absolute', left: '50%', top: '50%',
      transform: `translate(${at[0] - r}px, ${at[1] - r}px)`,
      width: r * 2, height: r * 2, borderRadius: '50%',
      border: `2px solid ${GL}`,
      boxShadow: `0 0 ${20 * op}px ${G}, inset 0 0 ${10 * op}px ${G}`,
      opacity: op, pointerEvents: 'none', zIndex: 8,
    }} />
  );
}

function SparkBurst({ at, start, t }: { at: [number, number]; start: number; t: number }) {
  const local = Math.max(0, Math.min(1, (t - start) / 0.8));
  if (local <= 0 || local >= 1) return null;
  return (
    <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(${at[0]}px, ${at[1]}px)`, pointerEvents: 'none', zIndex: 9 }}>
      {Array.from({ length: 10 }).map((_, i) => {
        const angle = (i / 10) * Math.PI * 2;
        const dist = local * (40 + (i % 3) * 12);
        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist + local * local * 30;
        return (
          <div key={i} style={{
            position: 'absolute', left: x - 1.5, top: y - 1.5,
            width: 3, height: 3, borderRadius: '50%',
            background: i % 2 ? '#fff5d8' : GL,
            opacity: (1 - local) * 0.95,
            boxShadow: `0 0 ${6 * (1 - local)}px ${GL}`,
          }} />
        );
      })}
    </div>
  );
}

function Backdrop({ t, dolly, bgFade, spotlight, shake, parallax }: {
  t: number; dolly: number; bgFade: number; spotlight: number;
  shake: { x: number; y: number }; parallax: number;
}) {
  const poleRot = (t * 90) % 360;
  return (
    <div style={{
      position: 'absolute', inset: 0,
      transform: `translate(${shake.x * 0.4}px, ${shake.y * 0.3}px) scale(${dolly})`,
      transformOrigin: '50% 60%', opacity: bgFade,
    }}>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '40%',
        background: 'linear-gradient(180deg, #0e0805 0%, #1a0e08 50%, #050302 100%)' }} />
      <div style={{ position: 'absolute', inset: 0, bottom: '40%',
        background: 'linear-gradient(180deg, #0a0604 0%, #1a0e08 60%, #2a1a10 100%)' }} />
      <div style={{
        position: 'absolute', left: '8%', right: '8%', bottom: '38%', height: 4,
        background: `linear-gradient(180deg, ${GL} 0%, ${G} 50%, ${GD} 100%)`,
        boxShadow: `0 0 16px ${G}`, opacity: 0.7,
      }} />
      <div style={{
        position: 'absolute', left: '50%', top: '20%',
        width: 280, height: 360, marginLeft: -140,
        border: `3px solid ${GD}`, borderRadius: '50% 50% 8px 8px',
        background: 'radial-gradient(ellipse at 30% 30%, rgba(60,50,35,.4) 0%, rgba(10,7,5,.95) 100%)',
        boxShadow: `inset 0 0 60px rgba(0,0,0,.8), 0 0 40px rgba(212,175,111,.15)`,
        filter: 'blur(0.5px)',
      }}>
        <div style={{
          position: 'absolute', top: '15%', left: '20%', width: '40%', height: '15%',
          background: 'linear-gradient(135deg, rgba(255,235,200,.18) 0%, transparent 100%)',
          borderRadius: '50%', filter: 'blur(8px)',
        }} />
      </div>
      <div style={{
        position: 'absolute', left: '6%', top: '22%', width: 24, height: 220,
        background: '#1a0e08', borderRadius: 4, padding: 4,
        boxShadow: `0 0 30px rgba(212,175,111,.2)`,
      }}>
        <div style={{
          width: '100%', height: '100%', borderRadius: 2, overflow: 'hidden',
          background: `repeating-linear-gradient(${45 + poleRot * 0.4}deg, #c0392b 0 8px, #fff 8px 14px, #1e3a8a 14px 22px, #fff 22px 28px)`,
          boxShadow: 'inset 0 0 8px rgba(0,0,0,.6)',
        }} />
        <div style={{ position: 'absolute', left: -2, right: -2, top: -6, height: 10,
          background: `linear-gradient(180deg, ${GL}, ${GD})`, borderRadius: 3, boxShadow: `0 0 8px ${G}` }} />
        <div style={{ position: 'absolute', left: -2, right: -2, bottom: -6, height: 10,
          background: `linear-gradient(180deg, ${G}, ${GP})`, borderRadius: 3 }} />
      </div>
      <div style={{
        position: 'absolute', left: '50%', top: '-10%', transform: 'translateX(-50%)',
        width: '160%', height: '90%',
        background: `radial-gradient(ellipse 35% 80% at 50% 0%, rgba(255,235,200,${0.35 * spotlight}) 0%, rgba(212,175,111,${0.12 * spotlight}) 25%, transparent 60%)`,
        pointerEvents: 'none',
      }} />
      {Array.from({ length: 14 }).map((_, i) => {
        const seed = i * 137.5;
        const x = (seed * 7) % 100;
        const y = ((seed * 11) % 80) + 10;
        const drift = Math.sin((t + i * 0.5) * 0.6) * 8 + parallax * (i % 2 ? 1 : -1);
        const rise = ((t * 3 + i * 4) % 40) - 20;
        const op = (0.2 + (Math.sin((t + i) * 1.4) * 0.5 + 0.5) * 0.5) * spotlight;
        return (
          <div key={i} style={{
            position: 'absolute', left: `${x}%`, top: `${y + drift + rise}%`,
            width: 2, height: 2, borderRadius: '50%',
            background: '#fff5d8', opacity: op, boxShadow: `0 0 5px ${GL}`,
          }} />
        );
      })}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 90% 90% at 50% 55%, transparent 30%, rgba(0,0,0,.85) 95%)',
        pointerEvents: 'none',
      }} />
    </div>
  );
}

function IntroScene({ onFinish }: { onFinish: () => void }) {
  const [time, setTime] = useState(0);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  const onFinishRef = useRef(onFinish);
  useEffect(() => { onFinishRef.current = onFinish; }, [onFinish]);

  useEffect(() => {
    const tick = (now: number) => {
      if (startRef.current == null) startRef.current = now;
      const elapsed = (now - startRef.current) / 1000;
      if (elapsed >= DURATION) {
        setTime(DURATION);
        if (!doneRef.current) { doneRef.current = true; setTimeout(() => onFinishRef.current(), 200); }
        return;
      }
      setTime(elapsed);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const skip = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setTime(DURATION);
    if (!doneRef.current) { doneRef.current = true; onFinishRef.current(); }
  }, []);

  const t = time;

  const spotlight  = anim(0, 1, 0.2, 1.4, easeOutQuart)(t);
  const bgFade     = anim(0, 1, 0.8, 2.0, easeOutCubic)(t);
  const dolly      = anim(1.0, 1.06, 1.4, 6.5, easeOutQuart)(t);
  const irisOut    = anim(0, 1, 7.0, 8.0, easeInQuart)(t);
  const fadeOut    = anim(1, 0, 7.4, 8.0)(t);
  const parallax   = Math.sin(t * 0.8) * 2;

  const scsX     = interp([2.0, 3.4], [-260, 0], easeOutQuart)(t);
  const scsY     = interp([2.0, 3.4], [-360, -100], easeOutQuart)(t);
  const scsRot   = interp([2.0, 3.4], [-720, -22], easeOutQuart)(t);
  const scsScale = interp([2.0, 3.0, 3.4], [0.4, 1.15, 1.0], easeOutQuart)(t);
  const scsBlur  = interp([2.0, 2.9, 3.3], [12, 4, 0], easeOutCubic)(t);
  const scsBounce = t > 3.4 && t < 4.2 ? Math.sin((t - 3.4) * 22) * Math.exp(-(t - 3.4) * 5) * 6 : 0;
  const scsOp   = anim(0, 1, 2.0, 2.3)(t);

  const rzX     = interp([1.6, 3.2], [380, 60], easeOutQuart)(t);
  const rzY     = interp([1.6, 2.4, 3.2], [-40, -90, 50], easeOutQuart)(t);
  const rzRot   = interp([1.6, 3.2], [540, 18], easeOutQuart)(t);
  const rzScale = interp([1.6, 2.6, 3.2], [0.4, 1.1, 1.0], easeOutQuart)(t);
  const rzBlur  = interp([1.6, 2.7, 3.1], [14, 5, 0], easeOutCubic)(t);
  const rzBounce = t > 3.2 && t < 4.0 ? Math.sin((t - 3.2) * 22) * Math.exp(-(t - 3.2) * 5) * 5 : 0;
  const rzOp    = anim(0, 1, 1.6, 1.9)(t);

  const cbX     = interp([2.4, 3.6], [-180, -8], easeOutQuart)(t);
  const cbY     = interp([2.4, 3.0, 3.6], [380, 220, 110], easeOutQuart)(t);
  const cbRot   = interp([2.4, 3.6], [-380, -10], easeOutQuart)(t);
  const cbScale = interp([2.4, 3.2, 3.6], [0.4, 1.08, 1.0], easeOutQuart)(t);
  const cbBlur  = interp([2.4, 3.1, 3.5], [10, 4, 0], easeOutCubic)(t);
  const cbBounce = t > 3.6 && t < 4.4 ? Math.sin((t - 3.6) * 22) * Math.exp(-(t - 3.6) * 5) * 5 : 0;
  const cbOp    = anim(0, 1, 2.4, 2.7)(t);

  const shake = (() => {
    let sx = 0, sy = 0;
    for (const [im] of [[3.2], [3.4], [3.6]]) {
      if (t >= im && t < im + 0.35) {
        const local = (t - im) / 0.35;
        const dec = Math.exp(-local * 6);
        sx += Math.sin(local * 40) * dec * 4;
        sy += Math.cos(local * 35) * dec * 3;
      }
    }
    return { x: sx, y: sy };
  })();

  const letters = '7alaqi'.split('');
  const logoBuild = letters.map((_, i) => {
    const s = 4.0 + i * 0.10;
    return {
      opacity: anim(0, 1, s, s + 0.4, easeOutCubic)(t),
      y: anim(12, 0, s, s + 0.5, easeOutBack)(t),
      blur: anim(6, 0, s, s + 0.4, easeOutCubic)(t),
    };
  });
  const lineWidth      = anim(0, 110, 4.8, 5.5, easeOutCubic)(t);
  const taglineOpacity = anim(0, 1, 5.2, 6.0)(t);
  const taglineY       = anim(8, 0, 5.2, 6.0)(t);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: '#040302', opacity: fadeOut }}>
      <Backdrop t={t} dolly={dolly} bgFade={bgFade} spotlight={spotlight} shake={shake} parallax={parallax} />

      <div style={{
        position: 'absolute', inset: 0,
        transform: `translate(${shake.x}px, ${shake.y}px) scale(${dolly})`,
        transformOrigin: '50% 55%',
      }}>
        {t > 3.2 && t < 3.9 && <Shockwave at={[120, -90]} start={3.2} t={t} />}
        {t > 3.4 && t < 4.1 && <Shockwave at={[-100, -100]} start={3.4} t={t} />}
        {t > 3.6 && t < 4.3 && <Shockwave at={[-8, 110]} start={3.6} t={t} />}

        {t > 3.2 && t < 4.0 && <SparkBurst at={[120, -90]} start={3.2} t={t} />}
        {t > 3.4 && t < 4.2 && <SparkBurst at={[-100, -100]} start={3.4} t={t} />}
        {t > 3.6 && t < 4.4 && <SparkBurst at={[-8, 110]} start={3.6} t={t} />}

        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', zIndex: 4 }}>
          <div dir="ltr" style={{ direction: 'ltr', unicodeBidi: 'isolate', fontFamily: 'Georgia, serif', fontSize: 92, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1, display: 'flex', justifyContent: 'center', color: '#f5ead0', textShadow: `0 8px 50px rgba(212,175,111,.5)` }}>
            {letters.map((l, i) => (
              <span key={i} style={{ opacity: logoBuild[i].opacity, transform: `translateY(${logoBuild[i].y}px)`, filter: `blur(${logoBuild[i].blur}px)`, display: 'inline-block' }}>{l}</span>
            ))}
          </div>
          <div style={{ width: lineWidth, height: 1.5, background: `linear-gradient(90deg, transparent, ${GL}, ${G}, ${GL}, transparent)`, margin: '20px auto', boxShadow: `0 0 24px ${G}` }} />
          <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.55em', textTransform: 'uppercase', color: GL, fontFamily: 'Inter, sans-serif', opacity: taglineOpacity, transform: `translateY(${taglineY}px)`, textShadow: `0 0 20px ${G}` }}>
            حلاقك... بضغطة
          </div>
        </div>

        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 260, height: 260, marginLeft: -130, marginTop: -130, transform: `translate(${scsX}px, ${scsY + scsBounce}px) rotate(${scsRot}deg) scale(${scsScale})`, filter: `blur(${scsBlur}px) drop-shadow(0 14px 28px rgba(0,0,0,.7))`, opacity: scsOp, zIndex: 6 }}>
          <RealisticScissors size={260} />
        </div>

        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 280, height: 120, marginLeft: -140, marginTop: -60, transform: `translate(${rzX}px, ${rzY + rzBounce}px) rotate(${rzRot}deg) scale(${rzScale})`, filter: `blur(${rzBlur}px) drop-shadow(0 12px 24px rgba(0,0,0,.7))`, opacity: rzOp, zIndex: 7 }}>
          <RealisticRazor size={280} />
        </div>

        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 280, height: 120, marginLeft: -140, marginTop: -60, transform: `translate(${cbX}px, ${cbY + cbBounce}px) rotate(${cbRot}deg) scale(${cbScale})`, filter: `blur(${cbBlur}px) drop-shadow(0 12px 24px rgba(0,0,0,.7))`, opacity: cbOp, zIndex: 5 }}>
          <RealisticComb size={280} />
        </div>
      </div>

      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 25, background: `radial-gradient(circle at 50% 50%, transparent ${(1 - irisOut) * 100}%, #000 ${(1 - irisOut) * 100 + 5}%)` }} />

      <button onClick={skip} style={{
        position: 'absolute', bottom: 28, right: 24, zIndex: 30,
        fontSize: 10, color: `rgba(245,234,208,${t > 0.5 && t < 7.0 ? 0.55 : 0})`,
        background: 'none', border: 'none', cursor: 'pointer',
        fontFamily: 'Inter, sans-serif', letterSpacing: '0.3em', textTransform: 'uppercase',
        transition: 'opacity .4s',
      }}>Skip ›</button>
    </div>
  );
}

const SLIDES = {
  ar: [
    { emoji: '✂️', tag: '🇯🇴 الأردن', title: 'حلاقي', sub: 'تصفّح الحلاقين والخدمات', desc: 'اطّلع على ملفات الحلاقين والخدمات والأسعار التي أضافوها، ثم اختر ما يناسبك.', chips: ['🔎 تصفّح الحلاقين', '✂️ خدمات مسجّلة', '💳 أسعار يحددها الحلاق'] },
    { emoji: '📩', tag: 'طلب موعد', title: 'أرسل طلبك', sub: 'الحلاق يراجع التفاصيل', desc: 'اختر الحلاق والخدمة ووقتًا مقترحًا. يبقى الموعد طلبًا حتى يقبله الحلاق.', chips: [] },
    { emoji: '📋', tag: 'حجوزاتك', title: 'تابع حالة الطلب', sub: 'التفاصيل تظهر في التطبيق', desc: 'راجع حالة حجزك المسجلة في التطبيق، وتواصل مع الحلاق عند الحاجة.', chips: [] },
  ],
  en: [
    { emoji: '✂️', tag: '🇯🇴 Jordan', title: '7alaqi', sub: 'Browse barbers and services', desc: 'View barber profiles and the services and prices they list, then choose what works for you.', chips: ['🔎 Browse barbers', '✂️ Listed services', '💳 Prices set by each barber'] },
    { emoji: '📩', tag: 'Booking request', title: 'Send a request', sub: 'The barber reviews the details', desc: 'Choose a barber, service, and suggested time. The appointment remains a request until the barber accepts it.', chips: [] },
    { emoji: '📋', tag: 'Your bookings', title: 'Follow request status', sub: 'Updates appear in the app', desc: 'Review the recorded status of your booking and contact the barber when needed.', chips: [] },
  ],
};

type Phase = 'intro' | 'onboarding';

export default function IntroPage() {
  const navigate = useNavigate();
  const { authReady, isCustomerLoggedIn, isBarberLoggedIn } = useAuth();
  const { language, setLanguage } = useLanguage();
  const ar = language === 'ar';

  const [phase, setPhase] = useState<Phase>('intro');
  const [slide, setSlide] = useState(0);
  const [slideIn, setSlideIn] = useState(true);
  const isFirstVisit = !localStorage.getItem('halaqi_onboarded');

  useEffect(() => {
    if (!authReady) return;
    if (isCustomerLoggedIn) { navigate('/', { replace: true }); return; }
    if (isBarberLoggedIn) { navigate('/barber', { replace: true }); return; }
  }, [authReady, isCustomerLoggedIn, isBarberLoggedIn, navigate]);

  const onIntroFinish = useCallback(() => {
    if (isFirstVisit) setPhase('onboarding');
    else navigate('/select-role', { replace: true });
  }, [isFirstVisit, navigate]);

  const finish = () => {
    localStorage.setItem('halaqi_onboarded', '1');
    navigate('/select-role', { replace: true });
  };

  const goTo = (idx: number) => {
    setSlideIn(false);
    setTimeout(() => { setSlide(idx); setSlideIn(true); }, 180);
  };

  if (phase === 'intro') {
    return (
      <div style={{ position: 'fixed', inset: 0 }}>
        <IntroScene onFinish={onIntroFinish} />
      </div>
    );
  }

  const slides = ar ? SLIDES.ar : SLIDES.en;
  const cur = slides[slide];
  const isLast = slide === slides.length - 1;
  const accentColors = ['hsl(38 92% 52%)', 'hsl(220 90% 60%)', 'hsl(270 80% 60%)'];
  const accent = accentColors[slide];

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-background" dir={ar ? 'rtl' : 'ltr'}>
      <div className="absolute inset-0 pointer-events-none transition-all duration-700"
        style={{ background: `radial-gradient(ellipse 80% 50% at 50% 0%, ${accent}18 0%, transparent 65%)` }} />

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden transition-opacity duration-300"
        style={{ opacity: slideIn ? 1 : 0 }}>
        <span className="font-black leading-none"
          style={{ fontSize: 'clamp(200px, 60vw, 380px)', color: accent, opacity: 0.04, letterSpacing: '-0.04em' }}>
          0{slide + 1}
        </span>
      </div>

      <div className="flex items-center justify-between px-5 pt-14 pb-2 relative z-10">
        <button onClick={finish} className="text-xs font-bold text-muted-foreground/60 px-3 py-1.5 rounded-xl hover:bg-muted/40 transition-colors">
          {ar ? 'تخطى' : 'Skip'}
        </button>
        <img src="/logo.png" alt="HALAQI" className="w-8 h-8 object-contain" />
        <button onClick={() => setLanguage(ar ? 'en' : 'ar')} className="text-xs font-bold bg-card border border-border rounded-xl px-3 py-1.5">
          {ar ? 'EN' : 'عربي'}
        </button>
      </div>

      <div className="flex-1 flex flex-col justify-end px-6 pb-4 relative z-10 transition-all duration-180"
        style={{ opacity: slideIn ? 1 : 0, transform: slideIn ? 'translateY(0)' : 'translateY(10px)' }}>
        <div className="mb-6">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl shadow-xl mb-4"
            style={{ background: `${accent}18`, border: `1.5px solid ${accent}30` }}>
            {cur.emoji}
          </div>
          <span className="inline-block text-[11px] font-black px-3 py-1.5 rounded-full mb-3"
            style={{ background: `${accent}18`, color: accent }}>
            {cur.tag}
          </span>
          <h1 className="text-5xl font-black text-foreground leading-none mb-1">
            {slide === 0 && ar ? <><span style={{ color: accent }}>ح</span>لاقي</> :
             slide === 0 ? <><span style={{ color: accent }}>7</span>alaqi</> : cur.title}
          </h1>
          <p className="text-base font-bold mt-1 mb-3" style={{ color: accent }}>{cur.sub}</p>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">{cur.desc}</p>
          {cur.chips.length > 0 && (
            <div className="flex gap-2 flex-wrap mt-4">
              {cur.chips.map(chip => (
                <span key={chip} className="text-xs font-bold px-3 py-1.5 rounded-full"
                  style={{ background: `${accent}12`, color: accent, border: `1px solid ${accent}35` }}>
                  {chip}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="px-6 pb-12 pt-2 relative z-10 space-y-4">
        <div className="flex items-center justify-center gap-2">
          {slides.map((_, i) => (
            <button key={i} onClick={() => goTo(i)} className="rounded-full transition-all duration-300"
              style={{ width: i === slide ? 24 : 8, height: 8, background: i === slide ? accent : `${accent}30` }} />
          ))}
        </div>

        {isLast ? (
          <button onClick={finish} className="w-full h-14 rounded-2xl text-white font-black text-base shadow-lg active:scale-[0.98] transition-transform"
            style={{ background: `linear-gradient(135deg, ${accent} 0%, hsl(28 90% 36%) 100%)` }}>
            {ar ? '🚀 ابدأ الآن' : '🚀 Get Started'}
          </button>
        ) : (
          <div className="flex gap-3">
            {slide > 0 && (
              <button onClick={() => goTo(slide - 1)} className="h-14 px-5 rounded-2xl border-2 border-border bg-card text-foreground font-bold text-sm active:scale-95 transition-transform">
                {ar ? '→' : '←'}
              </button>
            )}
            <button onClick={() => goTo(slide + 1)} className="flex-1 h-14 rounded-2xl text-white font-black text-base active:scale-[0.98] transition-transform"
              style={{ background: `linear-gradient(135deg, ${accent} 0%, hsl(28 90% 36%) 100%)` }}>
              {ar ? 'التالي ←' : 'Next →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
