import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../providers/auth';
import {
  getRoomFiles,
  subscribeToRoomFiles,
  uploadRoomFile,
  deleteRoomFile,
  saveFileToDrive,
  getFileUrl,
  getFileViewUrl,
  isPreviewable,
  formatFileSize,
  fileCategory,
} from '../lib/drive';
import type { RoomFile, UploadProgress } from '../lib/drive';
import { getActiveCloudSettings } from '../lib/cloud-storage';
import type { CloudSettings } from '../lib/cloud-storage';
import CloudStorageSettings from './CloudStorageSettings';
import './RoomDrive.css';

interface RoomDriveProps {
  roomId: string;
  onClose: () => void;
}

interface ErrorInfo {
  message: string;
  suggestion?: string;
}

const RoomDrive: React.FC<RoomDriveProps> = ({ roomId, onClose }) => {
  const { user } = useAuth();
  const [files, setFiles] = useState<RoomFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [previewFile, setPreviewFile] = useState<RoomFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [showCloudSettings, setShowCloudSettings] = useState(false);
  const [cloudSettings, setCloudSettings] = useState<CloudSettings | null>(null);
  const [savingToDrive, setSavingToDrive] = useState<Record<string, boolean>>({});
  const [savedToDrive, setSavedToDrive] = useState<Record<string, boolean>>({});

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.user_metadata?.username ||
    user?.email?.split('@')[0] ||
    'Guest';

  // ── Helper to parse errors and add suggestions ──
  const createErrorInfo = (errorMessage: string): ErrorInfo => {
    if (errorMessage.includes('storage quota')) {
      return {
        message: errorMessage,
        suggestion: 'Free up space in your Google Drive or upgrade your Google One storage plan.',
      };
    }
    if (errorMessage.includes('permission')) {
      return {
        message: errorMessage,
        suggestion: 'Check that you have permission to upload files to this location.',
      };
    }
    if (errorMessage.includes('expired') || errorMessage.includes('session')) {
      return {
        message: errorMessage,
        suggestion: 'Please reconnect your Google Drive account in cloud storage settings.',
      };
    }
    if (errorMessage.includes('network|connection')) {
      return {
        message: errorMessage,
        suggestion: 'Check your internet connection and try again.',
      };
    }
    return { message: errorMessage };
  };

  // ── Load initial files ─────────────────
  useEffect(() => {
    (async () => {
      try {
        const f = await getRoomFiles(roomId);
        setFiles(f);
        // Also check cloud settings
        if (user?.id) {
          const cs = await getActiveCloudSettings(user.id);
          setCloudSettings(cs);
        }
      } catch (err) {
        console.error('[RoomDrive] Error loading files:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [roomId, user?.id]);

  // ── Realtime subscription ──────────────
  useEffect(() => {
    const unsub = subscribeToRoomFiles(roomId, (f) => setFiles(f));
    return unsub;
  }, [roomId]);

  // ── Upload handler ─────────────────────
  const handleUpload = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0 || !user?.id) return;
      const file = fileList[0];

      // 3 GB limit
      const MAX_SIZE = 3 * 1024 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        setError(createErrorInfo('File exceeds the 3 GB limit.'));
        return;
      }

      setError(null);
      setUploading(true);
      setUploadProgress({ percent: 0, bytesUploaded: 0, totalBytes: file.size });

      try {
        await uploadRoomFile(roomId, user.id, displayName, file, (p) =>
          setUploadProgress(p),
        );
      } catch (err) {
        console.error('[RoomDrive] Upload error:', err);
        const errorMsg = (err as Error).message || 'Upload failed';
        setError(createErrorInfo(errorMsg));
      } finally {
        setUploading(false);
        setUploadProgress(null);
      }
    },
    [roomId, user?.id, displayName],
  );

  // ── Drag & drop ────────────────────────
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };
  const onDragLeave = () => setDragOver(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  };

  // ── Load image thumbnails from cloud ──
  useEffect(() => {
    let cancelled = false;
    const imageFiles = files.filter(
      (f) => f.mime_type?.startsWith('image/') && !thumbnails[f.id],
    );
    if (imageFiles.length === 0) return;

    (async () => {
      const newThumbs: Record<string, string> = {};
      await Promise.all(
        imageFiles.map(async (f) => {
          try {
            const url = await getFileViewUrl(f);
            newThumbs[f.id] = url;
          } catch {
            // skip thumbnail if signed URL fails
          }
        }),
      );
      if (!cancelled) setThumbnails((prev) => ({ ...prev, ...newThumbs }));
    })();

    return () => { cancelled = true; };
  }, [files]);

  // ── View / Preview (opens inline or in new tab) ──
  const handleView = async (file: RoomFile) => {
    try {
      const url = await getFileViewUrl(file);
      if (file.mime_type?.startsWith('image/') || file.mime_type?.startsWith('video/') || file.mime_type?.startsWith('audio/')) {
        // Show inline preview overlay
        setPreviewFile(file);
        setPreviewUrl(url);
      } else {
        // PDF or other previewable → open in new tab
        window.open(url, '_blank', 'noopener');
      }
    } catch (err) {
      console.error('[RoomDrive] View error:', err);
      setError(createErrorInfo('Failed to get preview link'));
    }
  };

  // ── Download (forces save-as) ──────────
  const handleDownload = async (file: RoomFile) => {
    try {
      const url = await getFileUrl(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.file_name;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('[RoomDrive] Download error:', err);
      setError(createErrorInfo('Failed to get download link'));
    }
  };

  // ── Save to Drive (recipient copies file to their own Drive) ──
  const handleSaveToDrive = async (file: RoomFile) => {
    if (!user?.id) return;
    if (!cloudSettings) {
      setShowCloudSettings(true);
      return;
    }
    setSavingToDrive((prev) => ({ ...prev, [file.id]: true }));
    setError(null);
    try {
      await saveFileToDrive(file, user.id);
      setSavedToDrive((prev) => ({ ...prev, [file.id]: true }));
    } catch (err) {
      console.error('[RoomDrive] Save to Drive error:', err);
      const errorMsg = (err as Error).message || 'Failed to save to Drive';
      setError(createErrorInfo(errorMsg));
    } finally {
      setSavingToDrive((prev) => ({ ...prev, [file.id]: false }));
    }
  };

  // ── Delete ─────────────────────────────
  const handleDelete = async (file: RoomFile) => {
    if (!confirm(`Delete "${file.file_name}"?`)) return;
    try {
      await deleteRoomFile(file);
    } catch (err) {
      console.error('[RoomDrive] Delete error:', err);
      setError(createErrorInfo('Failed to delete file'));
    }
  };

  // ── Icon helper ────────────────────────
  const FileIcon: React.FC<{ mime: string | null }> = ({ mime }) => {
    const cat = fileCategory(mime);
    switch (cat) {
      case 'image':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        );
      case 'video':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" />
          </svg>
        );
      case 'audio':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        );
      case 'document':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        );
      case 'archive':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polyline points="21 8 21 21 3 21 3 8" />
            <rect x="1" y="3" width="22" height="5" />
            <line x1="10" y1="12" x2="14" y2="12" />
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
            <polyline points="13 2 13 9 20 9" />
          </svg>
        );
    }
  };

  return (
    <div
      className={`room-drive-panel${dragOver ? ' drag-over' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Header */}
      <div className="room-drive-header">
        <div className="room-drive-header-left">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span className="room-drive-title">Room Drive</span>
          <span className="room-drive-count">{files.length} file{files.length !== 1 ? 's' : ''}</span>
        </div>
        <button className="room-drive-close" onClick={onClose} title="Close drive">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Cloud storage status bar */}
      <div className="room-drive-cloud-bar">
        {cloudSettings ? (
          <button className="room-drive-cloud-status connected" onClick={() => setShowCloudSettings(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
            </svg>
            <span>Drive: {cloudSettings.provider_email}</span>
          </button>
        ) : (
          <button className="room-drive-cloud-status" onClick={() => setShowCloudSettings(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
            </svg>
            <span>Connect Drive to save received files</span>
          </button>
        )}
      </div>

      {/* Upload zone */}
      <div className="room-drive-upload-zone">
        <label className="room-drive-upload-label">
          <input
            type="file"
            className="room-drive-upload-input"
            onChange={(e) => handleUpload(e.target.files)}
            disabled={uploading}
          />
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span>{uploading ? 'Uploading…' : 'Drop files here or click to upload'}</span>
          <span className="room-drive-upload-hint">Max 3 GB per file</span>
        </label>
      </div>

      {/* Progress bar */}
      {uploading && uploadProgress && (
        <div className="room-drive-progress">
          <div className="room-drive-progress-bar">
            <div
              className="room-drive-progress-fill"
              style={{ width: `${uploadProgress.percent}%` }}
            />
          </div>
          <span className="room-drive-progress-text">
            {uploadProgress.percent}% · {formatFileSize(uploadProgress.bytesUploaded)} / {formatFileSize(uploadProgress.totalBytes)}
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="room-drive-error">
          <div className="room-drive-error-content">
            <span className="room-drive-error-message">{error.message}</span>
            {error.suggestion && (
              <span className="room-drive-error-suggestion">{error.suggestion}</span>
            )}
          </div>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Drag overlay */}
      {dragOver && (
        <div className="room-drive-drag-overlay">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="40" height="40">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span>Drop to upload</span>
        </div>
      )}

      {/* File list */}
      <div className="room-drive-files">
        {loading && <div className="room-drive-loading">Loading files…</div>}

        {!loading && files.length === 0 && (
          <div className="room-drive-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="36" height="36">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <p>No files yet</p>
            <p className="room-drive-empty-hint">Upload files to share with everyone in this room</p>
          </div>
        )}

        {files.map((f) => (
          <div key={f.id} className="room-drive-file-row">
            <div className="room-drive-file-icon">
              {thumbnails[f.id] ? (
                <img
                  src={thumbnails[f.id]}
                  alt={f.file_name}
                  className="room-drive-thumb"
                  onClick={() => handleView(f)}
                />
              ) : (
                <FileIcon mime={f.mime_type} />
              )}
            </div>
            <div className="room-drive-file-info">
              <span className="room-drive-file-name" title={f.file_name}>
                {f.file_name}
              </span>
              <span className="room-drive-file-meta">
                {formatFileSize(f.file_size)} · {f.uploader_name || 'Unknown'} · {new Date(f.created_at).toLocaleDateString()}
                {f.cloud_provider && (
                  <span className="room-drive-cloud-badge" title={`Stored in ${f.cloud_provider === 'google_drive' ? 'Google Drive' : f.cloud_provider}`}>
                    ☁
                  </span>
                )}
              </span>
            </div>
            <div className="room-drive-file-actions">
              {isPreviewable(f.mime_type) && (
                <button
                  className="room-drive-file-action"
                  onClick={() => handleView(f)}
                  title="View"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              )}
              <button
                className="room-drive-file-action"
                onClick={() => handleDownload(f)}
                title="Download"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </button>
              {f.uploader_id !== user?.id && (
                <button
                  className={`room-drive-file-action${savedToDrive[f.id] ? ' saved' : ''}`}
                  onClick={() => handleSaveToDrive(f)}
                  disabled={savingToDrive[f.id] || savedToDrive[f.id]}
                  title={savedToDrive[f.id] ? 'Saved to your Drive' : cloudSettings ? 'Save to my Drive' : 'Connect Drive to save'}
                >
                  {savingToDrive[f.id] ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" className="spin">
                      <circle cx="12" cy="12" r="10" strokeDasharray="31.4" strokeDashoffset="10" />
                    </svg>
                  ) : savedToDrive[f.id] ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
                      <polyline points="12 13 12 20" />
                      <polyline points="9 17 12 20 15 17" />
                    </svg>
                  )}
                </button>
              )}
              {f.uploader_id === user?.id && (
                <button
                  className="room-drive-file-action delete"
                  onClick={() => handleDelete(f)}
                  title="Delete"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Inline preview overlay */}
      {previewFile && previewUrl && (
        <PreviewOverlay
          file={previewFile}
          url={previewUrl}
          onClose={() => { setPreviewFile(null); setPreviewUrl(null); }}
        />
      )}

      {/* Cloud storage settings overlay */}
      {showCloudSettings && (
        <CloudStorageSettings
          onClose={() => {
            setShowCloudSettings(false);
            // Refresh cloud settings after closing
            if (user?.id) {
              getActiveCloudSettings(user.id).then(setCloudSettings).catch(() => {});
            }
          }}
        />
      )}
    </div>
  );
};

/* ── Inline preview overlay ──────────────── */
const PreviewOverlay: React.FC<{
  file: RoomFile;
  url: string;
  onClose: () => void;
}> = ({ file, url, onClose }) => {
  const mime = file.mime_type || '';
  return (
    <div className="room-drive-preview-overlay" onClick={onClose}>
      <div className="room-drive-preview-content" onClick={(e) => e.stopPropagation()}>
        <button className="room-drive-preview-close" onClick={onClose} title="Close preview">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <p className="room-drive-preview-name">{file.file_name}</p>
        {mime.startsWith('image/') && (
          <img src={url} alt={file.file_name} className="room-drive-preview-img" />
        )}
        {mime.startsWith('video/') && (
          <video src={url} controls autoPlay className="room-drive-preview-video" />
        )}
        {mime.startsWith('audio/') && (
          <audio src={url} controls autoPlay className="room-drive-preview-audio" />
        )}
      </div>
    </div>
  );
};

export default RoomDrive;
