import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../providers/auth';
import {
  sendMessage,
  getMessages,
  getRoomParticipants,
  leaveRoom,
  subscribeToMessages,
  subscribeToParticipants,
  cleanOldSignals,
} from '../lib/rooms';
import type { Room, RoomMessage, RoomParticipant } from '../lib/rooms';
import { WebRTCService } from '../lib/webrtc';
import type { CallType } from '../lib/webrtc';
import { saveRoom, unsaveRoom, isRoomSaved, sendFriendRequest } from '../lib/social';
import { uploadRoomFile, formatFileSize } from '../lib/drive';
import type { UploadProgress } from '../lib/drive';
import RoomDrive from './RoomDrive';
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
  const [showParticipantsTooltip, setShowParticipantsTooltip] = useState(false);

  // Call state
  const [inCall, setInCall] = useState(false);
  const [callType, setCallType] = useState<CallType>('audio');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState | ''>('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showCopied, setShowCopied] = useState(false);
  const [showLinkCopied, setShowLinkCopied] = useState(false);
  const [incomingCall, setIncomingCall] = useState<{ type: CallType } | null>(null);
  const [lineBusyError, setLineBusyError] = useState(false);

  // Save room state
  const [roomSaved, setRoomSaved] = useState(false);
  const [savingRoom, setSavingRoom] = useState(false);

  // Friend request state
  const [showFriendReqModal, setShowFriendReqModal] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<RoomParticipant | null>(null);
  const [sendingFriendReq, setSendingFriendReq] = useState(false);
  const [friendReqStatus, setFriendReqStatus] = useState<string>('');

  // Drive state
  const [showDrive, setShowDrive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [inlineUploadProgress, setInlineUploadProgress] = useState<UploadProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mobile more-menu state
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const webrtcRef = useRef<WebRTCService | null>(null);
  const callTimerRef = useRef<number | null>(null);

  // Store streams in refs so they persist across renders / DOM changes
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

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
      try {
        console.log('[ChatRoom] Loading initial data for room:', room.id);
        const [msgs, parts] = await Promise.all([
          getMessages(room.id),
          getRoomParticipants(room.id),
        ]);
        console.log('[ChatRoom] Initial messages loaded:', msgs.length, msgs);
        console.log('[ChatRoom] Initial participants loaded:', parts.length, parts);
        setMessages(msgs);
        setParticipants(parts);
      } catch (error) {
        console.error('[ChatRoom] Error loading initial data:', error);
      }
    })();
  }, [room.id, user?.id]);

  // ── Close mobile more-menu on outside click ───
  useEffect(() => {
    if (!showMoreMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMoreMenu]);

  // ── Subscribe to realtime ─────────────────────
  useEffect(() => {
    if (!room.id || !user?.id) return;

    console.log('[ChatRoom] Setting up realtime subscriptions for room:', room.id);

    const unsubMessages = subscribeToMessages(room.id, (msg) => {
      console.log('[ChatRoom] Received realtime message:', msg);

      setMessages((prev) => {
        // Deduplicate
        if (prev.some((m) => m.id === msg.id)) {
          console.log('[ChatRoom] Message already exists, skipping:', msg.id);
          return prev;
        }
        console.log('[ChatRoom] Adding new message to state');
        return [...prev, msg];
      });
    });

    const unsubParticipants = subscribeToParticipants(room.id, (parts) => {
      console.log('[ChatRoom] Participants updated:', parts.length, parts);
      setParticipants(parts);
    });

    // Fallback polling: fetch messages every 3s in case realtime is not working
    const pollInterval = setInterval(async () => {
      try {
        const msgs = await getMessages(room.id);
        setMessages((prev) => {
          // Merge: keep existing, add any new ones
          const existingIds = new Set(prev.map((m) => m.id));
          const newMsgs = msgs.filter((m) => !existingIds.has(m.id));
          if (newMsgs.length > 0) {
            console.log('[ChatRoom] Poll found', newMsgs.length, 'new messages');
            return [...prev, ...newMsgs];
          }
          return prev;
        });
      } catch {
        // Silently ignore polling errors
      }
    }, 3000);

    return () => {
      console.log('[ChatRoom] Cleaning up realtime subscriptions');
      clearInterval(pollInterval);
      unsubMessages();
      unsubParticipants();
    };
  }, [room.id, user?.id]);

  // ── Start signaling listener on mount ─────────
  useEffect(() => {
    if (!room.id || !user?.id) return;

    console.log('[ChatRoom] Initializing WebRTC service for room:', room.id);

    const rtc = new WebRTCService(room.id, user.id, {
      onRemoteStream: (stream) => {
        console.log('[ChatRoom] Received remote stream, tracks:', stream.getTracks().length);
        remoteStreamRef.current = stream;
        // Try to attach to video element (for video calls)
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
          remoteVideoRef.current.play().catch(() => {});
        }
        // Try to attach to audio element (for audio calls)
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
          remoteAudioRef.current.play().catch(() => {});
        }
        setInCall(true);
      },
      onLocalStream: (stream) => {
        console.log('[ChatRoom] Local stream ready, tracks:', stream.getTracks().length);
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(() => {});
        }
      },
      onIncomingCall: (type) => {
        console.log('[ChatRoom] Incoming call of type:', type);
        setIncomingCall({ type });
      },
      onCallEnded: () => {
        console.log('[ChatRoom] Call ended');
        localStreamRef.current = null;
        remoteStreamRef.current = null;
        setInCall(false);
        setIncomingCall(null);
        setConnectionState('');
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
      },
      onConnectionStateChange: (state) => {
        console.log('[ChatRoom] Connection state changed:', state);
        setConnectionState(state);
      },
    });

    rtc.startSignaling();
    webrtcRef.current = rtc;

    return () => {
      console.log('[ChatRoom] Cleaning up WebRTC service');
      rtc.cleanup();
      webrtcRef.current = null;
    };
  }, [room.id, user?.id]);

  // ── Attach stored streams to video/audio elements when they mount ──
  useEffect(() => {
    if (inCall) {
      // Small delay to ensure refs are attached after render
      const timer = setTimeout(() => {
        if (callType === 'video') {
          if (localVideoRef.current && localStreamRef.current) {
            console.log('[ChatRoom] Attaching local stream to video element');
            localVideoRef.current.srcObject = localStreamRef.current;
            localVideoRef.current.play().catch(() => {});
          }
          if (remoteVideoRef.current && remoteStreamRef.current) {
            console.log('[ChatRoom] Attaching remote stream to video element');
            remoteVideoRef.current.srcObject = remoteStreamRef.current;
            remoteVideoRef.current.play().catch(() => {});
          }
        } else {
          // Audio call - attach remote stream to audio element
          if (remoteAudioRef.current && remoteStreamRef.current) {
            console.log('[ChatRoom] Attaching remote stream to audio element');
            remoteAudioRef.current.srcObject = remoteStreamRef.current;
            remoteAudioRef.current.play().catch(() => {});
          }
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [inCall, callType]);

  // ── Auto-scroll messages ──────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Send text message ─────────────────────────
  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || !user?.id || isSending) return;
    setIsSending(true);
    const content = inputValue.trim();
    console.log('[ChatRoom] Sending message:', { roomId: room.id, userId: user.id, content });
    try {
      const result = await sendMessage(room.id, user.id, displayName, content);
      console.log('[ChatRoom] Message sent successfully:', result);
      // Optimistic update: add to local state immediately (dedup prevents doubles from realtime)
      setMessages((prev) => {
        if (prev.some((m) => m.id === result.id)) return prev;
        return [...prev, result];
      });
      setInputValue('');
    } catch (err) {
      console.error('[ChatRoom] Failed to send message:', err);
      alert('Failed to send message: ' + (err as Error).message);
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
    // Check if there's an incoming call - both people trying to call at same time
    if (incomingCall) {
      setLineBusyError(true);
      setTimeout(() => setLineBusyError(false), 3000);
      return;
    }
    console.log('[ChatRoom] Starting', type, 'call');
    setCallType(type);
    setInCall(true); // Show UI immediately so video refs mount
    try {
      // Clean old signals to prevent stale offer/answer confusion
      await cleanOldSignals(room.id);
      // startCall internally acquires the local stream and fires onLocalStream callback
      await webrtcRef.current?.startCall(type);
      console.log('[ChatRoom] Call started successfully');
    } catch (err) {
      console.error('[ChatRoom] Failed to start call:', err);
      setInCall(false);
      alert('Failed to start call: ' + (err as Error).message);
    }
  };

  const hangUp = async () => {
    await webrtcRef.current?.hangUp();
    // stop local preview and tracks
    stopLocalStream();
    // stop remote refs
    try {
      if (remoteStreamRef.current) {
        remoteStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    } catch {}
    remoteStreamRef.current = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    setInCall(false);
    setConnectionState('');
    setElapsedSeconds(0);
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
    if (user?.id) {
      try {
        await sendMessage(room.id, user.id, displayName, `${displayName} left the room`, 'system');
      } catch {
        // Best-effort
      }
      await leaveRoom(room.id, user.id);
      // If the current user is the host (creator), deactivate the room
      if (user.id === room.created_by) {
        try {
          const { supabase } = await import('../lib/supabase');
          await supabase.from('rooms').update({ is_active: false }).eq('id', room.id);
        } catch (err) {
          console.warn('[ChatRoom] Could not deactivate room:', err);
        }
      }
    }
    onLeave();
  };

  // ── Copy room code ────────────────────────────
  const copyCode = () => {
    navigator.clipboard.writeText(room.code);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };
  // ── Share invite link ─────────────────────
  const shareLink = () => {
    const link = `${window.location.origin}?join=${room.code}`;
    navigator.clipboard.writeText(link);
    setShowLinkCopied(true);
    setTimeout(() => setShowLinkCopied(false), 2000);
  };

  // ── Check if room is saved on mount ────────
  useEffect(() => {
    if (!user?.id || !room.id) return;
    isRoomSaved(user.id, room.id).then(setRoomSaved).catch(() => {});
  }, [user?.id, room.id]);

  // ── Save / Unsave room ─────────────────────
  const handleToggleSaveRoom = async () => {
    if (!user?.id || savingRoom) return;
    setSavingRoom(true);
    try {
      if (roomSaved) {
        await unsaveRoom(user.id, room.id);
        setRoomSaved(false);
      } else {
        await saveRoom(user.id, room.id);
        setRoomSaved(true);
      }
    } catch (err) {
      console.error('[ChatRoom] Failed to toggle save room:', err);
    } finally {
      setSavingRoom(false);
    }
  };

  // ── Send friend request ────────────────────
  const handleSendFriendRequest = async (participant: RoomParticipant) => {
    if (!user?.id || sendingFriendReq) return;
    if (participant.user_id === user.id) return;
    setSendingFriendReq(true);
    setFriendReqStatus('');
    try {
      await sendFriendRequest(
        user.id,
        displayName,
        participant.user_id,
        participant.display_name || 'User',
      );
      setFriendReqStatus('sent');
      setTimeout(() => {
        setShowFriendReqModal(false);
        setFriendReqStatus('');
        setSelectedParticipant(null);
      }, 1500);
    } catch (err) {
      setFriendReqStatus(err instanceof Error ? err.message : 'Failed to send request');
    } finally {
      setSendingFriendReq(false);
    }
  };

  // ── Incoming call controls ────────────────
  const acceptCall = async () => {
    if (!incomingCall) return;
    setCallType(incomingCall.type);
    setInCall(true);
    setIncomingCall(null);
    try {
      // WebRTCService.acceptCall handles media acquisition and fires onLocalStream
      await webrtcRef.current?.acceptCall();
    } catch (err) {
      console.error('[ChatRoom] Failed to accept call:', err);
      setInCall(false);
    }
  };

  const stopLocalStream = () => {
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    } catch (err) {
      console.warn('[ChatRoom] Error stopping local stream:', err);
    }
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
  };

  // Start/stop call timer when call state changes
  useEffect(() => {
    if (inCall) {
      // initialize
      setElapsedSeconds(0);
      const start = Date.now();
      callTimerRef.current = window.setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
      }, 1000);
    } else {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
    }

    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
    };
  }, [inCall]);

  const rejectCall = async () => {
    setIncomingCall(null);
    await webrtcRef.current?.rejectCall();
  };

  // ── Inline file upload (beside send button) ───
  const handleInlineUpload = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || !user?.id) return;
    const file = fileList[0];
    const MAX_SIZE = 3 * 1024 * 1024 * 1024; // 3 GB
    if (file.size > MAX_SIZE) {
      alert('File exceeds the 3 GB limit.');
      return;
    }
    setIsUploading(true);
    setInlineUploadProgress({ percent: 0, bytesUploaded: 0, totalBytes: file.size });
    try {
      const uploaded = await uploadRoomFile(room.id, user.id, displayName, file, (p) =>
        setInlineUploadProgress(p),
      );
      // Send a file message in chat so other users see it inline
      await sendMessage(room.id, user.id, displayName, `📎 ${uploaded.file_name} (${formatFileSize(uploaded.file_size)})`, 'file');
    } catch (err) {
      console.error('[ChatRoom] Upload error:', err);
      alert('Upload failed: ' + (err as Error).message);
    } finally {
      setIsUploading(false);
      setInlineUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [room.id, user?.id, displayName]);

  // ── Format timestamp ──────────────────────────
  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  };

  return (
    <div className="chatroom">
      <div className="chatroom-main">
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
            <div
              className="chatroom-participant-count-wrapper"
              onMouseEnter={() => setShowParticipantsTooltip(true)}
              onMouseLeave={() => setShowParticipantsTooltip(false)}
            >
              <span className="chatroom-participant-count">
                {participants.length} participant{participants.length !== 1 ? 's' : ''}
              </span>
              {showParticipantsTooltip && participants.length > 0 && (
                <div className="chatroom-participants-tooltip">
                  <div className="chatroom-participants-tooltip-header">Active Participants</div>
                  <div className="chatroom-participants-list">
                    {participants.map((p) => (
                      <div key={p.id} className="chatroom-participant-item">
                        <span className="chatroom-participant-name">{p.display_name || 'User'}</span>
                        <span className="chatroom-participant-status">Online</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="chatroom-header-actions">
          {/* ── Desktop utility actions (hidden on mobile) ── */}
          <div className="chatroom-actions-desktop">
            <button
              className={`chatroom-hdr-btn${roomSaved ? ' active' : ''}`}
              onClick={handleToggleSaveRoom}
              disabled={savingRoom}
              title={roomSaved ? 'Unsave room' : 'Save room'}
            >
              <svg viewBox="0 0 24 24" fill={roomSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </button>

            <button className="chatroom-hdr-btn" onClick={() => setShowFriendReqModal(true)} title="Add friend">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
            </button>

            <button className="chatroom-hdr-btn chatroom-code-badge" onClick={copyCode} title="Copy room code">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span className="chatroom-code-text">{room.code}</span>
              {showCopied && <span className="chatroom-copied-toast">Copied!</span>}
            </button>

            <button className="chatroom-hdr-btn" onClick={shareLink} title="Copy invite link">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              {showLinkCopied && <span className="chatroom-copied-toast">Link copied!</span>}
            </button>

            <button
              className={`chatroom-hdr-btn${showDrive ? ' active' : ''}`}
              onClick={() => setShowDrive((v) => !v)}
              title={showDrive ? 'Close drive' : 'Room Drive'}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </button>
          </div>

          {/* ── Mobile more-menu (hidden on desktop) ── */}
          <div className="chatroom-more-wrapper" ref={moreMenuRef}>
            <button
              className={`chatroom-hdr-btn chatroom-more-trigger${showMoreMenu ? ' active' : ''}`}
              onClick={() => setShowMoreMenu((v) => !v)}
              title="More options"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="5" r="1" />
                <circle cx="12" cy="12" r="1" />
                <circle cx="12" cy="19" r="1" />
              </svg>
            </button>

            {showMoreMenu && (
              <div className="chatroom-more-popover">
                <button className="chatroom-more-item" onClick={() => { handleToggleSaveRoom(); setShowMoreMenu(false); }}>
                  <svg viewBox="0 0 24 24" fill={roomSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                  </svg>
                  <span>{roomSaved ? 'Unsave' : 'Save room'}</span>
                </button>
                <button className="chatroom-more-item" onClick={() => { setShowFriendReqModal(true); setShowMoreMenu(false); }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="8.5" cy="7" r="4" />
                    <line x1="20" y1="8" x2="20" y2="14" />
                    <line x1="23" y1="11" x2="17" y2="11" />
                  </svg>
                  <span>Add friend</span>
                </button>
                <button className="chatroom-more-item" onClick={() => { copyCode(); setShowMoreMenu(false); }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  <span>{room.code}</span>
                  {showCopied && <span className="chatroom-copied-toast">Copied!</span>}
                </button>
                <button className="chatroom-more-item" onClick={() => { shareLink(); setShowMoreMenu(false); }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                  <span>Share link</span>
                  {showLinkCopied && <span className="chatroom-copied-toast">Link copied!</span>}
                </button>
                <button className="chatroom-more-item" onClick={() => { setShowDrive((v) => !v); setShowMoreMenu(false); }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  <span>{showDrive ? 'Close drive' : 'Drive'}</span>
                </button>
              </div>
            )}
          </div>

          {/* ── Divider ── */}
          <div className="chatroom-hdr-divider" />

          {/* ── Call buttons (always visible) ── */}
          {!inCall && (
            <>
              <button
                className={`chatroom-hdr-btn chatroom-call-trigger${isAnonymous ? ' disabled' : ''}`}
                onClick={() => startCall('audio')}
                disabled={isAnonymous}
                title={isAnonymous ? 'Sign up for voice calls' : 'Voice call'}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </button>
              <button
                className={`chatroom-hdr-btn chatroom-call-trigger${isAnonymous ? ' disabled' : ''}`}
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
          {callType === 'video' ? (
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
          ) : (
            <div className="chatroom-audio-visual">
              <div className="chatroom-audio-avatar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </div>
              {/* Hidden audio element for audio-only calls */}
              <audio
                ref={remoteAudioRef}
                autoPlay
                style={{ display: 'none' }}
              />
            </div>
          )}

          <div className="chatroom-call-timer">{formatDuration(elapsedSeconds)}</div>
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
              <svg className="chatroom-incoming-reject-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Incoming call overlay ────────── */}
      {incomingCall && !inCall && (
        <div className="chatroom-incoming-call-overlay">
          <div className="chatroom-incoming-call-card">
            <div className="chatroom-incoming-call-icon">
              {incomingCall.type === 'video' ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              )}
            </div>
            <h3 className="chatroom-incoming-call-title">
              Incoming {incomingCall.type} call
            </h3>
            <div className="chatroom-incoming-call-actions">
              <button className="chatroom-incoming-accept" onClick={acceptCall}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                Accept
              </button>
              <button className="chatroom-incoming-reject" onClick={rejectCall} aria-label="Reject call" title="Reject call">
                <svg className="chatroom-incoming-reject-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Line Busy Error Modal ──────── */}
      {lineBusyError && (
        <div className="chatroom-line-busy-overlay">
          <div className="chatroom-line-busy-card">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <h3>Line Busy</h3>
            <p>The other person is calling. Please accept or reject their call first.</p>
          </div>
        </div>
      )}

      {/* ── Friend Request Modal ──────── */}
      {showFriendReqModal && (
        <div className="chatroom-friend-modal-overlay" onClick={() => { setShowFriendReqModal(false); setFriendReqStatus(''); setSelectedParticipant(null); }}>
          <div className="chatroom-friend-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="chatroom-friend-modal-title">Send Friend Request</h3>
            <p className="chatroom-friend-modal-subtitle">Choose a participant to add as a friend</p>

            <div className="chatroom-friend-modal-list">
              {participants
                .filter((p) => p.user_id !== user?.id)
                .map((p) => (
                  <button
                    key={p.id}
                    className={`chatroom-friend-modal-item${selectedParticipant?.id === p.id ? ' selected' : ''}`}
                    onClick={() => setSelectedParticipant(p)}
                  >
                    <div className="chatroom-friend-modal-avatar">
                      {(p.display_name || 'U')[0].toUpperCase()}
                    </div>
                    <span className="chatroom-friend-modal-name">{p.display_name || 'User'}</span>
                    {selectedParticipant?.id === p.id && (
                      <svg className="chatroom-friend-modal-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                ))}
              {participants.filter((p) => p.user_id !== user?.id).length === 0 && (
                <p className="chatroom-friend-modal-empty">No other participants in this room yet.</p>
              )}
            </div>

            {friendReqStatus === 'sent' && (
              <p className="chatroom-friend-modal-success">Friend request sent!</p>
            )}
            {friendReqStatus && friendReqStatus !== 'sent' && (
              <p className="chatroom-friend-modal-error">{friendReqStatus}</p>
            )}

            <div className="chatroom-friend-modal-actions">
              <button className="chatroom-friend-modal-cancel" onClick={() => { setShowFriendReqModal(false); setFriendReqStatus(''); setSelectedParticipant(null); }}>
                Cancel
              </button>
              <button
                className="chatroom-friend-modal-send"
                onClick={() => selectedParticipant && handleSendFriendRequest(selectedParticipant)}
                disabled={!selectedParticipant || sendingFriendReq || friendReqStatus === 'sent'}
              >
                {sendingFriendReq ? 'Sending…' : friendReqStatus === 'sent' ? 'Sent!' : 'Send Request'}
              </button>
            </div>
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

        {/* Upload button (beside send) */}
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={(e) => handleInlineUpload(e.target.files)}
        />
        <button
          className={`chatroom-upload-btn${isUploading ? ' uploading' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          title="Upload file"
        >
          {isUploading && inlineUploadProgress ? (
            <div className="upload-progress-ring">
              <svg viewBox="0 0 36 36">
                <circle className="track" cx="18" cy="18" r="15.5" />
                <circle
                  className="fill"
                  cx="18"
                  cy="18"
                  r="15.5"
                  strokeDasharray={`${2 * Math.PI * 15.5}`}
                  strokeDashoffset={`${2 * Math.PI * 15.5 * (1 - inlineUploadProgress.percent / 100)}`}
                />
              </svg>
            </div>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          )}
        </button>

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
      </div>{/* end chatroom-main */}

      {/* ── Drive side-panel ──────────── */}
      {showDrive && (
        <RoomDrive roomId={room.id} onClose={() => setShowDrive(false)} />
      )}
    </div>
  );
};

export default ChatRoom;
