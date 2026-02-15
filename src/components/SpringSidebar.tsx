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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M5 12h14" />
      <path d="M12 5l7 7-7 7" />
    </svg>
  ),
  contact: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
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
      contact: defaultIcons.contact,
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
