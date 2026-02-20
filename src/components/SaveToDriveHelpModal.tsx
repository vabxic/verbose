import React from 'react';
import './SaveToDriveHelpModal.css';

interface Props {
  open: boolean;
  onClose: () => void;
  downloadUrl?: string | null;
  fileName?: string | null;
}

const SaveToDriveHelpModal: React.FC<Props> = ({ open, onClose, downloadUrl, fileName }) => {
  if (!open) return null;

  return (
    <div className="std-modal-overlay" onClick={onClose}>
      <div className="std-modal" onClick={(e) => e.stopPropagation()}>
        <header className="std-modal-header">
          <h3>Save to Drive failed</h3>
          <button className="std-modal-close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="std-modal-body">
          <p>
            The app couldn't fetch the file directly from its current URL. This is commonly caused by
            a privacy or CORS restriction on the file host (for example, Google Drive links that are
            not shared publicly).
          </p>

          <h4>Quick steps to make the file savable</h4>
          <ol>
            <li>Open the file in Google Drive.</li>
            <li>Right-click → <strong>Share</strong>.</li>
            <li>Under <strong>Get link</strong>, change from <em>Restricted</em> to <strong>Anyone with the link</strong>.</li>
            <li>Ensure the role is <strong>Viewer</strong>, then copy the link and try <em>Save to Drive</em> again.</li>
          </ol>

          <h4>Privacy-safe alternative</h4>
          <p>
            If you don't want to make the file public, move or upload it to the Room Drive. Files in the
            Room Drive can be saved by participants without changing sharing settings.
          </p>

          {downloadUrl && (
            <p>
              You can still download the file directly: <a href={downloadUrl} target="_blank" rel="noreferrer">{fileName || 'Open file'}</a>
            </p>
          )}

          <p className="std-note">Security note: "Anyone with the link" allows anyone who has the link to view the file — avoid for sensitive content.</p>
        </div>
        <footer className="std-modal-footer">
          <button className="std-btn" onClick={onClose}>Got it</button>
        </footer>
      </div>
    </div>
  );
};

export default SaveToDriveHelpModal;
