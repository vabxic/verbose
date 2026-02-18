import React from 'react';
import './Threads.css';

interface ThreadsProps {
  color?: [number, number, number];
  amplitude?: number;
  distance?: number;
  enableMouseInteraction?: boolean;
}

const Threads: React.FC<ThreadsProps> = () => {
  return (
    <div className="threads-container"></div>
  );
};

export default Threads;
