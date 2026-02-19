/**
 * cloud-storage.ts – User-Owned Cloud Storage Abstraction
 *
 * Supports Google Drive (primary) with a provider interface so
 * Dropbox / OneDrive can be added later.
 *
 * Architecture:
 *   sender  → upload directly to user's Google Drive → share link stored in DB
 *   receiver→ download / view via share link (zero platform storage)
 */

import { supabase } from './supabase';

// ═══════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════

export type CloudProviderType = 'google_drive' | 'dropbox' | 'onedrive';

export interface CloudSettings {
  id: string;
  user_id: string;
  provider: CloudProviderType;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  provider_email: string | null;
  folder_id: string | null;
  folder_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CloudUploadResult {
  provider: CloudProviderType;
  fileId: string;
  shareUrl: string;
  fileName: string;
  mimeType: string;
}

export interface CloudProvider {
  type: CloudProviderType;
  /** Start OAuth flow (opens popup / redirect). Returns access token info. */
  authorize(): Promise<{ accessToken: string; email: string; expiresAt: Date }>;
  /** Ensure a dedicated app folder exists; returns folder ID. */
  ensureFolder(accessToken: string, folderName: string): Promise<string>;
  /** Upload a file and return a publicly-shared download URL. */
  upload(
    accessToken: string,
    folderId: string,
    file: File,
    onProgress?: (pct: number) => void,
  ): Promise<CloudUploadResult>;
  /** Delete a file by provider ID. */
  deleteFile(accessToken: string, fileId: string): Promise<void>;
  /** Get direct download URL (for inline view). */
  getViewUrl(fileId: string): string;
}

// ═══════════════════════════════════════════════════
// Google Drive Provider
// ═══════════════════════════════════════════════════

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID ?? '';
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';

class GoogleDriveProvider implements CloudProvider {
  type: CloudProviderType = 'google_drive';

  // ── OAuth via popup (implicit grant) ──────────
  authorize(): Promise<{ accessToken: string; email: string; expiresAt: Date }> {
    return new Promise((resolve, reject) => {
      if (!GOOGLE_CLIENT_ID) {
        reject(new Error('Google Drive client ID not configured. Set VITE_GOOGLE_DRIVE_CLIENT_ID in your .env file.'));
        return;
      }

      const redirectUri = `${window.location.origin}/auth/google-drive/callback`;
      const state = crypto.randomUUID();
      sessionStorage.setItem('gdrive_oauth_state', state);

      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'token',
        scope: GOOGLE_SCOPES,
        state,
        prompt: 'consent',
        include_granted_scopes: 'true',
      });

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        authUrl,
        'google_drive_auth',
        `width=${width},height=${height},left=${left},top=${top},popup=1`,
      );

      if (!popup) {
        reject(new Error('Popup blocked. Please allow popups for this site.'));
        return;
      }

      // Listen for postMessage from the callback page (avoids COOP issues)
      const onMessage = async (event: MessageEvent) => {
        // Only accept messages from our own origin
        if (event.origin !== window.location.origin) return;

        if (event.data?.type === 'google-drive-oauth-error') {
          cleanup();
          reject(new Error(event.data.error || 'Authorization failed.'));
          return;
        }

        if (event.data?.type !== 'google-drive-oauth-result') return;

        cleanup();

        const { accessToken: token, expiresIn: expIn, state: returnedState } = event.data;

        if (returnedState !== state) {
          reject(new Error('OAuth state mismatch.'));
          return;
        }

        if (!token) {
          reject(new Error('No access token received.'));
          return;
        }

        const expiresIn = parseInt(expIn || '3600', 10);

        try {
          // Fetch user email from Google
          const userResp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const userInfo = await userResp.json();

          resolve({
            accessToken: token,
            email: userInfo.email ?? '',
            expiresAt: new Date(Date.now() + expiresIn * 1000),
          });
        } catch (err) {
          reject(new Error('Failed to fetch user info from Google.'));
        }
      };

      // Also poll popup.closed as a fallback (some browsers allow it)
      const closedPoll = setInterval(() => {
        try {
          if (popup.closed) {
            cleanup();
            // Check sessionStorage fallback (for non-opener scenarios)
            const stored = sessionStorage.getItem('gdrive_oauth_result');
            if (stored) {
              sessionStorage.removeItem('gdrive_oauth_result');
              const data = JSON.parse(stored);
              onMessage({ origin: window.location.origin, data } as MessageEvent);
            } else {
              reject(new Error('Authorization cancelled.'));
            }
          }
        } catch {
          // COOP may block this — that's fine, postMessage will handle it
        }
      }, 1000);

      window.addEventListener('message', onMessage);

      function cleanup() {
        window.removeEventListener('message', onMessage);
        clearInterval(closedPoll);
        clearTimeout(timeout);
        try {
          popup?.close();
        } catch (err) {
          // Ignore errors when closing the popup (COOP / blocked)
        }
      }

      // Timeout after 5 minutes
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Authorization timed out.'));
      }, 5 * 60 * 1000);
    });
  }

  // ── Ensure a "Verbose" folder in Drive ────────
  async ensureFolder(accessToken: string, folderName: string): Promise<string> {
    // Search for existing folder
    const q = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const searchResp = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!searchResp.ok) {
      const body = await searchResp.text();
      console.warn('[CloudStorage] Drive folder search failed', { status: searchResp.status, body });
      throw new Error(`Drive folder search failed: ${searchResp.status} ${body}`);
    }
    const searchData = await searchResp.json();

    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id;
    }

    // Create folder
    const createResp = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });
    if (!createResp.ok) {
      const body = await createResp.text();
      console.warn('[CloudStorage] Drive folder create failed', { status: createResp.status, body });
      throw new Error(`Drive folder create failed: ${createResp.status} ${body}`);
    }
    const folder = await createResp.json();
    return folder.id;
  }

  // ── Upload file to Google Drive ───────────────
  async upload(
    accessToken: string,
    folderId: string,
    file: File,
    onProgress?: (pct: number) => void,
  ): Promise<CloudUploadResult> {
    // Use multipart upload for files up to ~5 MB, resumable for larger
    const useResumable = file.size > 5 * 1024 * 1024;

    let fileId: string;

    if (useResumable) {
      fileId = await this.resumableUpload(accessToken, folderId, file, onProgress);
    } else {
      fileId = await this.multipartUpload(accessToken, folderId, file);
      onProgress?.(100);
    }

    // Make file publicly viewable via link
    await this.shareFile(accessToken, fileId);

    const shareUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

    return {
      provider: 'google_drive',
      fileId,
      shareUrl,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
    };
  }

  private async multipartUpload(
    accessToken: string,
    folderId: string,
    file: File,
  ): Promise<string> {
    const metadata = {
      name: `${Date.now()}_${file.name}`,
      parents: [folderId],
    };

    const boundary = '---verbose_boundary_' + crypto.randomUUID();
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metaPart =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata);

    const fileArrayBuffer = await file.arrayBuffer();

    // Build multipart body
    const encoder = new TextEncoder();
    const metaBytes = encoder.encode(metaPart);
    const fileHeaderBytes = encoder.encode(
      delimiter + `Content-Type: ${file.type || 'application/octet-stream'}\r\nContent-Transfer-Encoding: binary\r\n\r\n`,
    );
    const closeBytes = encoder.encode(closeDelimiter);

    const body = new Uint8Array(
      metaBytes.length + fileHeaderBytes.length + fileArrayBuffer.byteLength + closeBytes.length,
    );
    let offset = 0;
    body.set(metaBytes, offset); offset += metaBytes.length;
    body.set(fileHeaderBytes, offset); offset += fileHeaderBytes.length;
    body.set(new Uint8Array(fileArrayBuffer), offset); offset += fileArrayBuffer.byteLength;
    body.set(closeBytes, offset);

    const resp = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      },
    );

    if (!resp.ok) {
      const text = await resp.text();
      console.warn('[CloudStorage] Google Drive multipart upload failed', { status: resp.status, body: text });
      throw new Error(`Google Drive upload failed: ${resp.status} ${text}`);
    }

    const data = await resp.json();
    return data.id;
  }

  private async resumableUpload(
    accessToken: string,
    folderId: string,
    file: File,
    onProgress?: (pct: number) => void,
  ): Promise<string> {
    // Step 1: Initiate resumable session
    const metadata = {
      name: `${Date.now()}_${file.name}`,
      parents: [folderId],
    };

    const initResp = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': file.type || 'application/octet-stream',
          'X-Upload-Content-Length': String(file.size),
        },
        body: JSON.stringify(metadata),
      },
    );

    if (!initResp.ok) {
      const body = await initResp.text();
      console.warn('[CloudStorage] Resumable upload init failed', { status: initResp.status, body });
      throw new Error(`Resumable upload init failed: ${initResp.status} ${body}`);
    }

    const uploadUri = initResp.headers.get('Location');
    if (!uploadUri) {
      const text = await initResp.text();
      console.warn('[CloudStorage] Resumable upload init missing Location header', { status: initResp.status, body: text });
      throw new Error('No resumable upload URI returned.');
    }

    // Step 2: Upload the file with XHR for progress tracking
    return new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUri, true);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          onProgress?.(Math.round((e.loaded / e.total) * 100));
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(data.id);
          } catch {
            reject(new Error('Failed to parse upload response'));
          }
        } else {
          reject(new Error(`Upload chunk failed: ${xhr.status} ${xhr.responseText}`));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
      xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

      xhr.send(file);
    });
  }

  // ── Share file via link (anyone with link can view) ──
  private async shareFile(accessToken: string, fileId: string): Promise<void> {
    const resp = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone',
        }),
      },
    );

    if (!resp.ok) {
      const body = await resp.text();
      console.warn('[CloudStorage] Could not share file', { fileId, status: resp.status, body });
      // Keep silent for users but throw to bubble up in dev flows
      throw new Error(`Drive share failed: ${resp.status} ${body}`);
    }
  }

  // ── Delete ────────────────────────────────────
  async deleteFile(accessToken: string, fileId: string): Promise<void> {
    const resp = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    if (!resp.ok && resp.status !== 404) {
      throw new Error(`Delete failed: ${resp.status}`);
    }
  }

  // ── View helper ───────────────────────────────
  getViewUrl(fileId: string): string {
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  }
}

// ═══════════════════════════════════════════════════
// Provider Registry
// ═══════════════════════════════════════════════════

const providers: Record<CloudProviderType, CloudProvider> = {
  google_drive: new GoogleDriveProvider(),
  dropbox: null as any, // placeholder – implement later
  onedrive: null as any, // placeholder – implement later
};

export function getCloudProvider(type: CloudProviderType): CloudProvider {
  const provider = providers[type];
  if (!provider) throw new Error(`Cloud provider "${type}" is not yet implemented.`);
  return provider;
}

// ═══════════════════════════════════════════════════
// DB helpers – user cloud settings
// ═══════════════════════════════════════════════════

/** Get the active cloud setting for the current user (if any). */
export async function getActiveCloudSettings(userId: string): Promise<CloudSettings | null> {
  const { data, error } = await supabase
    .from('user_cloud_settings')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[CloudStorage] Error fetching cloud settings:', error);
    return null;
  }
  return data as CloudSettings | null;
}

/** Save or update cloud settings after OAuth. */
export async function saveCloudSettings(
  userId: string,
  provider: CloudProviderType,
  accessToken: string,
  email: string,
  expiresAt: Date,
  folderId: string,
  folderName: string,
): Promise<CloudSettings> {
  const { data, error } = await supabase
    .from('user_cloud_settings')
    .upsert(
      {
        user_id: userId,
        provider,
        access_token: accessToken,
        provider_email: email,
        token_expires_at: expiresAt.toISOString(),
        folder_id: folderId,
        folder_name: folderName,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,provider' },
    )
    .select()
    .single();

  if (error) throw error;
  return data as CloudSettings;
}

/** Disconnect a cloud provider. */
export async function disconnectCloudProvider(userId: string, provider: CloudProviderType): Promise<void> {
  const { error } = await supabase
    .from('user_cloud_settings')
    .delete()
    .eq('user_id', userId)
    .eq('provider', provider);

  if (error) throw error;
}

/** Check whether the stored token is still valid. */
export function isTokenExpired(settings: CloudSettings): boolean {
  if (!settings.token_expires_at) return false;
  // Add 60s buffer
  return new Date(settings.token_expires_at).getTime() - 60_000 < Date.now();
}

/** Re-authorize if token is expired. Returns a fresh access token. */
export async function ensureValidToken(userId: string, settings: CloudSettings): Promise<string> {
  if (!isTokenExpired(settings)) {
    return settings.access_token;
  }

  // Token expired → re-authorize
  const provider = getCloudProvider(settings.provider);
  const auth = await provider.authorize();

  // Update in DB
  await supabase
    .from('user_cloud_settings')
    .update({
      access_token: auth.accessToken,
      provider_email: auth.email,
      token_expires_at: auth.expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('provider', settings.provider);

  return auth.accessToken;
}
