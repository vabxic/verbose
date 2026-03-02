import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../providers/auth';
import BackgroundCustomizer, { BACKGROUND_OPTIONS } from './BackgroundCustomizer';
import {
  sendDirectMessage,
  getDirectMessages,
  markMessagesAsRead,
  clearChat,
  subscribeToDMs,
  getDMChannelId,
  sendDMSignal,
  subscribeToDMSignals,
  cleanOldDMSignals,
} from '../lib/friends-chat';
import type { DirectMessage, FileMetadata, DMSignal } from '../lib/friends-chat';
import { formatFileSize, saveUrlToDrive } from '../lib/drive';
import { getActiveCloudSettings } from '../lib/cloud-storage';
import { WebRTCService } from '../lib/webrtc';
import type { CallType, SignalAdapter } from '../lib/webrtc';
import './FriendChat.css';
import SaveToDriveHelpModal from './SaveToDriveHelpModal';
import CloudStorageSettings from './CloudStorageSettings';

interface FriendChatProps {
  friendId: string;
  friendName: string;
  isOnline: boolean;
  onBack: () => void;
}

function isImageMime(mime: string): boolean {
  return mime.startsWith('image/');
}

function isVideoMime(mime: string): boolean {
  return mime.startsWith('video/');
}

function isAudioMime(mime: string): boolean {
  return mime.startsWith('audio/');
}

function isPdfMime(mime: string): boolean {
  return mime === 'application/pdf';
}

const FriendChat: React.FC<FriendChatProps> = ({ friendId, friendName, isOnline, onBack }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [savingToDrive, setSavingToDrive] = useState<Record<string, boolean>>({});
  const [savedToDrive, setSavedToDrive] = useState<Record<string, boolean>>({});
  const [saveHelp, setSaveHelp] = useState<{ open: boolean; downloadUrl?: string | null; fileName?: string | null }>({ open: false });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Call state
  const [inCall, setInCall] = useState(false);
  const [callType, setCallType] = useState<CallType>('audio');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState | ''>('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [incomingCall, setIncomingCall] = useState<{ type: CallType } | null>(null);
  const [lineBusyError, setLineBusyError] = useState(false);

  // Background customization
  const [selectedBgId, setSelectedBgId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('chatroom-bg-id') || 'dark-radial';
    }
    return 'dark-radial';
  });
  const [showBgCustomizer, setShowBgCustomizer] = useState(false);
  const [showCloudSettings, setShowCloudSettings] = useState(false);

  const [isTouchDevice, setIsTouchDevice] = useState(false);

  type VideoCorner = 'corner-bottom-right' | 'corner-bottom-left' | 'corner-top-right' | 'corner-top-left';
  const [localVideoCorner, setLocalVideoCorner] = useState<VideoCorner>('corner-bottom-right');

  const cycleVideoCorner = useCallback(() => {
    setLocalVideoCorner((prev) => {
      const order: VideoCorner[] = ['corner-bottom-right', 'corner-bottom-left', 'corner-top-left', 'corner-top-right'];
      const idx = order.indexOf(prev);
      return order[(idx + 1) % order.length];
    });
  }, []);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const webrtcRef = useRef<WebRTCService | null>(null);
  const callTimerRef = useRef<number | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  // Load messages
  useEffect(() => {
    try {
      const touch = typeof window !== 'undefined' && (
        'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.matchMedia('(pointer:coarse)').matches
      );
      setIsTouchDevice(Boolean(touch));
    } catch {}
    if (!user?.id) return;
    (async () => {
      try {
        const msgs = await getDirectMessages(user.id, friendId);
        setMessages(msgs);
        await markMessagesAsRead(user.id, friendId);
      } catch (err) {
        console.error('[FriendChat] Failed to load messages:', err);
      }
    })();
  }, [user?.id, friendId]);

  // Subscribe to new messages
  useEffect(() => {
    if (!user?.id) return;
    const unsub = subscribeToDMs(user.id, friendId, (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      // Auto-mark as read
      markMessagesAsRead(user.id, friendId).catch(() => {});
    });
    return unsub;
  }, [user?.id, friendId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── WebRTC for DM calls ─────────────────────
  useEffect(() => {
    if (!user?.id) return;
    const channelId = getDMChannelId(user.id, friendId);

    const dmSignalAdapter: SignalAdapter = {
      sendSignal: (chId, senderId, type, payload, targetId) =>
        sendDMSignal(chId, senderId, type as DMSignal['type'], payload, targetId),
      subscribeToSignals: (chId, currentUserId, onSignal) =>
        subscribeToDMSignals(chId, currentUserId, onSignal as (s: DMSignal) => void),
    };

    const rtc = new WebRTCService(channelId, user.id, {
      onRemoteStream: (stream) => {
        remoteStreamRef.current = stream;
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
          remoteVideoRef.current.play().catch(() => {});
        }
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
          remoteAudioRef.current.play().catch(() => {});
        }
        setInCall(true);
      },
      onLocalStream: (stream) => {
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(() => {});
        }
      },
      onIncomingCall: (type) => {
        setIncomingCall({ type });
      },
      onCallEnded: () => {
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
        setConnectionState(state);
      },
    }, dmSignalAdapter);

    rtc.startSignaling();
    webrtcRef.current = rtc;

    return () => {
      rtc.cleanup();
      webrtcRef.current = null;
    };
  }, [user?.id, friendId]);

  // Attach streams when call type / in-call changes
  useEffect(() => {
    if (inCall) {
      const timer = setTimeout(() => {
        if (callType === 'video') {
          if (localVideoRef.current && localStreamRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
            localVideoRef.current.play().catch(() => {});
          }
          if (remoteVideoRef.current && remoteStreamRef.current) {
            remoteVideoRef.current.srcObject = remoteStreamRef.current;
            remoteVideoRef.current.play().catch(() => {});
          }
        } else {
          if (remoteAudioRef.current && remoteStreamRef.current) {
            remoteAudioRef.current.srcObject = remoteStreamRef.current;
            remoteAudioRef.current.play().catch(() => {});
          }
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [inCall, callType]);

  // Call timer
  useEffect(() => {
    if (inCall) {
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

  // ── Call controls ─────────────────────────────
  const startCall = async (type: CallType) => {
    if (incomingCall) {
      setLineBusyError(true);
      setTimeout(() => setLineBusyError(false), 3000);
      return;
    }
    if (!user?.id) return;
    const channelId = getDMChannelId(user.id, friendId);
    setCallType(type);
    setInCall(true);
    try {
      await cleanOldDMSignals(channelId);
      await webrtcRef.current?.startCall(type);
    } catch (err) {
      console.error('[FriendChat] Failed to start call:', err);
      setInCall(false);
      alert('Failed to start call: ' + (err as Error).message);
    }
  };

  const hangUp = async () => {
    await webrtcRef.current?.hangUp();
    stopLocalStream();
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

  const stopLocalStream = () => {
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    } catch {}
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
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

  const handleSwitchCamera = async () => {
    try {
      await webrtcRef.current?.switchCamera();
    } catch (err) {
      console.error('[FriendChat] Failed to switch camera:', err);
    }
  };

  const acceptCall = async () => {
    if (!incomingCall) return;
    setCallType(incomingCall.type);
    setInCall(true);
    setIncomingCall(null);
    try {
      await webrtcRef.current?.acceptCall();
    } catch (err) {
      console.error('[FriendChat] Failed to accept call:', err);
      setInCall(false);
    }
  };

  const rejectCall = async () => {
    setIncomingCall(null);
    await webrtcRef.current?.rejectCall();
  };

  // ── Background customizer helpers ──
  const getBackgroundStyle = () => {
    if (!selectedBgId) return {};
    const bgOpt = BACKGROUND_OPTIONS.find((b) => b.id === selectedBgId);
    return bgOpt ? bgOpt.style : {};
  };

  const handleSelectBackground = (bgId: string | null) => {
    setSelectedBgId(bgId);
    if (bgId) {
      localStorage.setItem('chatroom-bg-id', bgId);
    } else {
      localStorage.removeItem('chatroom-bg-id');
    }
  };

  const formatDuration = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  };

  // Send text message
  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || !user?.id || isSending) return;
    setIsSending(true);
    try {
      const msg = await sendDirectMessage(user.id, friendId, inputValue.trim());
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setInputValue('');
    } catch (err) {
      console.error('[FriendChat] Failed to send:', err);
    } finally {
      setIsSending(false);
    }
  }, [inputValue, user?.id, friendId, isSending]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // File upload
  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0 || !user?.id) return;
    const file = files[0];
    const MAX_SIZE = 50 * 1024 * 1024; // 50MB for DMs
    if (file.size > MAX_SIZE) {
      alert('File exceeds the 50 MB limit for direct messages.');
      return;
    }

    setIsSending(true);
    try {
      // For DMs, we use a data URL for small files or upload to supabase storage
      // For now we use object URLs for preview and store file info
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const fileMetadata: FileMetadata = {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        url: dataUrl,
      };

      const msg = await sendDirectMessage(
        user.id,
        friendId,
        `📎 ${file.name} (${formatFileSize(file.size)})`,
        'file',
        fileMetadata,
      );
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    } catch (err) {
      console.error('[FriendChat] File upload failed:', err);
      alert('Failed to send file');
    } finally {
      setIsSending(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [user?.id, friendId]);

  // Clear chat
  const handleClearChat = async () => {
    if (!user?.id) return;
    try {
      await clearChat(user.id, friendId);
      setMessages([]);
      setShowClearConfirm(false);
    } catch (err) {
      console.error('[FriendChat] Failed to clear chat:', err);
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Today';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Group messages by date
  const groupedMessages: { date: string; messages: DirectMessage[] }[] = [];
  let lastDate = '';
  for (const msg of messages) {
    const date = formatDate(msg.created_at);
    if (date !== lastDate) {
      groupedMessages.push({ date, messages: [msg] });
      lastDate = date;
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(msg);
    }
  }

  const renderFilePreview = (msg: DirectMessage) => {
    const meta = msg.file_metadata;
    if (!meta) return <span className="fc-msg-text">{msg.content}</span>;

    const { mimeType, url, fileName, fileSize } = meta;

    if (isImageMime(mimeType)) {
      return (
        <div className="fc-file-preview">
          <img
            src={url}
            alt={fileName}
            className="fc-file-image"
            onClick={() => setExpandedImage(url)}
          />
          <div className="fc-file-info-row">
            <span className="fc-file-name">{fileName}</span>
            <span className="fc-file-size">{formatFileSize(fileSize)}</span>
            <div className="fc-file-actions">
              <button
                className="fc-save-drive-btn"
                onClick={async () => {
                  if (!user?.id) return;
                  // Ensure cloud settings
                  const cs = await getActiveCloudSettings(user.id).catch(() => null);
                  if (!cs) {
                    alert('Connect your Drive in Cloud Storage settings first.');
                    return;
                  }
                  setSavingToDrive((s) => ({ ...s, [msg.id]: true }));
                  try {
                    await saveUrlToDrive(meta.url, user.id, fileName, meta.mimeType || null);
                    setSavedToDrive((s) => ({ ...s, [msg.id]: true }));
                    alert('Saved to Drive');
                  } catch (err) {
                    console.error('[FriendChat] Save to Drive failed:', err);
                    // Show contextual modal with guidance and a direct-download link
                    setSaveHelp({ open: true, downloadUrl: meta.url, fileName });
                  } finally {
                    setSavingToDrive((s) => ({ ...s, [msg.id]: false }));
                  }
                }}
                disabled={!!savingToDrive[msg.id]}
                title="Save to Drive"
              >
                {savingToDrive[msg.id] ? 'Saving…' : savedToDrive[msg.id] ? 'Saved' : 'Save to Drive'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (isVideoMime(mimeType)) {
      return (
        <div className="fc-file-preview">
          <video src={url} controls className="fc-file-video" />
          <div className="fc-file-info-row">
            <span className="fc-file-name">{fileName}</span>
            <span className="fc-file-size">{formatFileSize(fileSize)}</span>
          </div>
        </div>
      );
    }

    if (isAudioMime(mimeType)) {
      return (
        <div className="fc-file-preview">
          <audio src={url} controls className="fc-file-audio" />
          <div className="fc-file-info-row">
            <span className="fc-file-name">{fileName}</span>
            <span className="fc-file-size">{formatFileSize(fileSize)}</span>
          </div>
        </div>
      );
    }

    if (isPdfMime(mimeType)) {
      return (
        <div className="fc-file-preview fc-file-pdf">
          <a href={url} target="_blank" rel="noopener noreferrer" className="fc-pdf-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="24" height="24">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <div className="fc-file-info-row">
              <span className="fc-file-name">{fileName}</span>
              <span className="fc-file-size">{formatFileSize(fileSize)}</span>
            </div>
          </a>
        </div>
      );
    }

    // Generic file
    return (
      <div className="fc-file-preview fc-file-generic">
        <a href={url} download={fileName} className="fc-generic-link">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="24" height="24">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
          <div className="fc-file-info-row">
            <span className="fc-file-name">{fileName}</span>
            <span className="fc-file-size">{formatFileSize(fileSize)}</span>
          </div>
        </a>
      </div>
    );
  };

  return (
    <div className="friend-chat">
      {/* Background layer */}
      <div
        className="fc-bg-layer"
        style={getBackgroundStyle()}
      />

      {/* Header */}
      <header className="fc-header">
        <button className="fc-back-btn" onClick={() => { if (inCall) hangUp(); onBack(); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="fc-header-info">
          <div className="fc-header-avatar">
            {friendName[0]?.toUpperCase() || 'U'}
            <span className={`fc-status-dot ${isOnline ? 'online' : 'offline'}`} />
          </div>
          <div className="fc-header-text">
            <h3 className="fc-header-name">{friendName}</h3>
            <span className="fc-header-status">{isOnline ? 'Online' : 'Offline'}</span>
          </div>
        </div>
        <div className="fc-header-actions">
          {!inCall && (
            <>
              <button className="fc-call-btn" onClick={() => startCall('audio')} title="Voice call">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </button>
              <button className="fc-call-btn" onClick={() => startCall('video')} title="Video call">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
              </button>
            </>
          )}
          <button className="fc-clear-btn" onClick={() => setShowClearConfirm(true)} title="Clear chat">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
          <button 
            className="fc-clear-btn" 
            onClick={() => setShowBgCustomizer(true)} 
            title="Background settings"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          <button
            className="fc-clear-btn"
            onClick={() => setShowCloudSettings(true)}
            title="Cloud Storage / Drive"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Background Customizer */}
      {showBgCustomizer && (
        <BackgroundCustomizer
          selectedBgId={selectedBgId}
          onSelectBackground={handleSelectBackground}
          onClose={() => setShowBgCustomizer(false)}
        />
      )}

      {/* Cloud / Drive settings */}
      {showCloudSettings && (
        <CloudStorageSettings onClose={() => setShowCloudSettings(false)} />
      )}

      {/* Clear chat confirmation */}
      {showClearConfirm && (
        <div className="fc-clear-overlay" onClick={() => setShowClearConfirm(false)}>
          <div className="fc-clear-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Clear Chat</h3>
            <p>Delete all messages with {friendName}? This cannot be undone.</p>
            <div className="fc-clear-actions">
              <button onClick={() => setShowClearConfirm(false)}>Cancel</button>
              <button className="fc-clear-confirm" onClick={handleClearChat}>Clear All</button>
            </div>
          </div>
        </div>
      )}

      {/* Expanded image viewer */}
      {expandedImage && (
        <div className="fc-image-viewer" onClick={() => setExpandedImage(null)}>
          <img src={expandedImage} alt="Preview" />
          <button className="fc-image-close" onClick={() => setExpandedImage(null)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Audio call bar (top of chat, non-covering) ── */}
      {inCall && callType === 'audio' && (
        <div className="fc-audio-call-bar">
          <audio ref={remoteAudioRef} autoPlay style={{ display: 'none' }} />

          <div className="fc-audio-bar-left">
            <div className="fc-audio-bar-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </div>
            <div className="fc-audio-bar-info">
              <span className="fc-audio-bar-label">Voice call</span>
              <span className="fc-audio-bar-timer">{formatDuration(elapsedSeconds)}</span>
            </div>
            {connectionState && connectionState !== 'connected' && (
              <span className="fc-audio-bar-status">
                {connectionState === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
              </span>
            )}
          </div>

          <div className="fc-audio-bar-controls">
            <button
              className={`fc-audio-bar-btn${!audioEnabled ? ' off' : ''}`}
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

            {isTouchDevice && (
              <button
                className="fc-call-ctrl-btn"
                onClick={handleSwitchCamera}
                title="Switch camera"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10v6h-6" />
                  <path d="M3 14v-6h6" />
                  <path d="M21 10a8 8 0 0 0-13.9-4" />
                  <path d="M3 14a8 8 0 0 0 13.9 4" />
                </svg>
              </button>
            )}

            <button className="fc-audio-bar-btn" title="Speaker">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            </button>

            <button className="fc-audio-bar-btn hangup" onClick={hangUp} title="End call">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: 'rotate(136deg)' }}>
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Video call overlay (full page) ── */}
      {inCall && callType === 'video' && (
        <div className="fc-video-call-overlay">
          <div className="fc-call-videos">
            <video ref={remoteVideoRef} className="fc-remote-video" autoPlay playsInline />
            <video
              ref={localVideoRef}
              className={`fc-local-video ${localVideoCorner}`}
              autoPlay
              playsInline
              muted
              onClick={cycleVideoCorner}
              title="Click to move to next corner"
            />
          </div>

          <div className="fc-call-timer">{formatDuration(elapsedSeconds)}</div>

          {connectionState && connectionState !== 'connected' && (
            <div className="fc-call-status">
              {connectionState === 'connecting' && 'Connecting…'}
              {connectionState === 'disconnected' && 'Reconnecting…'}
            </div>
          )}

          <div className="fc-call-controls">
            <button
              className={`fc-call-ctrl-btn ${!audioEnabled ? 'off' : ''}`}
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

            <button
              className={`fc-call-ctrl-btn ${!videoEnabled ? 'off' : ''}`}
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

            <button
              className="fc-call-ctrl-btn"
              onClick={handleSwitchCamera}
              title="Switch camera"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10v6h-6" />
                <path d="M3 14v-6h6" />
                <path d="M21 10a8 8 0 0 0-13.9-4" />
                <path d="M3 14a8 8 0 0 0 13.9 4" />
              </svg>
            </button>

            <button className="fc-call-ctrl-btn hangup" onClick={hangUp} title="End call">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: 'rotate(136deg)' }}>
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </button>
          </div>

          <div className="fc-video-corner-hint">Tap your camera to move</div>
        </div>
      )}

      {/* ── Incoming call overlay ────── */}
      {incomingCall && !inCall && (
        <div className="fc-incoming-call-overlay">
          <div className="fc-incoming-call-card">
            <div className="fc-incoming-call-icon">
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
            <h3 className="fc-incoming-call-title">
              {friendName} — {incomingCall.type} call
            </h3>
            <div className="fc-incoming-call-actions">
              <button className="fc-incoming-accept" onClick={acceptCall}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                Accept
              </button>
              <button className="fc-incoming-reject" onClick={rejectCall}>
                <svg className="fc-incoming-reject-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Line Busy Error ──────── */}
      {lineBusyError && (
        <div className="fc-line-busy-overlay">
          <div className="fc-line-busy-card">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <h3>Line Busy</h3>
            <p>{friendName} is calling you. Accept or reject their call first.</p>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="fc-messages">
        {messages.length === 0 && (
          <div className="fc-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="40" height="40">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p>No messages yet. Say hi to {friendName}!</p>
          </div>
        )}

        {groupedMessages.map((group) => (
          <React.Fragment key={group.date}>
            <div className="fc-date-divider">
              <span>{group.date}</span>
            </div>
            {group.messages.map((msg) => {
              const isOwn = msg.sender_id === user?.id;
              return (
                <div
                  key={msg.id}
                  className={`fc-msg ${isOwn ? 'own' : 'other'}`}
                >
                  <div className="fc-msg-bubble">
                    {msg.type === 'file' ? (
                      renderFilePreview(msg)
                    ) : (
                      <span className="fc-msg-text">{msg.content}</span>
                    )}
                    <span className="fc-msg-time">{formatTime(msg.created_at)}</span>
                  </div>
                </div>
              );
            })}
          </React.Fragment>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="fc-input-bar">
        <textarea
          className="fc-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          rows={1}
        />
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={(e) => handleFileUpload(e.target.files)}
        />
        <button className="fc-upload-btn" onClick={() => fileInputRef.current?.click()} disabled={isSending} title="Send file">
          {isSending ? (
            <div className="fc-upload-spinner" />
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          )}
        </button>
        <button className="fc-send-btn" onClick={handleSend} disabled={!inputValue.trim() || isSending}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
      <SaveToDriveHelpModal
        open={saveHelp.open}
        onClose={() => setSaveHelp({ open: false })}
        downloadUrl={saveHelp.downloadUrl}
        fileName={saveHelp.fileName}
      />
    </div>
  );
};

export default FriendChat;
