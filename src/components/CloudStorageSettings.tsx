import React, { useState, useEffect } from 'react';
import { useAuth } from '../providers/auth';
import {
  getActiveCloudSettings,
  saveCloudSettings,
  disconnectCloudProvider,
  getCloudProvider,
  isTokenExpired,
} from '../lib/cloud-storage';
import type { CloudSettings, CloudProviderType } from '../lib/cloud-storage';
import './CloudStorageSettings.css';

interface CloudStorageSettingsProps {
  onClose: () => void;
}

const CloudStorageSettings: React.FC<CloudStorageSettingsProps> = ({ onClose }) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<CloudSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load current settings
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const s = await getActiveCloudSettings(user.id);
        setSettings(s);
      } catch (err) {
        console.error('[CloudSettings] Load error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  const handleConnect = async (providerType: CloudProviderType) => {
    if (!user?.id) return;
    setConnecting(true);
    setError(null);

    try {
      const provider = getCloudProvider(providerType);

      // 1. OAuth
      const auth = await provider.authorize();

      // 2. Ensure Verbose folder in user's cloud
      const folderId = await provider.ensureFolder(auth.accessToken, 'Verbose');

      // 3. Save to DB
      const saved = await saveCloudSettings(
        user.id,
        providerType,
        auth.accessToken,
        auth.email,
        auth.expiresAt,
        folderId,
        'Verbose',
      );

      setSettings(saved);
    } catch (err) {
      console.error('[CloudSettings] Connect error:', err);
      setError((err as Error).message || 'Failed to connect cloud storage.');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user?.id || !settings) return;
    setConnecting(true);
    setError(null);

    try {
      await disconnectCloudProvider(user.id, settings.provider);
      setSettings(null);
    } catch (err) {
      console.error('[CloudSettings] Disconnect error:', err);
      setError((err as Error).message || 'Failed to disconnect.');
    } finally {
      setConnecting(false);
    }
  };

  const tokenStatus = settings
    ? isTokenExpired(settings)
      ? 'expired'
      : 'active'
    : null;

  const providerLabel: Record<CloudProviderType, string> = {
    google_drive: 'Google Drive',
    dropbox: 'Dropbox',
    onedrive: 'OneDrive',
  };

  return (
    <div className="cloud-settings-overlay" onClick={onClose}>
      <div className="cloud-settings-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="cloud-settings-header">
          <div className="cloud-settings-header-left">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20">
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
            </svg>
            <span className="cloud-settings-title">Cloud Storage</span>
          </div>
          <button className="cloud-settings-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Description */}
        <p className="cloud-settings-desc">
          Connect your own cloud storage for <strong>zero platform storage</strong>.
          Files upload directly from your browser to your cloud and are shared via link.
        </p>

        {loading && <div className="cloud-settings-loading">Loading…</div>}

        {error && (
          <div className="cloud-settings-error">
            <span>{error}</span>
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {/* Connected provider */}
        {settings && (
          <div className="cloud-settings-connected">
            <div className="cloud-settings-provider-card">
              <div className="cloud-settings-provider-icon">
                {settings.provider === 'google_drive' && <GoogleDriveIcon />}
              </div>
              <div className="cloud-settings-provider-info">
                <span className="cloud-settings-provider-name">
                  {providerLabel[settings.provider]}
                </span>
                <span className="cloud-settings-provider-email">
                  {settings.provider_email}
                </span>
                <span className="cloud-settings-provider-folder">
                  📁 {settings.folder_name}
                </span>
                <span className={`cloud-settings-token-status ${tokenStatus}`}>
                  {tokenStatus === 'active' ? '● Connected' : '● Token expired – re-connect'}
                </span>
              </div>
              <button
                className="cloud-settings-disconnect-btn"
                onClick={handleDisconnect}
                disabled={connecting}
              >
                Disconnect
              </button>
            </div>
          </div>
        )}

        {/* Provider selection */}
        {!settings && !loading && (
          <div className="cloud-settings-providers">
            <button
              className="cloud-settings-provider-btn"
              onClick={() => handleConnect('google_drive')}
              disabled={connecting}
            >
              <GoogleDriveIcon />
              <span>{connecting ? 'Connecting…' : 'Connect Google Drive'}</span>
            </button>

            <button className="cloud-settings-provider-btn disabled" disabled title="Coming soon">
              <DropboxIcon />
              <span>Dropbox (coming soon)</span>
            </button>

            <button className="cloud-settings-provider-btn disabled" disabled title="Coming soon">
              <OneDriveIcon />
              <span>OneDrive (coming soon)</span>
            </button>
          </div>
        )}

        {/* How it works */}
        <div className="cloud-settings-info">
          <h4>How it works</h4>
          <ul>
            <li>Files upload <strong>directly</strong> from your browser to your cloud</li>
            <li>A <em>Verbose</em> folder is created in your Drive</li>
            <li>Shared files get a public link so room participants can download</li>
            <li>No file data touches the Verbose servers</li>
            <li>You can disconnect anytime – existing shared links remain valid</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

// ── Provider icon components ─────────────────────

const GoogleDriveIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="28" height="28" viewBox="0 0 48 48">
    <path fill="#1e88e5" d="M38.59,39c-0.535,0.93-0.298,1.68-1.195,2.197C36.498,41.715,35.465,42,34.39,42H13.61 c-1.074,0-2.106-0.285-3.004-0.802C9.708,40.681,9.945,39.93,9.41,39l7.67-9h13.84L38.59,39z"></path>
    <path fill="#fbc02d" d="M27.463,6.999c1.073-0.002,2.104-0.716,3.001-0.198c0.897,0.519,1.66,1.27,2.197,2.201l10.39,17.996 c0.537,0.93,0.807,1.967,0.808,3.002c0.001,1.037-1.267,2.073-1.806,3.001l-11.127-3.005l-6.924-11.993L27.463,6.999z"></path>
    <path fill="#e53935" d="M43.86,30c0,1.04-0.27,2.07-0.81,3l-3.67,6.35c-0.53,0.78-1.21,1.4-1.99,1.85L30.92,30H43.86z"></path>
    <path fill="#4caf50" d="M5.947,33.001c-0.538-0.928-1.806-1.964-1.806-3c0.001-1.036,0.27-2.073,0.808-3.004l10.39-17.996 c0.537-0.93,1.3-1.682,2.196-2.2c0.897-0.519,1.929,0.195,3.002,0.197l3.459,11.009l-6.922,11.989L5.947,33.001z"></path>
    <path fill="#1565c0" d="M17.08,30l-6.47,11.2c-0.78-0.45-1.46-1.07-1.99-1.85L4.95,33c-0.54-0.93-0.81-1.96-0.81-3H17.08z"></path>
    <path fill="#2e7d32" d="M30.46,6.8L24,18L17.53,6.8c0.78-0.45,1.66-0.73,2.6-0.79L27.46,6C28.54,6,29.57,6.28,30.46,6.8z"></path>
  </svg>
);

const DropboxIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="28" height="28" viewBox="0 0 48 48">
    <path fill="#1E88E5" d="M42 13.976L31.377 7.255 24 13.314 35.026 19.732zM6 25.647L16.933 32.055 24 26.633 13.528 19.969zM16.933 7.255L6 14.301 13.528 19.969 24 13.314zM24 26.633L31.209 32.055 42 25.647 35.026 19.732z"></path>
    <path fill="#1E88E5" d="M32.195 33.779L31.047 34.462 29.979 33.658 24 29.162 18.155 33.646 17.091 34.464 15.933 33.785 13 32.066 13 34.738 23.988 42 35 34.794 35 32.114z"></path>
  </svg>
);

const OneDriveIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="#0078d4" width="22" height="20">
    <path d="M10.5 18H20a4 4 0 0 0 0-8h-.35A5.5 5.5 0 0 0 9 8.5a5.4 5.4 0 0 0 .28 1.65A4.5 4.5 0 0 0 6.5 18h4z" />
  </svg>
);

export default CloudStorageSettings;
