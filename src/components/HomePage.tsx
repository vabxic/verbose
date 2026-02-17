import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../providers/auth';
import { Logo } from './Logo';
import ProfileAvatar from './ProfileAvatar';
import LoginPage from './LoginPage';
import ChatRoom from './ChatRoom';
import BackgroundHome from './background_home';
import { createRoom, joinRoomByCode, sendMessage } from '../lib/rooms';
import type { Room } from '../lib/rooms';
import {
  getSavedRooms,
  unsaveRoom,
  getIncomingFriendRequests,
  getOutgoingFriendRequests,
  getFriends,
  acceptFriendRequest,
  rejectFriendRequest,
  deleteFriendRequest,
  getPendingRequestCount,
  subscribeToFriendRequests,
} from '../lib/social';
import type { SavedRoom, FriendRequest } from '../lib/social';
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

  // Saved rooms state
  const [savedRooms, setSavedRooms] = useState<(SavedRoom & { room: Room })[]>([]);
  const [, setLoadingSavedRooms] = useState(false);

  // Find People / friend requests state
  const [showFindPeople, setShowFindPeople] = useState(false);
  const [findPeopleTab, setFindPeopleTab] = useState<'incoming' | 'outgoing' | 'friends'>('incoming');
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<FriendRequest[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [processingReqId, setProcessingReqId] = useState<string | null>(null);

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

  // ── Load saved rooms ─────────────────────────
  const loadSavedRooms = useCallback(async () => {
    if (!user?.id || isAnonymous) return;
    setLoadingSavedRooms(true);
    try {
      const rooms = await getSavedRooms(user.id);
      setSavedRooms(rooms);
    } catch (err) {
      console.error('[HomePage] Failed to load saved rooms:', err);
    } finally {
      setLoadingSavedRooms(false);
    }
  }, [user?.id, isAnonymous]);

  useEffect(() => {
    loadSavedRooms();
  }, [loadSavedRooms]);

  // Refresh saved rooms when returning from chat
  useEffect(() => {
    if (activeView === 'home') {
      loadSavedRooms();
    }
  }, [activeView, loadSavedRooms]);

  // ── Load friend requests & subscribe ─────────
  const loadFriendData = useCallback(async () => {
    if (!user?.id || isAnonymous) return;
    setLoadingFriends(true);
    try {
      const [incoming, outgoing, friendsList, count] = await Promise.all([
        getIncomingFriendRequests(user.id),
        getOutgoingFriendRequests(user.id),
        getFriends(user.id),
        getPendingRequestCount(user.id),
      ]);
      setIncomingRequests(incoming);
      setOutgoingRequests(outgoing);
      setFriends(friendsList);
      setPendingCount(count);
    } catch (err) {
      console.error('[HomePage] Failed to load friend data:', err);
    } finally {
      setLoadingFriends(false);
    }
  }, [user?.id, isAnonymous]);

  useEffect(() => {
    loadFriendData();
  }, [loadFriendData]);

  // Subscribe to realtime friend request changes
  useEffect(() => {
    if (!user?.id || isAnonymous) return;
    const unsub = subscribeToFriendRequests(user.id, () => {
      loadFriendData();
    });
    return unsub;
  }, [user?.id, isAnonymous, loadFriendData]);

  // ── Friend request handlers ──────────────────
  const handleAcceptRequest = async (reqId: string) => {
    setProcessingReqId(reqId);
    try {
      await acceptFriendRequest(reqId);
      await loadFriendData();
    } catch (err) {
      console.error('[HomePage] Failed to accept request:', err);
    } finally {
      setProcessingReqId(null);
    }
  };

  const handleRejectRequest = async (reqId: string) => {
    setProcessingReqId(reqId);
    try {
      await rejectFriendRequest(reqId);
      await loadFriendData();
    } catch (err) {
      console.error('[HomePage] Failed to reject request:', err);
    } finally {
      setProcessingReqId(null);
    }
  };

  const handleCancelRequest = async (reqId: string) => {
    setProcessingReqId(reqId);
    try {
      await deleteFriendRequest(reqId);
      await loadFriendData();
    } catch (err) {
      console.error('[HomePage] Failed to cancel request:', err);
    } finally {
      setProcessingReqId(null);
    }
  };

  const handleRemoveSavedRoom = async (roomId: string) => {
    if (!user?.id) return;
    try {
      await unsaveRoom(user.id, roomId);
      setSavedRooms((prev) => prev.filter((sr) => sr.room_id !== roomId));
    } catch (err) {
      console.error('[HomePage] Failed to remove saved room:', err);
    }
  };

  const handleJoinSavedRoom = async (room: Room) => {
    if (!user?.id || isJoining) return;
    setIsJoining(true);
    setRoomError('');
    try {
      const { room: joinedRoom } = await joinRoomByCode(room.code, user.id, displayName);
      await sendMessage(joinedRoom.id, user.id, displayName, `${displayName} joined the room`, 'system');
      setActiveRoom(joinedRoom);
      setActiveView('chat');
    } catch (err: unknown) {
      setRoomError(err instanceof Error ? err.message : 'Room is no longer active');
    } finally {
      setIsJoining(false);
    }
  };

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
          <button className="home-header-icon-btn home-find-people-header-btn" aria-label="Find People" title="Find People" onClick={() => { setShowFindPeople(true); loadFriendData(); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            {pendingCount > 0 && (
              <span className="home-notification-badge">{pendingCount}</span>
            )}
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

        {/* ── Saved Rooms Section ── */}
        {!isAnonymous && savedRooms.length > 0 && (
          <div className="home-saved-rooms">
            <h2 className="home-saved-rooms-title">
              <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              Saved Rooms
            </h2>
            <div className="home-saved-rooms-grid">
              {savedRooms.map((sr) => (
                <div key={sr.id} className="home-saved-room-card">
                  <div className="home-saved-room-info" onClick={() => handleJoinSavedRoom(sr.room)}>
                    <h4 className="home-saved-room-name">{sr.room?.name || `Room ${sr.room?.code}`}</h4>
                    <span className="home-saved-room-code">{sr.room?.code}</span>
                    <span className={`home-saved-room-status ${sr.room?.is_active ? 'active' : 'inactive'}`}>
                      {sr.room?.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <button
                    className="home-saved-room-remove"
                    onClick={(e) => { e.stopPropagation(); handleRemoveSavedRoom(sr.room_id); }}
                    title="Remove saved room"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ── Find People Panel ── */}
      {showFindPeople && (
        <div className="home-find-people-overlay" onClick={() => setShowFindPeople(false)}>
          <div className="home-find-people-panel" onClick={(e) => e.stopPropagation()}>
            <div className="home-find-people-header">
              <h2>Find People</h2>
              <button className="home-find-people-close" onClick={() => setShowFindPeople(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="home-find-people-tabs">
              <button
                className={`home-find-people-tab${findPeopleTab === 'incoming' ? ' active' : ''}`}
                onClick={() => setFindPeopleTab('incoming')}
              >
                Incoming
                {pendingCount > 0 && <span className="home-find-people-tab-badge">{pendingCount}</span>}
              </button>
              <button
                className={`home-find-people-tab${findPeopleTab === 'outgoing' ? ' active' : ''}`}
                onClick={() => setFindPeopleTab('outgoing')}
              >
                Sent
              </button>
              <button
                className={`home-find-people-tab${findPeopleTab === 'friends' ? ' active' : ''}`}
                onClick={() => setFindPeopleTab('friends')}
              >
                Friends
              </button>
            </div>

            <div className="home-find-people-content">
              {loadingFriends && (
                <div className="home-find-people-loading">Loading…</div>
              )}

              {/* Incoming Requests */}
              {findPeopleTab === 'incoming' && !loadingFriends && (
                <>
                  {incomingRequests.length === 0 ? (
                    <div className="home-find-people-empty">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="32" height="32">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="8.5" cy="7" r="4" />
                        <line x1="20" y1="8" x2="20" y2="14" />
                        <line x1="23" y1="11" x2="17" y2="11" />
                      </svg>
                      <p>No pending friend requests</p>
                    </div>
                  ) : (
                    incomingRequests.map((req) => (
                      <div key={req.id} className="home-find-people-request">
                        <div className="home-find-people-req-avatar">
                          {(req.sender_name || 'U')[0].toUpperCase()}
                        </div>
                        <div className="home-find-people-req-info">
                          <span className="home-find-people-req-name">{req.sender_name || 'User'}</span>
                          <span className="home-find-people-req-time">
                            {new Date(req.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="home-find-people-req-actions">
                          <button
                            className="home-find-people-accept-btn"
                            onClick={() => handleAcceptRequest(req.id)}
                            disabled={processingReqId === req.id}
                          >
                            {processingReqId === req.id ? '…' : 'Accept'}
                          </button>
                          <button
                            className="home-find-people-reject-btn"
                            onClick={() => handleRejectRequest(req.id)}
                            disabled={processingReqId === req.id}
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}

              {/* Outgoing Requests */}
              {findPeopleTab === 'outgoing' && !loadingFriends && (
                <>
                  {outgoingRequests.length === 0 ? (
                    <div className="home-find-people-empty">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="32" height="32">
                        <path d="M22 2L11 13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                      <p>No pending sent requests</p>
                    </div>
                  ) : (
                    outgoingRequests.map((req) => (
                      <div key={req.id} className="home-find-people-request">
                        <div className="home-find-people-req-avatar">
                          {(req.receiver_name || 'U')[0].toUpperCase()}
                        </div>
                        <div className="home-find-people-req-info">
                          <span className="home-find-people-req-name">{req.receiver_name || 'User'}</span>
                          <span className="home-find-people-req-time">Pending</span>
                        </div>
                        <div className="home-find-people-req-actions">
                          <button
                            className="home-find-people-cancel-btn"
                            onClick={() => handleCancelRequest(req.id)}
                            disabled={processingReqId === req.id}
                          >
                            {processingReqId === req.id ? '…' : 'Cancel'}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}

              {/* Friends List */}
              {findPeopleTab === 'friends' && !loadingFriends && (
                <>
                  {friends.length === 0 ? (
                    <div className="home-find-people-empty">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="32" height="32">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                      <p>No friends yet. Send requests from a chat room!</p>
                    </div>
                  ) : (
                    friends.map((f) => {
                      const friendName = f.sender_id === user?.id ? f.receiver_name : f.sender_name;
                      return (
                        <div key={f.id} className="home-find-people-request home-find-people-friend">
                          <div className="home-find-people-req-avatar friend">
                            {(friendName || 'U')[0].toUpperCase()}
                          </div>
                          <div className="home-find-people-req-info">
                            <span className="home-find-people-req-name">{friendName || 'User'}</span>
                            <span className="home-find-people-req-time">Friends</span>
                          </div>
                          <div className="home-find-people-req-actions">
                            <button
                              className="home-find-people-remove-btn"
                              onClick={() => handleCancelRequest(f.id)}
                              disabled={processingReqId === f.id}
                              title="Remove friend"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </BackgroundHome>
  );
};

export default HomePage;
