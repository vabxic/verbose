import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../providers/auth';
import {
  sendDirectMessage,
  getDirectMessages,
  markMessagesAsRead,
  clearChat,
  subscribeToDMs,
} from '../lib/friends-chat';
import type { DirectMessage, FileMetadata } from '../lib/friends-chat';
import { formatFileSize } from '../lib/drive';
import './FriendChat.css';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load messages
  useEffect(() => {
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
      {/* Header */}
      <header className="fc-header">
        <button className="fc-back-btn" onClick={onBack}>
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
        <button className="fc-clear-btn" onClick={() => setShowClearConfirm(true)} title="Clear chat">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </header>

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
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        </button>
        <button className="fc-send-btn" onClick={handleSend} disabled={!inputValue.trim() || isSending}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default FriendChat;
