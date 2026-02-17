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
  <svg viewBox="0 0 87.3 78" width="22" height="20">
    <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H1.05c0 1.6.4 3.2 1.2 4.6l4.35 9.25z" fill="#0066da" />
    <path d="M43.65 25.15L29.9 1.35c-1.35.8-2.5 1.9-3.3 3.3L1.2 52.7c-.8 1.4-1.2 3-1.2 4.6h27.45l16.2-32.15z" fill="#00ac47" />
    <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-3 1.2-4.6H59.85l6.1 12.5 7.6 11.4z" fill="#ea4335" />
    <path d="M43.65 25.15L57.4 1.35C56.05.55 54.5 0 52.85 0H34.45c-1.65 0-3.2.55-4.55 1.35l13.75 23.8z" fill="#00832d" />
    <path d="M59.85 52.7h27.45c0-1.6-.4-3.2-1.2-4.6L73.55 27.5c-.8-1.4-1.95-2.5-3.3-3.3L57.4 1.35l-13.75 23.8 16.2 27.55z" fill="#2684fc" />
    <path d="M27.45 52.7L13.85 76.5c1.35.8 2.9 1.3 4.55 1.3h50.5c1.65 0 3.2-.5 4.55-1.3L59.85 52.7H27.45z" fill="#ffba00" />
  </svg>
);

const DropboxIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="22" height="20">
    <path fill="#0061FE" d="M6 1.5L0 5l6 3.5L0 12l6 3.5 6-3.5-6-3.5L12 5l-6-3.5zm6 0L6 5l6 3.5L18 5l-6-3.5zm6 7L12 12l6 3.5 6-3.5-6-3.5zM6 15.5L0 12l6-3.5L12 12l-6 3.5zm6 0l6-3.5 6 3.5-6 3.5-6-3.5z" transform="translate(0, 2.5)" />
  </svg>
);

const OneDriveIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="#0078d4" width="22" height="20">
    <path d="M10.5 18H20a4 4 0 0 0 0-8h-.35A5.5 5.5 0 0 0 9 8.5a5.4 5.4 0 0 0 .28 1.65A4.5 4.5 0 0 0 6.5 18h4z" />
  </svg>
);

export default CloudStorageSettings;
