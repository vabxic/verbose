import { useState, useEffect, useCallback, useRef, type ReactNode, type CSSProperties } from 'react';

/* ─── star helpers (pure CSS box-shadow, no canvas) ─── */

function generateStars(count: number, color: string) {
  const shadows: string[] = [];
  for (let i = 0; i < count; i++) {
    const x = Math.floor(Math.random() * 4000) - 2000;
    const y = Math.floor(Math.random() * 4000) - 2000;
    shadows.push(`${x}px ${y}px ${color}`);
  }
  return shadows.join(', ');
}

/* ─── StarLayer: a CSS-animated layer of stars ─── */

const layerKeyframes = `
@keyframes starsScroll {
  from { transform: translateY(0); }
  to   { transform: translateY(-2000px); }
}`;

// inject keyframes once
if (typeof document !== 'undefined') {
  const id = '__stars_keyframes';
  if (!document.getElementById(id)) {
    const style = document.createElement('style');
    style.id = id;
    style.textContent = layerKeyframes;
    document.head.appendChild(style);
  }
}

function StarLayer({
  count = 700,
  size = 1,
  duration = 50,
  starColor = '#fff',
}: {
  count?: number;
  size?: number;
  duration?: number;
  starColor?: string;
}) {
  const [boxShadow, setBoxShadow] = useState('');

  useEffect(() => {
    setBoxShadow(generateStars(count, starColor));
  }, [count, starColor]);

  const dotStyle: CSSProperties = {
    position: 'absolute',
    width: size,
    height: size,
    borderRadius: '50%',
    background: 'transparent',
    boxShadow,
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: 2000,
        animation: `starsScroll ${duration}s linear infinite`,
      }}
    >
      <div style={dotStyle} />
      <div style={{ ...dotStyle, top: 2000 }} />
    </div>
  );
}

/* ─── StarsBackground ─── */

export interface StarsBackgroundProps {
  children?: ReactNode;
  className?: string;
  factor?: number;
  speed?: number;
  starColor?: string;
  style?: CSSProperties;
}

export function StarsBackground({
  children,
  className,
  factor = 0.03,
  speed = 80,
  starColor = '#fff',
  style,
}: StarsBackgroundProps) {
  const innerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!innerRef.current) return;
      const dx = -(e.clientX - window.innerWidth / 2) * factor;
      const dy = -(e.clientY - window.innerHeight / 2) * factor;
      innerRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
    },
    [factor],
  );

  return (
    <div
      className={className}
      onMouseMove={handleMouseMove}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: 'radial-gradient(ellipse at bottom, #262626 0%, #000 100%)',
        ...style,
      }}
    >
      <div
        ref={innerRef}
        style={{ pointerEvents: 'none', transition: 'transform 0.3s ease-out' }}
      >
        <StarLayer count={700}  size={1} duration={speed}     starColor={starColor} />
        <StarLayer count={300}  size={2} duration={speed * 2} starColor={starColor} />
        <StarLayer count={150}  size={3} duration={speed * 3} starColor={starColor} />
      </div>
      {children}
    </div>
  );
}

export default StarsBackground;
