import { useEffect, useRef, useState } from 'react';

export default function CursorTrail({
  length = 14,
  size = 16,
  color = 'rgba(255,255,255,0.9)',
  smoothing = 0.45,
}: {
  length?: number;
  size?: number;
  color?: string;
  smoothing?: number;
}) {
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const hasNavigator = typeof navigator !== 'undefined';
    const isTouch = 'ontouchstart' in window || (hasNavigator && (navigator.maxTouchPoints || 0) > 0) || window.innerWidth <= 768;
    return !isTouch;
  });

  useEffect(() => {
    // update on resize in case device rotates or viewport changes
    const onResize = () => {
      const hasNavigator = typeof navigator !== 'undefined';
      const isTouch = 'ontouchstart' in window || (hasNavigator && (navigator.maxTouchPoints || 0) > 0) || window.innerWidth <= 768;
      setEnabled(!isTouch);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!enabled) return null;
  const pointsRef = useRef<Array<{ x: number; y: number }>>( [] );
  const targetRef = useRef<{ x: number; y: number }>({ x: window.innerWidth/2, y: window.innerHeight/2 });
  const rafRef = useRef<number | null>(null);
  const [, setTick] = useState(0);

  // init points
  useEffect(() => {
    pointsRef.current = new Array(length).fill(0).map(() => ({ x: targetRef.current.x, y: targetRef.current.y }));
  }, [length]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      targetRef.current.x = e.clientX;
      targetRef.current.y = e.clientY;
    };
    window.addEventListener('mousemove', onMove, { passive: true });

    const animate = () => {
      const pts = pointsRef.current;
      if (pts.length === 0) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }

      // head follows target
      pts[0].x += (targetRef.current.x - pts[0].x) * smoothing;
      pts[0].y += (targetRef.current.y - pts[0].y) * smoothing;

      // each point chases the previous one -> creates trailing behind
      for (let i = 1; i < pts.length; i++) {
        pts[i].x += (pts[i-1].x - pts[i].x) * smoothing;
        pts[i].y += (pts[i-1].y - pts[i].y) * smoothing;
      }

      // trigger render
      setTick(t => t + 1);
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [smoothing]);

  const pts = pointsRef.current;

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 99999 }}>
      {pts.map((p, i) => {
        const t = 1 - i / pts.length; // head = t ~1, tail ~0
        const s = size * (0.25 + 0.75 * t);
        const opacity = 0.05 + 0.95 * (t * t);
        return (
          <div
            key={i}
            style={{
              position: 'fixed',
              left: p.x - s / 2,
              top: p.y - s / 2,
              width: s,
              height: s,
              borderRadius: '50%',
              background: color,
              transform: 'translateZ(0)',
              opacity,
              mixBlendMode: 'screen',
            }}
          />
        );
      })}
    </div>
  );
}
