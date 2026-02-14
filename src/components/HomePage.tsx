import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../providers/auth';
import { Logo } from './Logo';
import ProfileAvatar from './ProfileAvatar';
import LoginPage from './LoginPage';
import FloatingLines from './FloatingLines';
import './HomePage.css';

export const HomePage: React.FC = () => {
  const { user, isAnonymous, signOut } = useAuth();
  const [showLoginUpgrade, setShowLoginUpgrade] = useState(false);
  const prevUserIdRef = useRef(user?.id);

  // Close upgrade login when user identity changes (successful login/signup)
  useEffect(() => {
    if (user?.id && user.id !== prevUserIdRef.current) {
      setShowLoginUpgrade(false);
    }
    prevUserIdRef.current = user?.id;
  }, [user?.id]);

  const displayName = isAnonymous
    ? 'Guest'
    : user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      user?.user_metadata?.username ||
      user?.email?.split('@')[0] ||
      'User';

  const background = useMemo(
    () => (
      <FloatingLines
        enabledWaves={["top", "middle", "bottom"]}
        lineCount={5}
        lineDistance={5}
        bendRadius={5}
        bendStrength={-0.5}
        interactive={true}
        parallax={true}
        mixBlendMode="screen"
      />
    ),
    []
  );

  // Show login page for account upgrade
  if (showLoginUpgrade) {
    return <LoginPage onBack={() => setShowLoginUpgrade(false)} hideGuestTab />;
  }

  return (
    <div className="home-page">
      {/* Background */}
      <div className="home-background">{background}</div>

      {/* Top bar */}
      <header className="home-header">
        <div className="home-header-left">
          <Logo />
        </div>
        <nav className="home-nav">
          <a href="#" className="home-nav-link active">Home</a>
          <a href="#" className="home-nav-link">Chat</a>
          <a href="#" className="home-nav-link">Explore</a>
        </nav>
        <div className="home-header-right">
          <ProfileAvatar />
        </div>
      </header>

      {/* Main content */}
      <main className="home-main">
        <div className="home-welcome-card">
          <h1 className="home-welcome-title">
            Welcome back, <span className="home-welcome-name">{displayName}</span>
          </h1>
          <p className="home-welcome-subtitle">
            {isAnonymous
              ? "You're browsing as a guest. Chat is available — sign up to unlock audio & video calls."
              : "What would you like to do today?"}
          </p>
          {isAnonymous && (
            <div className="home-guest-banner">
              <span>Want the full experience?</span>
              <button
                className="home-guest-banner-btn"
                onClick={async () => {
                  await signOut();
                  setShowLoginUpgrade(true);
                }}
              >
                Create an Account
              </button>
            </div>
          )}
        </div>

        <div className="home-grid">
          {/* Chat — always available */}
          <div className="home-card">
            <div className="home-card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h3>Start a Chat</h3>
            <p>Begin a new conversation with others</p>
          </div>

          {/* Voice Call — locked for guests */}
          <div
            className={`home-card${isAnonymous ? ' home-card-locked' : ''}`}
            onClick={() => isAnonymous && setShowLoginUpgrade(true)}
          >
            {isAnonymous && <span className="home-card-badge">Sign up required</span>}
            <div className="home-card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </div>
            <h3>Voice Call</h3>
            <p>{isAnonymous ? 'Create an account to make voice calls' : 'Start a voice call with your contacts'}</p>
          </div>

          {/* Video Call — locked for guests */}
          <div
            className={`home-card${isAnonymous ? ' home-card-locked' : ''}`}
            onClick={() => isAnonymous && setShowLoginUpgrade(true)}
          >
            {isAnonymous && <span className="home-card-badge">Sign up required</span>}
            <div className="home-card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            </div>
            <h3>Video Call</h3>
            <p>{isAnonymous ? 'Create an account to make video calls' : 'Start a video call with your contacts'}</p>
          </div>

          {/* Find People — always available */}
          <div className="home-card">
            <div className="home-card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h3>Find People</h3>
            <p>Discover and connect with new people</p>
          </div>

          {/* Settings */}
          <div className="home-card">
            <div className="home-card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </div>
            <h3>Settings</h3>
            <p>Customize your Verbose experience</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default HomePage;
