import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useSpring, animated } from '@react-spring/web';
import './SpringSidebar.css';

export interface SidebarSection {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface SpringSidebarProps {
  sections: SidebarSection[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
}

/* Default section icons */
const defaultIcons = {
  hero: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  ),
  features: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  ),
  anonymous: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  start: (
    <svg height="64px" width="64px" viewBox="0 0 58.21 58.21" fill="#ffffff" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg" xmlSpace="preserve">
      <g>
        <g>
          <path d="M48.077,25.553c0.021-0.304,0.03-0.604,0.03-0.897c0-8.459-6.882-15.341-15.34-15.341 c-6.084,0-11.598,3.611-14.032,9.174c-0.029,0.042-0.123,0.106-0.161,0.117c-3.776,0.395-7.116,2.797-8.713,6.266 c-0.046,0.088-0.227,0.236-0.316,0.263C3.925,26.369,0,31.231,0,36.96c0,6.692,5.341,11.935,12.159,11.935h34.448 c6.397,0,11.603-5.307,11.603-11.83C58.21,31.164,53.783,26.278,48.077,25.553z M46.607,45.894H12.159 C7.023,45.894,3,41.97,3,36.959c0-4.308,2.956-7.966,7.187-8.895c1.001-0.219,1.964-0.996,2.397-1.935 c1.158-2.515,3.573-4.255,6.302-4.54c1.089-0.113,2.151-0.883,2.585-1.873c1.97-4.497,6.403-7.402,11.297-7.402 c6.805,0,12.34,5.536,12.34,12.341c0,0.378-0.021,0.773-0.064,1.176c-0.102,0.951-0.169,1.579,0.334,2.137 c0.284,0.316,0.699,0.501,1.124,0.501c0.028-0.014,0.108-0.004,0.162-0.01c4.718,0.031,8.547,3.878,8.547,8.603 C55.21,41.85,51.27,45.894,46.607,45.894z" />
        </g>
      </g>
    </svg>
  ),
  // contact icon removed (section removed from landing)
};

const SpringSidebar: React.FC<SpringSidebarProps> = ({ sections, scrollRef }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const isScrolling = useRef(false);

  // Spring animation for the active indicator
  const indicatorSpring = useSpring({
    top: activeIndex * 64, // gap(2.5rem=40px) + dot(24px) = 64px per step
    config: { tension: 260, friction: 24 },
  });

  // Track scroll position to update active dot
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (isScrolling.current) return;
      const scrollTop = container.scrollTop;
      const sectionHeight = container.clientHeight;
      const newIndex = Math.round(scrollTop / sectionHeight);
      if (newIndex !== activeIndex && newIndex >= 0 && newIndex < sections.length) {
        setActiveIndex(newIndex);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [activeIndex, sections.length, scrollRef]);

  const scrollToSection = useCallback(
    (index: number) => {
      const container = scrollRef.current;
      if (!container) return;
      isScrolling.current = true;
      setActiveIndex(index);

      const target = container.children[index] as HTMLElement;
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      // Allow scroll tracking again after animation
      setTimeout(() => {
        isScrolling.current = false;
      }, 800);
    },
    [scrollRef]
  );

  const getIconForSection = (index: number) => {
    const section = sections[index];
    if (section.icon) return section.icon;

    // Map section IDs to default icons
    const iconMap: Record<string, React.ReactNode> = {
      hero: defaultIcons.hero,
      features: defaultIcons.features,
      anonymous: defaultIcons.anonymous,
      start: defaultIcons.start,
    };

    return iconMap[section.id] || defaultIcons.hero;
  };

  return (
    <div className="spring-sidebar">
      <div className="spring-sidebar-track" style={{ position: 'relative' }}>
        {/* Animated indicator */}
        <animated.div
          className="spring-sidebar-indicator"
          style={{
            top: indicatorSpring.top,
            height: 24,
          }}
        />

        {sections.map((section, i) => (
          <div
            key={section.id}
            className={`spring-sidebar-dot${i === activeIndex ? ' active' : ''}`}
            onClick={() => scrollToSection(i)}
          >
            <div className="spring-sidebar-dot-icon">
              {getIconForSection(i)}
            </div>
            <span className="spring-sidebar-tooltip">{section.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SpringSidebar;
