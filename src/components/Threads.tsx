import React, { useState, useEffect } from 'react';
import './Threads.css';

interface ThreadsProps {
  color?: [number, number, number];
  amplitude?: number;
  distance?: number;
  enableMouseInteraction?: boolean;
}

const Threads: React.FC<ThreadsProps> = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const splineUrl = isMobile
    ? 'https://prod.spline.design/p9eutj038UXP57N4/scene.splinecode'
    : 'https://prod.spline.design/054AjNimDIYOuOeM/scene.splinecode';

  return (
    <spline-viewer
      url={splineUrl}
      className="threads-container"
    ></spline-viewer>
  );
};

export default Threads;
