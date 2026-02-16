import React, { useEffect, useRef } from 'react';

type Props = {
  children?: React.ReactNode;
};

export const BackgroundHome: React.FC<Props> = ({ children }) => {
  const bgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (bgRef.current) {
        const scrolled = window.scrollY;
        bgRef.current.style.transform = `translateY(${scrolled * 0.5}px)`;
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen w-full bg-black relative overflow-hidden">
      {/* Parallax Dotted Grid Background */}
      <div
        ref={bgRef}
        className="absolute inset-0 z-0"
        style={{
          background: '#000000',
          backgroundImage: `radial-gradient(circle, rgba(255, 255, 255, 0.2) 1.5px, transparent 1.5px)`,
          backgroundSize: '30px 30px',
          backgroundPosition: '0 0',
          willChange: 'transform',
        }}
      />

      {/* Foreground content should sit above the background */}
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default BackgroundHome;