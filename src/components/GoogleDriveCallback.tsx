import React, { useEffect, useState } from 'react';

/**
 * Callback page for the Google Drive OAuth popup.
 *
 * The OAuth response lands here as a hash fragment
 * (e.g. #access_token=...&token_type=bearer&expires_in=3600&state=...).
 *
 * This page parses the hash and sends the token back to the opener
 * window via postMessage (avoids Cross-Origin-Opener-Policy issues).
 */
const GoogleDriveCallback: React.FC = () => {
  const [status, setStatus] = useState('Connecting to Google Drive…');

  useEffect(() => {
    try {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const accessToken = params.get('access_token');
      const expiresIn = params.get('expires_in');
      const state = params.get('state');
      const error = params.get('error');

      if (error) {
        const payload = { type: 'google-drive-oauth-error', error };
        if (window.opener) {
          window.opener.postMessage(payload, window.location.origin);
        }
        setStatus(`Authorization failed: ${error}`);
        setTimeout(() => window.close(), 2000);
        return;
      }

      if (accessToken) {
        const payload = {
          type: 'google-drive-oauth-result',
          accessToken,
          expiresIn: expiresIn || '3600',
          state: state || '',
        };

        if (window.opener) {
          window.opener.postMessage(payload, window.location.origin);
          setStatus('Connected! This window will close…');
          setTimeout(() => window.close(), 1000);
        } else {
          // Opened directly (not as popup) — store in sessionStorage as fallback
          sessionStorage.setItem('gdrive_oauth_result', JSON.stringify(payload));
          setStatus('Connected! Redirecting…');
          setTimeout(() => { window.location.href = '/'; }, 1500);
        }
      } else {
        setStatus('No token received. Please try again.');
        setTimeout(() => window.close(), 3000);
      }
    } catch (err) {
      console.error('OAuth callback error:', err);
      setStatus('Something went wrong. Please close this window and try again.');
      setTimeout(() => window.close(), 3000);
    }
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
      <p>{status}</p>
    </div>
  );
};

export default GoogleDriveCallback;
