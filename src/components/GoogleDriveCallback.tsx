import React, { useEffect } from 'react';

/**
 * Minimal callback page for the Google Drive OAuth popup.
 *
 * The OAuth response lands here as a hash fragment
 * (e.g. #access_token=...&token_type=bearer&expires_in=3600&state=...).
 *
 * The opener window (cloud-storage.ts GoogleDriveProvider.authorize()) polls this
 * page's URL, reads the hash, and closes the popup automatically.
 *
 * All this component does is show a brief "Connecting…" message while the parent
 * window picks up the token.
 */
const GoogleDriveCallback: React.FC = () => {
  useEffect(() => {
    // If this page was opened as a popup, the parent will read the hash and close us.
    // If not, redirect home after a few seconds.
    const timer = setTimeout(() => {
      window.location.href = '/';
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      color: 'rgba(255,255,255,0.7)',
      fontFamily: 'system-ui, sans-serif',
      background: '#0a0a0f',
    }}>
      <p>Connecting to Google Drive…</p>
    </div>
  );
};

export default GoogleDriveCallback;
