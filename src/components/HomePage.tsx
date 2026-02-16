import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../providers/auth';
import { Logo } from './Logo';
import ProfileAvatar from './ProfileAvatar';
import LoginPage from './LoginPage';
import ChatRoom from './ChatRoom';
import { createRoom, joinRoomByCode, sendMessage } from '../lib/rooms';
import type { Room } from '../lib/rooms';
import './HomePage.css';

type View = 'home' | 'chat';

export const HomePage: React.FC = () => {
  const { user, isAnonymous, signOut } = useAuth();
  const [showLoginUpgrade, setShowLoginUpgrade] = useState(false);
  const [activeView, setActiveView] = useState<View>('home');
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [roomError, setRoomError] = useState('');
  const [showJoinModal, setShowJoinModal] = useState(false);
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

  // ── Create a new room ────────────────────────
  const handleCreateRoom = async () => {
    if (!user?.id || isCreating) return;
    setIsCreating(true);
    setRoomError('');
    try {
      const room = await createRoom(user.id);
      // Auto-join as participant
      await joinRoomByCode(room.code, user.id, displayName);
      // Send system message
      await sendMessage(room.id, user.id, displayName, `${displayName} created the room`, 'system');
      setActiveRoom(room);
      setActiveView('chat');
    } catch (err: unknown) {
      setRoomError(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setIsCreating(false);
    }
  };

  // ── Join an existing room by code ────────────
  const handleJoinRoom = async () => {
    if (!user?.id || !joinCode.trim() || isJoining) return;
    setIsJoining(true);
    setRoomError('');
    console.log('[HomePage] Attempting to join room:', joinCode.trim(), 'user:', user.id);
    try {
      const { room } = await joinRoomByCode(joinCode.trim(), user.id, displayName);
      console.log('[HomePage] Successfully joined room:', room);
      await sendMessage(room.id, user.id, displayName, `${displayName} joined the room`, 'system');
      setActiveRoom(room);
      setActiveView('chat');
      setShowJoinModal(false);
      setJoinCode('');
    } catch (err: unknown) {
      console.error('[HomePage] Failed to join room:', err);
      setRoomError(err instanceof Error ? err.message : 'Failed to join room');
    } finally {
      setIsJoining(false);
    }
  };

  // ── Leave room callback ──────────────────────
  const handleLeaveRoom = () => {
    setActiveRoom(null);
    setActiveView('home');
  };

  // Show login page for account upgrade
  if (showLoginUpgrade) {
    return <LoginPage onBack={() => setShowLoginUpgrade(false)} hideGuestTab />;
  }

  // Show ChatRoom when active
  if (activeView === 'chat' && activeRoom) {
    return <ChatRoom room={activeRoom} onLeave={handleLeaveRoom} />;
  }

  return (
    <div className="home-page">

      {/* ── Join Room Modal ── */}
      {showJoinModal && (
        <div className="home-modal-overlay" onClick={() => { setShowJoinModal(false); setRoomError(''); }}>
          <div className="home-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="home-modal-title">Join a Room</h2>
            <p className="home-modal-subtitle">Enter the 6-character room code shared with you</p>

            <input
              className="home-modal-input"
              type="text"
              placeholder="e.g. A3BK7N"
              maxLength={6}
              value={joinCode}
              onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setRoomError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
              autoFocus
            />

            {roomError && <p className="home-modal-error">{roomError}</p>}

            <div className="home-modal-actions">
              <button className="home-modal-cancel" onClick={() => { setShowJoinModal(false); setRoomError(''); }}>
                Cancel
              </button>
              <button
                className="home-modal-confirm"
                onClick={handleJoinRoom}
                disabled={joinCode.trim().length < 4 || isJoining}
              >
                {isJoining ? 'Joining…' : 'Join Room'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <header className="home-header">
        <div className="home-header-left">
          <Logo />
        </div>
        <nav className="home-nav">
          <button
            className={`home-nav-link ${activeView === 'home' ? 'active' : ''}`}
            onClick={() => setActiveView('home')}
          >
            Home
          </button>
          <button className="home-nav-link" onClick={handleCreateRoom} disabled={isCreating}>
            {isCreating ? 'Creating…' : 'New Chat'}
          </button>
          <button className="home-nav-link" onClick={() => setShowJoinModal(true)}>
            Join Room
          </button>
        </nav>
        <div className="home-header-right">
          {/* Settings icon */}
          <button className="home-header-icon-btn" aria-label="Settings" title="Settings">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          {/* Find People icon */}
          <button className="home-header-icon-btn" aria-label="Find People" title="Find People">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </button>
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

        {roomError && !showJoinModal && (
          <div className="home-error-banner">
            <span>{roomError}</span>
            <button onClick={() => setRoomError('')}>×</button>
          </div>
        )}

        <div className="home-grid">
          {/* Chat — always available */}
          <div className="home-card" onClick={handleCreateRoom}>
            <div className="home-card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h3>{isCreating ? 'Creating…' : 'Start a Chat'}</h3>
            <p>Create a room and share the code to chat in real time</p>
          </div>

          {/* Join Room — always available */}
          <div className="home-card" onClick={() => setShowJoinModal(true)}>
            <div className="home-card-icon home-card-icon-join">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
            </div>
            <h3>Join a Room</h3>
            <p>Enter a room code to join someone's conversation</p>
          </div>

          {/* Voice Call — locked for guests */}
          <div
            className={`home-card${isAnonymous ? ' home-card-locked' : ''}`}
            onClick={() => {
              if (isAnonymous) { setShowLoginUpgrade(true); return; }
              handleCreateRoom();
            }}
          >
            {isAnonymous && <span className="home-card-badge">Sign up required</span>}
            <div className="home-card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </div>
            <h3>Voice Call</h3>
            <p>{isAnonymous ? 'Create an account to make voice calls' : 'Create a room and start a voice call'}</p>
          </div>

          {/* Video Call — locked for guests */}
          <div
            className={`home-card${isAnonymous ? ' home-card-locked' : ''}`}
            onClick={() => {
              if (isAnonymous) { setShowLoginUpgrade(true); return; }
              handleCreateRoom();
            }}
          >
            {isAnonymous && <span className="home-card-badge">Sign up required</span>}
            <div className="home-card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            </div>
            <h3>Video Call</h3>
            <p>{isAnonymous ? 'Create an account to make video calls' : 'Create a room and start a video call'}</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default HomePage;
