import React, { useState } from 'react';
import styled from 'styled-components';

interface SocialLinkProps {
  href: string;
  label: string;
  icon: React.ReactNode;
  description?: string;
}

const SocialLink: React.FC<SocialLinkProps> = ({ href, label, icon, description }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <StyledSocialWrapper
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <a
        href={href}
        aria-label={label}
        className="social-btn"
        target="_blank"
        rel="noopener noreferrer"
      >
        {icon}
      </a>
      {isHovered && (
        <div className="social-preview">
          <div className="social-preview-label">{label}</div>
          {description && <div className="social-preview-desc">{description}</div>}
        </div>
      )}
    </StyledSocialWrapper>
  );
};

const StyledSocialWrapper = styled.div`
  position: relative;
  display: inline-block;

  .social-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    color: rgb(255, 255, 255);
    text-decoration: none;
    transition: all 0.3s ease;
    cursor: pointer;

    svg {
      width: 100%;
      height: 100%;
      transition: all 0.3s ease;
    }

    &:hover svg {
      transform: scale(1.15);
      filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.4));
    }
  }

  .social-preview {
    position: absolute;
    bottom: calc(100% + 12px);
    left: 50%;
    transform: translateX(-50%);
    background: rgba(255, 255, 255, 0.95);
    color: #000;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 500;
    white-space: nowrap;
    z-index: 1000;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    animation: slideUp 0.2s ease;
    pointer-events: none;
    letter-spacing: 0.5px;

    &::after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-top: 5px solid rgba(255, 255, 255, 0.95);
    }
  }

  .social-preview-label {
    font-weight: 600;
    margin-bottom: 2px;
  }

  .social-preview-desc {
    font-size: 0.7rem;
    opacity: 0.7;
    font-weight: 400;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }
`;

export default SocialLink;
