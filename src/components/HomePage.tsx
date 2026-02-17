import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../providers/auth';
import { Logo } from './Logo';
import ProfileAvatar from './ProfileAvatar';
import LoginPage from './LoginPage';
import ChatRoom from './ChatRoom';
import BackgroundHome from './background_home';
import { createRoom, joinRoomByCode, sendMessage } from '../lib/rooms';
import type { Room } from '../lib/rooms';
import './HomePage.css';

type View = 'home' | 'chat';

const SESSION_ROOM_KEY = 'verbose_active_room';

export const HomePage: React.FC = () => {
  const { user, isAnonymous, signOut } = useAuth();
  const [showLoginUpgrade, setShowLoginUpgrade] = useState(false);
  const [activeView, setActiveView] = useState<View>(() => {
    // Restore view from session if a room was previously active
    const saved = sessionStorage.getItem(SESSION_ROOM_KEY);
    return saved ? 'chat' : 'home';
  });
  const [activeRoom, setActiveRoom] = useState<Room | null>(() => {
    // Restore active room from session storage on refresh
    try {
      const saved = sessionStorage.getItem(SESSION_ROOM_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [roomError, setRoomError] = useState('');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const prevUserIdRef = useRef(user?.id);
  const urlJoinAttemptedRef = useRef(false);

  const displayName = isAnonymous
    ? 'Guest'
    : user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      user?.user_metadata?.username ||
      user?.email?.split('@')[0] ||
      'User';

  // Close upgrade login when user identity changes (successful login/signup)
  useEffect(() => {
    if (user?.id && user.id !== prevUserIdRef.current) {
      setShowLoginUpgrade(false);
    }
    prevUserIdRef.current = user?.id;
  }, [user?.id]);

  // Persist active room to sessionStorage so it survives refresh
  useEffect(() => {
    if (activeRoom && activeView === 'chat') {
      sessionStorage.setItem(SESSION_ROOM_KEY, JSON.stringify(activeRoom));
    } else {
      sessionStorage.removeItem(SESSION_ROOM_KEY);
    }
  }, [activeRoom, activeView]);

  // Re-join room after refresh (re-upsert participant so we stay in the room)
  useEffect(() => {
    if (activeRoom && user?.id && activeView === 'chat') {
      joinRoomByCode(activeRoom.code, user.id, displayName).catch((err) => {
        console.warn('[HomePage] Could not re-join room after refresh:', err);
        // Room may have been deactivated by host – go back to home
        setActiveRoom(null);
        setActiveView('home');
        sessionStorage.removeItem(SESSION_ROOM_KEY);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-join from URL ?join=CODE param ──────
  useEffect(() => {
    if (urlJoinAttemptedRef.current || !user?.id || activeRoom) return;
    const params = new URLSearchParams(window.location.search);
    const joinParam = params.get('join');
    if (!joinParam) return;

    urlJoinAttemptedRef.current = true;
    window.history.replaceState({}, '', window.location.pathname);

    (async () => {
      setIsJoining(true);
      try {
        const { room } = await joinRoomByCode(joinParam.trim(), user!.id, displayName);
        await sendMessage(room.id, user!.id, displayName, `${displayName} joined the room`, 'system');
        setActiveRoom(room);
        setActiveView('chat');
      } catch (err: unknown) {
        setRoomError(err instanceof Error ? err.message : 'Invalid or expired invite link');
      } finally {
        setIsJoining(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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
    sessionStorage.removeItem(SESSION_ROOM_KEY);
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
    <BackgroundHome>
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

          {/* (Voice & Video call cards removed) */}
        </div>
      </main>
      </div>
    </BackgroundHome>
  );
};

export default HomePage;
