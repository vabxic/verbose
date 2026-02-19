import React from 'react';
import './BackgroundCustomizer.css';

export interface BackgroundOption {
  id: string;
  name: string;
  style: React.CSSProperties;
}

export const BACKGROUND_OPTIONS: BackgroundOption[] = [
  {
    id: 'lime-green',
    name: 'Lime Green',
    style: {
      background: 'linear-gradient(to bottom left, #84cc16, #16a34a, #0f766e)',
    },
  },
  {
    id: 'dark-radial',
    name: 'Dark Radial',
    style: {
      background: 'radial-gradient(ellipse at top left, #27272a, #52525b, #a1a1aa)',
    },
  },
  {
    id: 'indigo-radial',
    name: 'Indigo Radial',
    style: {
      background: 'radial-gradient(ellipse at left, #6366f1, #a5b4fc, #e0e7ff)',
    },
  },
  {
    id: 'orange-radial',
    name: 'Orange Radial',
    style: {
      background: 'radial-gradient(ellipse at bottom left, #ea580c, #fb923c, #fed7aa)',
    },
  },
  {
    id: 'red-radial',
    name: 'Red Radial',
    style: {
      background: 'radial-gradient(ellipse at bottom, #b91c1c, #ef4444, #fca5a5)',
    },
  },
  {
    id: 'orange-conic',
    name: 'Orange Conic',
    style: {
      background: 'conic-gradient(from 0deg at left, #f97316, #fdba74, #ffedd5)',
    },
  },
  {
    id: 'grid-overlay',
    name: 'Grid Overlay',
    style: {
      backgroundImage: `
        linear-gradient(to right, rgba(229,231,235,0.8) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(229,231,235,0.8) 1px, transparent 1px),
        radial-gradient(circle 500px at 20% 80%, rgba(139,92,246,0.3), transparent),
        radial-gradient(circle 500px at 80% 20%, rgba(59,130,246,0.3), transparent)
      `,
      backgroundSize: '48px 48px, 48px 48px, 100% 100%, 100% 100%',
      backgroundColor: '#ffffff',
    },
  },
  {
    id: 'violet-glow',
    name: 'Violet Glow',
    style: {
      background: 'radial-gradient(125% 125% at 50% 90%, #fff 40%, #7c3aed 100%)',
    },
  },
  {
    id: 'pink-glow',
    name: 'Pink Glow',
    style: {
      backgroundImage: 'radial-gradient(125% 125% at 50% 90%, #ffffff 40%, #ec4899 100%)',
      backgroundSize: '100% 100%',
    },
  },
  {
    id: 'paper-texture',
    name: 'Paper Texture',
    style: {
      background: '#faf9f6',
      backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0,0,0,0.08) 1px, transparent 0), repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.02) 2px, rgba(0,0,0,0.02) 4px), repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.02) 2px, rgba(0,0,0,0.02) 4px)`,
      backgroundSize: '8px 8px, 32px 32px, 32px 32px',
    },
  },
  {
    id: 'diagonal-stripes',
    name: 'Diagonal Stripes',
    style: {
      background: 'white',
      backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 0px, rgb(243, 244, 246) 1px, rgb(243, 244, 246) 13px)'
    },
  },
  {
    id: 'diagonal-grid-light',
    name: 'Diagonal Grid Light',
    style: {
      background: '#fafafa',
      color: '#111827',
      backgroundImage: `repeating-linear-gradient(45deg, rgba(0, 0, 0, 0.1) 0, rgba(0, 0, 0, 0.1) 1px, transparent 1px, transparent 20px), repeating-linear-gradient(-45deg, rgba(0, 0, 0, 0.1) 0, rgba(0, 0, 0, 0.1) 1px, transparent 1px, transparent 20px)`,
      backgroundSize: '40px 40px'
    },
  },
  {
    id: 'zigzag-light',
    name: 'Zigzag Light',
    style: {
      background: 'white',
      color: '#1f2937',
      backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 20px, rgba(75, 85, 99, 0.08) 20px, rgba(75, 85, 99, 0.08) 21px), repeating-linear-gradient(90deg, transparent, transparent 30px, rgba(107, 114, 128, 0.06) 30px, rgba(107, 114, 128, 0.06) 31px), repeating-linear-gradient(60deg, transparent, transparent 40px, rgba(55, 65, 81, 0.05) 40px, rgba(55, 65, 81, 0.05) 41px), repeating-linear-gradient(150deg, transparent, transparent 35px, rgba(31, 41, 55, 0.04) 35px, rgba(31, 41, 55, 0.04) 36px)`
    },
  },
  {
    id: 'circuit-board',
    name: 'Circuit Board',
    style: {
      background: 'white',
      color: '#1f2937',
      backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 19px, rgba(75, 85, 99, 0.08) 19px, rgba(75, 85, 99, 0.08) 20px, transparent 20px, transparent 39px, rgba(75, 85, 99, 0.08) 39px, rgba(75, 85, 99, 0.08) 40px), repeating-linear-gradient(90deg, transparent, transparent 19px, rgba(75, 85, 99, 0.08) 19px, rgba(75, 85, 99, 0.08) 20px, transparent 20px, transparent 39px, rgba(75, 85, 99, 0.08) 39px, rgba(75, 85, 99, 0.08) 40px), radial-gradient(circle at 20px 20px, rgba(55, 65, 81, 0.12) 2px, transparent 2px), radial-gradient(circle at 40px 40px, rgba(55, 65, 81, 0.12) 2px, transparent 2px)` ,
      backgroundSize: '40px 40px, 40px 40px, 40px 40px, 40px 40px'
    },
  },
  {
    id: 'noise-dots-dark',
    name: 'Noise Dots (Dark)',
    style: {
      background: 'white',
      backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0, 0, 0, 0.35) 1px, transparent 0)',
      backgroundSize: '20px 20px',
    },
  },
  {
    id: 'grid-40',
    name: 'Grid 40px',
    style: {
      background: 'white',
      backgroundImage: `
        linear-gradient(to right, #e5e7eb 1px, transparent 1px),
        linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
      `,
      backgroundSize: '40px 40px',
    },
  },
  {
    id: 'magenta-orb-grid',
    name: 'Magenta Orb Grid',
    style: {
      background: 'white',
      backgroundImage: `
        linear-gradient(to right, rgba(71,85,105,0.15) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(71,85,105,0.15) 1px, transparent 1px),
        radial-gradient(circle at 50% 60%, rgba(236,72,153,0.15) 0%, rgba(168,85,247,0.05) 40%, transparent 70%)
      `,
      backgroundSize: '40px 40px, 40px 40px, 100% 100%'
    },
  },
  {
    id: 'dark-dotted-grid',
    name: 'Dark Dotted Grid',
    style: {
      background: '#0f172a',
      backgroundImage: `
        radial-gradient(circle, rgba(139,92,246,0.6) 1px, transparent 1px),
        radial-gradient(circle, rgba(59,130,246,0.4) 1px, transparent 1px),
        radial-gradient(circle, rgba(236,72,153,0.5) 1px, transparent 1px)
      `,
      backgroundSize: '20px 20px, 40px 40px, 60px 60px',
      backgroundPosition: '0 0, 10px 10px, 30px 30px',
    },
  },
  {
    id: 'multidot-color',
    name: 'Color Dot Cluster',
    style: {
      background: 'white',
      backgroundImage: `
        radial-gradient(circle, rgba(236,72,153,0.5) 6px, transparent 7px),
        radial-gradient(circle, rgba(59,130,246,0.5) 6px, transparent 7px),
        radial-gradient(circle, rgba(16,185,129,0.5) 6px, transparent 7px),
        radial-gradient(circle, rgba(245,158,11,0.5) 6px, transparent 7px)
      `,
      backgroundSize: '60px 60px',
      backgroundPosition: '0 0, 30px 30px, 30px 0, 0 30px',
    },
  },
  {
    id: 'pastel-check-1',
    name: 'Pastel Check A',
    style: {
      background: '#fdfdfd',
      backgroundImage: `
        linear-gradient(45deg, rgba(139,92,246,0.15) 25%, transparent 25%),
        linear-gradient(-45deg, rgba(236,72,153,0.15) 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, rgba(59,130,246,0.15) 75%),
        linear-gradient(-45deg, transparent 75%, rgba(16,185,129,0.15) 75%)
      `,
      backgroundSize: '40px 40px',
      backgroundPosition: '0 0, 0 20px, 20px -20px, -20px 0px',
    },
  },
  {
    id: 'pastel-check-2',
    name: 'Pastel Check B',
    style: {
      background: 'white',
      backgroundImage: `
        linear-gradient(45deg, rgba(139,92,246,0.15) 25%, transparent 25%),
        linear-gradient(-45deg, rgba(16,185,129,0.15) 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, rgba(236,72,153,0.15) 75%),
        linear-gradient(-45deg, transparent 75%, rgba(59,130,246,0.15) 75%)
      `,
      backgroundSize: '40px 40px',
      backgroundPosition: '0 0, 0 20px, 20px -20px, -20px 0px',
    },
  },
  {
    id: 'subtle-radial-multiply',
    name: 'Subtle Radial Multiply',
    style: {
      background: '#fafafa',
      backgroundImage: `
        repeating-radial-gradient(
          circle at 0 0,
          rgba(0,0,0,0.06) 0 0.7px,
          transparent 0.7px 6px
        ),
        repeating-radial-gradient(
          circle at 100% 100%,
          rgba(0,0,0,0.03) 0 0.6px,
          transparent 0.6px 5px
        )
      `,
      mixBlendMode: 'multiply',
    },
  },
  {
    id: 'conic-accent',
    name: 'Conic Accent',
    style: {
      background: 'white',
      backgroundImage: `conic-gradient(at 2px 50%, rgba(99,102,241,0.28) 75%, transparent 0)` ,
      backgroundSize: '56px 12px',
      backgroundPosition: '0 0',
    },
  },
  {
    id: 'soft-orbs',
    name: 'Soft Pastel Orbs',
    style: {
      background: '#fffafc',
      backgroundImage: `
        radial-gradient(circle at 10% 20%, rgba(255,182,193,0.4) 6px, transparent 0),
        radial-gradient(circle at 80% 30%, rgba(173,216,230,0.4) 8px, transparent 0),
        radial-gradient(circle at 40% 70%, rgba(255,223,186,0.5) 10px, transparent 0),
        radial-gradient(circle at 70% 80%, rgba(186,255,201,0.4) 7px, transparent 0)
      `,
    },
  },
];

interface BackgroundCustomizerProps {
  selectedBgId: string | null;
  onSelectBackground: (bgId: string | null) => void;
  onClose: () => void;
}

const BackgroundCustomizer: React.FC<BackgroundCustomizerProps> = ({
  selectedBgId,
  onSelectBackground,
  onClose,
}) => {
  return (
    <div className="bg-customizer-overlay" onClick={onClose}>
      <div className="bg-customizer-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-customizer-header">
          <div className="bg-customizer-title-block">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span className="bg-customizer-title">Background</span>
          </div>
          <button className="bg-customizer-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Description */}
        <p className="bg-customizer-desc">
          Choose a background style for your chat view. This only affects your display.
        </p>

        {/* Background Grid */}
        <div className="bg-customizer-grid">
          {/* No Background Option */}
          <button
            className={`bg-customizer-option${selectedBgId === null ? ' selected' : ''}`}
            onClick={() => onSelectBackground(null)}
            title="Default (no background)"
          >
            <div className="bg-preview bg-preview-none">
              <span className="bg-preview-label-small">Default</span>
            </div>
          </button>

          {/* Background Options */}
          {BACKGROUND_OPTIONS.map((bg) => (
            <button
              key={bg.id}
              className={`bg-customizer-option${selectedBgId === bg.id ? ' selected' : ''}`}
              onClick={() => onSelectBackground(bg.id)}
              title={bg.name}
            >
              <div className="bg-preview" style={bg.style}>
                <span className="bg-preview-label">{bg.name}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="bg-customizer-footer">
          <p className="bg-customizer-footer-text">Changes are saved locally and visible only to you</p>
        </div>
      </div>
    </div>
  );
};

export default BackgroundCustomizer;
