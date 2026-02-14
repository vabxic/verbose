import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../providers/auth';
import './ProfileAvatar.css';

export const ProfileAvatar: React.FC = () => {
  const { user, isAnonymous, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const displayName = isAnonymous
    ? 'Guest'
    : user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      user?.user_metadata?.username ||
      user?.email ||
      'User';
  const displayEmail = user?.email || (isAnonymous ? 'Anonymous' : '');

  const handleSignOut = async () => {
    setMenuOpen(false);
    try {
      await signOut();
    } catch (err) {
      console.error('Sign out failed:', err);
    }
  };

  return (
    <div className="profile-avatar-wrapper" ref={menuRef}>
      <button
        className="profile-avatar-btn"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Profile menu"
      >
        {avatarUrl && !isAnonymous ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="profile-avatar-img"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="profile-avatar-fallback">
            {isAnonymous ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            ) : (
              <span>{(displayName[0] || 'U').toUpperCase()}</span>
            )}
          </div>
        )}
      </button>

      {menuOpen && (
        <div className="profile-dropdown">
          <div className="profile-dropdown-header">
            {avatarUrl && !isAnonymous ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="profile-dropdown-img"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="profile-dropdown-fallback">
                {isAnonymous ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                ) : (
                  <span>{(displayName[0] || 'U').toUpperCase()}</span>
                )}
              </div>
            )}
            <div className="profile-dropdown-info">
              <span className="profile-dropdown-name">{displayName}</span>
              {displayEmail && (
                <span className="profile-dropdown-email">{displayEmail}</span>
              )}
            </div>
          </div>
          <div className="profile-dropdown-divider" />
          <button className="profile-dropdown-item" onClick={handleSignOut}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
};

export default ProfileAvatar;
