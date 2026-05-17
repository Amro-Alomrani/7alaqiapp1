import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';

interface Props {
  before: string;
  after: string;
  aspectRatio?: string;
}

export default function BeforeAfterSlider({ before, after, aspectRatio = '4/5' }: Props) {
  const [position, setPosition] = useState(50);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setPosition((x / rect.width) * 100);
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    updatePosition(e.clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    updatePosition(e.touches[0].clientX);
  };

  return (
    <div
      ref={containerRef}
      className="relative select-none overflow-hidden w-full"
      style={{ aspectRatio }}
      onMouseMove={handleMouseMove}
      onMouseUp={() => setDragging(false)}
      onMouseLeave={() => setDragging(false)}
      onTouchMove={handleTouchMove}
    >
      <img
        src={after}
        alt="After"
        className="absolute inset-0 w-full h-full object-cover"
        draggable={false}
      />

      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        <img
          src={before}
          alt="Before"
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
      </div>

      <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full tracking-wider">
        BEFORE
      </div>
      <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full tracking-wider">
        AFTER
      </div>

      <div
        className="absolute top-0 bottom-0 w-px bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.8)]"
        style={{ left: `${position}%` }}
      />

      <motion.div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 cursor-col-resize"
        style={{ left: `${position}%` }}
        onMouseDown={() => setDragging(true)}
        onTouchStart={() => setDragging(true)}
        onTouchEnd={() => setDragging(false)}
        whileTap={{ scale: 1.15 }}
      >
        <div className="w-10 h-10 bg-white rounded-full shadow-xl flex items-center justify-center gap-0.5">
          <div className="flex gap-0.5">
            {['◀', '▶'].map((c, i) => (
              <span key={i} className="text-[9px] text-gray-600 font-black">{c}</span>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
