import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../providers/auth';
import {
  sendMessage,
  getMessages,
  getRoomParticipants,
  leaveRoom,
  subscribeToMessages,
  subscribeToParticipants,
} from '../lib/rooms';
import type { Room, RoomMessage, RoomParticipant } from '../lib/rooms';
import { WebRTCService } from '../lib/webrtc';
import type { CallType } from '../lib/webrtc';
import './ChatRoom.css';

interface ChatRoomProps {
  room: Room;
  onLeave: () => void;
}

const ChatRoom: React.FC<ChatRoomProps> = ({ room, onLeave }) => {
  const { user, isAnonymous } = useAuth();
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Call state
  const [inCall, setInCall] = useState(false);
  const [callType, setCallType] = useState<CallType>('audio');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState | ''>('');
  const [showCopied, setShowCopied] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const webrtcRef = useRef<WebRTCService | null>(null);

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.user_metadata?.username ||
    user?.email?.split('@')[0] ||
    'Guest';

  // ── Load initial data ─────────────────────────
  useEffect(() => {
    if (!room.id || !user?.id) return;

    (async () => {
      const [msgs, parts] = await Promise.all([
        getMessages(room.id),
        getRoomParticipants(room.id),
      ]);
      setMessages(msgs);
      setParticipants(parts);
    })();
  }, [room.id, user?.id]);

  // ── Subscribe to realtime ─────────────────────
  useEffect(() => {
    if (!room.id || !user?.id) return;

    const unsubMessages = subscribeToMessages(room.id, (msg) => {
      setMessages((prev) => {
        // Deduplicate
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    const unsubParticipants = subscribeToParticipants(room.id, (parts) => {
      setParticipants(parts);
    });

    return () => {
      unsubMessages();
      unsubParticipants();
    };
  }, [room.id, user?.id]);

  // ── Start signaling listener on mount ─────────
  useEffect(() => {
    if (!room.id || !user?.id) return;

    const rtc = new WebRTCService(room.id, user.id, {
      onRemoteStream: (stream) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        }
        setInCall(true);
      },
      onCallEnded: () => {
        setInCall(false);
        setConnectionState('');
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
      },
      onConnectionStateChange: (state) => {
        setConnectionState(state);
      },
    });

    rtc.startSignaling();
    webrtcRef.current = rtc;

    return () => {
      rtc.cleanup();
      webrtcRef.current = null;
    };
  }, [room.id, user?.id]);

  // ── Auto-scroll messages ──────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Send text message ─────────────────────────
  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || !user?.id || isSending) return;
    setIsSending(true);
    try {
      await sendMessage(room.id, user.id, displayName, inputValue.trim());
      setInputValue('');
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setIsSending(false);
    }
  }, [inputValue, user?.id, room.id, displayName, isSending]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // ── Call controls ─────────────────────────────
  const startCall = async (type: CallType) => {
    if (isAnonymous) return;
    setCallType(type);
    try {
      const stream = await webrtcRef.current?.getLocalStream(type);
      if (stream && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      await webrtcRef.current?.startCall(type);
      setInCall(true);
    } catch (err) {
      console.error('Failed to start call:', err);
    }
  };

  const hangUp = async () => {
    await webrtcRef.current?.hangUp();
    setInCall(false);
    setConnectionState('');
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  };

  const toggleAudio = () => {
    const next = !audioEnabled;
    setAudioEnabled(next);
    webrtcRef.current?.toggleAudio(next);
  };

  const toggleVideo = () => {
    const next = !videoEnabled;
    setVideoEnabled(next);
    webrtcRef.current?.toggleVideo(next);
  };

  // ── Leave room ────────────────────────────────
  const handleLeave = async () => {
    if (inCall) await hangUp();
    if (user?.id) await leaveRoom(room.id, user.id);
    onLeave();
  };

  // ── Copy room code ────────────────────────────
  const copyCode = () => {
    navigator.clipboard.writeText(room.code);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  // ── Format timestamp ──────────────────────────
  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="chatroom">
      {/* ── Header ─────────────────────── */}
      <header className="chatroom-header">
        <div className="chatroom-header-left">
          <button className="chatroom-back-btn" onClick={handleLeave} title="Leave room">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="chatroom-room-info">
            <h2 className="chatroom-room-name">{room.name || `Room ${room.code}`}</h2>
            <span className="chatroom-participant-count">
              {participants.length} participant{participants.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div className="chatroom-header-actions">
          {/* Room code badge */}
          <button className="chatroom-code-badge" onClick={copyCode} title="Copy room code">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            <span>{room.code}</span>
            {showCopied && <span className="chatroom-copied-toast">Copied!</span>}
          </button>

          {/* Call buttons (disabled for guests) */}
          {!inCall && (
            <>
              <button
                className={`chatroom-action-btn${isAnonymous ? ' disabled' : ''}`}
                onClick={() => startCall('audio')}
                disabled={isAnonymous}
                title={isAnonymous ? 'Sign up for voice calls' : 'Voice call'}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </button>
              <button
                className={`chatroom-action-btn${isAnonymous ? ' disabled' : ''}`}
                onClick={() => startCall('video')}
                disabled={isAnonymous}
                title={isAnonymous ? 'Sign up for video calls' : 'Video call'}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
              </button>
            </>
          )}
        </div>
      </header>

      {/* ── Video call overlay ─────────── */}
      {inCall && (
        <div className={`chatroom-call-overlay ${callType}`}>
          <div className="chatroom-call-videos">
            <video
              ref={remoteVideoRef}
              className="chatroom-remote-video"
              autoPlay
              playsInline
            />
            <video
              ref={localVideoRef}
              className="chatroom-local-video"
              autoPlay
              playsInline
              muted
            />
          </div>

          <div className="chatroom-call-status">
            {connectionState === 'connecting' && 'Connecting…'}
            {connectionState === 'connected' && 'Connected'}
            {connectionState === 'disconnected' && 'Reconnecting…'}
          </div>

          <div className="chatroom-call-controls">
            <button
              className={`chatroom-call-btn ${!audioEnabled ? 'off' : ''}`}
              onClick={toggleAudio}
              title={audioEnabled ? 'Mute' : 'Unmute'}
            >
              {audioEnabled ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="1" y1="1" x2="23" y2="23" />
                  <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                  <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .38-.03.75-.08 1.12" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              )}
            </button>

            {callType === 'video' && (
              <button
                className={`chatroom-call-btn ${!videoEnabled ? 'off' : ''}`}
                onClick={toggleVideo}
                title={videoEnabled ? 'Camera off' : 'Camera on'}
              >
                {videoEnabled ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                )}
              </button>
            )}

            <button className="chatroom-call-btn hangup" onClick={hangUp} title="End call">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91" />
                <line x1="23" y1="1" x2="1" y2="23" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Messages ───────────────────── */}
      <div className="chatroom-messages">
        {messages.length === 0 && (
          <div className="chatroom-empty">
            <div className="chatroom-empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p>No messages yet. Start the conversation!</p>
            <p className="chatroom-empty-hint">
              Share code <strong>{room.code}</strong> to invite someone
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const isOwn = msg.sender_id === user?.id;
          const isSystem = msg.type === 'system';

          if (isSystem) {
            return (
              <div key={msg.id} className="chatroom-system-msg">
                {msg.content}
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`chatroom-msg ${isOwn ? 'own' : 'other'}`}
            >
              {!isOwn && (
                <span className="chatroom-msg-sender">{msg.sender_name}</span>
              )}
              <div className="chatroom-msg-bubble">
                <span className="chatroom-msg-text">{msg.content}</span>
                <span className="chatroom-msg-time">{formatTime(msg.created_at)}</span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input bar ──────────────────── */}
      <div className="chatroom-input-bar">
        <textarea
          className="chatroom-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          rows={1}
        />
        <button
          className="chatroom-send-btn"
          onClick={handleSendMessage}
          disabled={!inputValue.trim() || isSending}
          title="Send"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ChatRoom;
