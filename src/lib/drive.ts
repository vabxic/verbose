import { supabase } from './supabase';
import {
  getActiveCloudSettings,
  ensureValidToken,
  getCloudProvider,
} from './cloud-storage';
import type { CloudUploadResult } from './cloud-storage';

// ── Types ───────────────────────────────────────
export interface RoomFile {
  id: string;
  room_id: string;
  uploader_id: string;
  uploader_name: string | null;
  file_name: string;
  file_size: number;
  mime_type: string | null;
  storage_path: string;
  status: 'uploading' | 'ready' | 'failed';
  created_at: string;
  // Cloud columns (NULL when using Supabase Storage)
  cloud_provider: string | null;
  cloud_file_id: string | null;
  cloud_share_url: string | null;
}

const BUCKET = 'room-files';

// ── Helpers ─────────────────────────────────────

/** Human-readable file size */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Pick an icon name based on MIME type (returns a label for the UI) */
export function fileCategory(mime: string | null): 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other' {
  if (!mime) return 'other';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (
    mime.includes('pdf') ||
    mime.includes('word') ||
    mime.includes('document') ||
    mime.includes('text') ||
    mime.includes('spreadsheet') ||
    mime.includes('presentation')
  )
    return 'document';
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('tar') || mime.includes('7z'))
    return 'archive';
  return 'other';
}

// ── Upload ──────────────────────────────────────

export interface UploadProgress {
  percent: number;
  bytesUploaded: number;
  totalBytes: number;
}

/**
 * Upload a file to a room's drive.
 *
 * Files always go to Supabase Storage so every room member can access them.
 * Recipients can save any file to their own connected Drive via saveFileToDrive().
 *
 * Returns the inserted RoomFile row (status: 'ready').
 */
export async function uploadRoomFile(
  roomId: string,
  uploaderId: string,
  uploaderName: string,
  file: File,
  onProgress?: (p: UploadProgress) => void,
): Promise<RoomFile> {
  const DRIVE_THRESHOLD = 50 * 1024 * 1024; // 50 MB

  // For large files, prefer uploading directly to the sender's connected cloud Drive
  // so the file does not consume Supabase storage. If the sender has no cloud
  // provider connected, fall back to Supabase Storage.
  if (file.size > DRIVE_THRESHOLD) {
    try {
      return await uploadToDrive(roomId, uploaderId, uploaderName, file, onProgress);
    } catch (err) {
      // If drive upload fails for any reason, log and fall back to Supabase
      console.warn('[drive] Drive upload failed, falling back to Supabase:', err);
      return uploadToSupabase(roomId, uploaderId, uploaderName, file, onProgress);
    }
  }

  // Small files -> Supabase Storage as before
  return uploadToSupabase(roomId, uploaderId, uploaderName, file, onProgress);
}

/** Upload a file directly to the sender's connected cloud Drive and record it in DB. */
async function uploadToDrive(
  roomId: string,
  uploaderId: string,
  uploaderName: string,
  file: File,
  onProgress?: (p: UploadProgress) => void,
): Promise<RoomFile> {
  const cloudSettings = await getActiveCloudSettings(uploaderId);
  if (!cloudSettings) {
    throw new Error('No cloud storage connected for this user.');
  }

  // 1. Insert metadata row (status = uploading)
  const { data: meta, error: metaErr } = await supabase
    .from('room_files')
    .insert({
      room_id: roomId,
      uploader_id: uploaderId,
      uploader_name: uploaderName,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type || 'application/octet-stream',
      storage_path: '',
      status: 'uploading',
      cloud_provider: cloudSettings.provider,
      cloud_file_id: null,
      cloud_share_url: null,
    })
    .select()
    .single();

  if (metaErr) throw metaErr;

  try {
    const provider = getCloudProvider(cloudSettings.provider as any);
    const accessToken = await ensureValidToken(uploaderId, cloudSettings);
    const folderId = cloudSettings.folder_id || (await provider.ensureFolder(accessToken, 'Verbose'));

    const result = await provider.upload(accessToken, folderId, file, (pct) => {
      onProgress?.({ percent: pct, bytesUploaded: Math.round((pct / 100) * file.size), totalBytes: file.size });
    });

    // 3. Update row with cloud info and mark ready
    const { data: updated, error: updateErr } = await supabase
      .from('room_files')
      .update({
        status: 'ready',
        cloud_provider: result.provider,
        cloud_file_id: result.fileId,
        cloud_share_url: result.shareUrl,
        storage_path: '',
      })
      .eq('id', (meta as any).id)
      .select()
      .single();

    if (updateErr) throw updateErr;
    return updated as RoomFile;
  } catch (err) {
    // Mark failed
    try {
      await supabase
        .from('room_files')
        .update({ status: 'failed' })
        .eq('id', (meta as any).id);
    } catch {}
    throw err;
  }
}

/**
 * Copy a room file to the current user's connected cloud Drive.
 *
 * Used by recipients who want the file in their own Drive.
 * Fetches the file from storage, then uploads it to their Drive folder.
 */
export async function saveFileToDrive(
  file: RoomFile,
  userId: string,
  onProgress?: (p: UploadProgress) => void,
): Promise<void> {
  const cloudSettings = await getActiveCloudSettings(userId);
  if (!cloudSettings) {
    throw new Error('Connect Google Drive first in cloud storage settings.');
  }

  // 1. Get download URL
  // 1. Try provider-optimized download for cloud-hosted files (avoids CORS issues)
  let response: Response | null = null;

  if (file.cloud_provider && file.cloud_file_id && file.cloud_provider === 'google_drive') {
    // Prefer Drive API download endpoint which supports CORS for public files
    const driveDownload = `https://www.googleapis.com/drive/v3/files/${file.cloud_file_id}?alt=media`;
    try {
      response = await fetch(driveDownload);
      if (!response.ok) {
        // Fall back to signed/shared URL
        response = null;
      }
    } catch (err) {
      response = null;
    }
  }

  // Fallback: fetch the signed or share URL (works for Supabase signed URLs)
  if (!response) {
    const downloadUrl = await getFileUrl(file);
    try {
      response = await fetch(downloadUrl);
    } catch (err: any) {
      // Typical causes: network error or CORS blocking.
      const msg = String(err?.message || err || 'Failed to fetch');
      if (err instanceof TypeError || msg.toLowerCase().includes('failed to fetch')) {
        throw new Error(
          'Failed to fetch file. This is often caused by CORS or the file not being publicly accessible. Try opening the Room Drive and downloading manually, or ask the sender to make the file public.'
        );
      }
      throw new Error(`Failed to fetch file: ${msg}`);
    }
  }

  if (!response || !response.ok) {
    const status = response ? response.status : 'network-error';
    throw new Error(`Failed to fetch file: ${status}`);
  }
  const blob = await response.blob();
  const fileObj = new File([blob], file.file_name, {
    type: file.mime_type || 'application/octet-stream',
  });

  // 3. Upload to user's Drive folder
  const provider = getCloudProvider(cloudSettings.provider as any);
  const accessToken = await ensureValidToken(userId, cloudSettings);
  const folderId = cloudSettings.folder_id!;

  await provider.upload(accessToken, folderId, fileObj, (pct) => {
    onProgress?.({
      percent: pct,
      bytesUploaded: Math.round((pct / 100) * file.file_size),
      totalBytes: file.file_size,
    });
  });
}

// ── Supabase Storage upload path ───────────────

async function uploadToSupabase(
  roomId: string,
  uploaderId: string,
  uploaderName: string,
  file: File,
  onProgress?: (p: UploadProgress) => void,
): Promise<RoomFile> {
  const storagePath = `${roomId}/${uploaderId}/${Date.now()}_${file.name}`;

  // 1. Insert metadata row (status = uploading)
  const { data: meta, error: metaErr } = await supabase
    .from('room_files')
    .insert({
      room_id: roomId,
      uploader_id: uploaderId,
      uploader_name: uploaderName,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type || 'application/octet-stream',
      storage_path: storagePath,
      status: 'uploading',
    })
    .select()
    .single();

  if (metaErr) throw metaErr;

  // 2. Upload blob to Supabase Storage
  try {
    // Use XMLHttpRequest for progress tracking
    await uploadWithProgress(storagePath, file, onProgress);

    // 3. Mark as ready
    const { data: updated, error: updateErr } = await supabase
      .from('room_files')
      .update({ status: 'ready' })
      .eq('id', meta.id)
      .select()
      .single();

    if (updateErr) throw updateErr;
    return updated as RoomFile;
  } catch (err: any) {
    // If Supabase rejects due to object size limits, try fallback: upload to user's Drive
    const msg = String(err?.message || err || '');
    const isPayloadTooLarge = msg.includes('413') || msg.toLowerCase().includes('payload too large') || msg.toLowerCase().includes('exceeded the maximum');

    if (isPayloadTooLarge) {
      try {
        const cloudSettings = await getActiveCloudSettings(uploaderId);
        if (cloudSettings) {
          const provider = getCloudProvider(cloudSettings.provider as any);
          const accessToken = await ensureValidToken(uploaderId, cloudSettings);
          const folderId = cloudSettings.folder_id || (await provider.ensureFolder(accessToken, 'Verbose'));

          const result = await provider.upload(accessToken, folderId, file, (pct) => {
            onProgress?.({ percent: pct, bytesUploaded: Math.round((pct / 100) * file.size), totalBytes: file.size });
          });

          // Update existing metadata row with cloud info and mark ready
          const { data: updated, error: updateErr } = await supabase
            .from('room_files')
            .update({
              status: 'ready',
              cloud_provider: result.provider,
              cloud_file_id: result.fileId,
              cloud_share_url: result.shareUrl,
              storage_path: '',
            })
            .eq('id', meta.id)
            .select()
            .single();

          if (updateErr) {
            // If updating the row fails, mark failed below
            throw updateErr;
          }

          return updated as RoomFile;
        }
      } catch (driveErr) {
        console.warn('[drive] Fallback to Drive failed:', driveErr);
        // proceed to mark failed and rethrow original err
      }
    }

    // Mark failed (original behavior)
    try {
      await supabase
        .from('room_files')
        .update({ status: 'failed' })
        .eq('id', meta.id);
    } catch {}

    throw err;
  }
}

/** Upload using the Supabase JS SDK (supports large files via tus internally). */
async function uploadWithProgress(
  storagePath: string,
  file: File,
  onProgress?: (p: UploadProgress) => void,
): Promise<void> {
  // supabase-js v2 doesn't expose progress natively for standard uploads.
  // We use the REST API with XMLHttpRequest for progress.
  const supabaseUrl = (supabase as any).supabaseUrl as string;
  const supabaseKey = (supabase as any).supabaseKey as string;
  const session = (await supabase.auth.getSession()).data.session;
  const token = session?.access_token ?? supabaseKey;

  const url = `${supabaseUrl}/storage/v1/object/${BUCKET}/${storagePath}`;

  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('apikey', supabaseKey);
    xhr.setRequestHeader('x-upsert', 'true');
    // Let browser set Content-Type with boundary for FormData

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress({
          percent: Math.round((e.loaded / e.total) * 100),
          bytesUploaded: e.loaded,
          totalBytes: e.total,
        });
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText} – ${xhr.responseText}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

    const formData = new FormData();
    formData.append('', file); // Supabase expects the file as unnamed field or raw body
    // Actually Supabase storage REST expects raw body:
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.send(file);
  });
}

// ── List & fetch ────────────────────────────────

export async function getRoomFiles(roomId: string): Promise<RoomFile[]> {
  const { data, error } = await supabase
    .from('room_files')
    .select('*')
    .eq('room_id', roomId)
    .eq('status', 'ready')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as RoomFile[];
}

/** Get a signed/share URL for downloading a file (valid 1 hour). */
export async function getFileUrl(file: RoomFile): Promise<string> {
  // Cloud-hosted file → use the public share URL directly
  if (file.cloud_share_url) {
    return file.cloud_share_url;
  }

  // Supabase Storage
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(file.storage_path, 3600);

  if (error) throw error;
  return data.signedUrl;
}

/**
 * Get a URL optimised for inline viewing in the browser.
 */
export async function getFileViewUrl(file: RoomFile): Promise<string> {
  // Cloud-hosted → use provider's view URL
  if (file.cloud_provider && file.cloud_file_id) {
    const provider = getCloudProvider(file.cloud_provider as any);
    return provider.getViewUrl(file.cloud_file_id);
  }

  // Supabase Storage
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(file.storage_path, 3600);

  if (error) throw error;
  const url = new URL(data.signedUrl);
  url.searchParams.delete('download');
  return url.toString();
}

/**
 * Save a file available at `url` (or a data: URL) into the specified user's connected Drive.
 * Returns the provider upload result.
 */
export async function saveUrlToDrive(
  url: string,
  userId: string,
  fileName: string,
  mimeType: string | null,
  onProgress?: (p: UploadProgress) => void,
): Promise<CloudUploadResult> {
  const cloudSettings = await getActiveCloudSettings(userId);
  if (!cloudSettings) throw new Error('Connect Google Drive first in cloud storage settings.');

  // Convert data: URL directly to blob
  let blob: Blob;
  if (url.startsWith('data:')) {
    const match = url.match(/^data:(.*?);base64,(.*)$/);
    if (!match) throw new Error('Invalid data URL');
    const bstr = atob(match[2]);
    const u8 = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
    blob = new Blob([u8], { type: match[1] || mimeType || 'application/octet-stream' });
  } else {
    // Remote URL — fetch the resource (may fail due to CORS)
    let resp: Response;
    try {
      resp = await fetch(url);
      if (!resp.ok) throw new Error(`Fetch returned ${resp.status}`);
    } catch (err) {
      // Some shared links (notably Google Drive) require a different direct-download URL
      // Attempt common Drive URL transforms before failing to give the client a better chance.
      const tryDriveDirect = (u: string) => {
        const fileIdMatch = u.match(/(?:\/d\/|open\?id=|id=)([a-zA-Z0-9_-]{10,})/);
        if (fileIdMatch) return `https://drive.google.com/uc?export=download&id=${fileIdMatch[1]}`;
        return null;
      };

      const alt = tryDriveDirect(url);

      // Helper to try the server-side proxy (if running on a deployed host with /api/fetch-file)
      const tryProxyFetch = async (u: string) => {
        try {
          if (typeof window === 'undefined') return null;
          const proxy = `${window.location.origin}/api/fetch-file?url=${encodeURIComponent(u)}`;
          const r = await fetch(proxy);
          if (!r.ok) throw new Error(`Proxy returned ${r.status}`);
          return r;
        } catch {
          return null;
        }
      };

      if (alt) {
        try {
          resp = await fetch(alt);
          if (!resp.ok) throw new Error(`Drive direct download returned ${resp.status}`);
        } catch (err2) {
          // Try server proxy as a last resort (handles CORS by fetching server-side)
          const proxied = await tryProxyFetch(url) ?? (await tryProxyFetch(alt));
          if (proxied) {
            resp = proxied;
          } else {
            throw new Error(
              `Failed to fetch file for copying (tried original URL and Drive direct link): ${String(err2)}. ` +
                'If this is a Google Drive link ensure the file is shared publicly or use Room Drive to move the file.'
            );
          }
        }
      } else {
        // No Drive-style alt; try server proxy before failing
        const proxied = await tryProxyFetch(url);
        if (proxied) {
          resp = proxied;
        } else {
          throw new Error(
            `Failed to fetch file for copying: ${String(err)}. ` +
              'This may be a CORS or sharing restriction. For Drive files, make them public or use Room Drive.'
          );
        }
      }
    }
    blob = await resp.blob();
  }

  const fileObj = new File([blob], fileName, { type: mimeType || 'application/octet-stream' });

  const provider = getCloudProvider(cloudSettings.provider as any);
  const accessToken = await ensureValidToken(userId, cloudSettings);
  const folderId = cloudSettings.folder_id || (await provider.ensureFolder(accessToken, 'Verbose'));

  const result = await provider.upload(accessToken, folderId, fileObj, (pct) => {
    onProgress?.({ percent: pct, bytesUploaded: Math.round((pct / 100) * fileObj.size), totalBytes: fileObj.size });
  });

  return result;
}

/** Can this MIME type be previewed inline in the browser? */
export function isPreviewable(mime: string | null): boolean {
  if (!mime) return false;
  return (
    mime.startsWith('image/') ||
    mime.startsWith('video/') ||
    mime.startsWith('audio/') ||
    mime === 'application/pdf'
  );
}

// ── Delete ──────────────────────────────────────

export async function deleteRoomFile(file: RoomFile): Promise<void> {
  // Cloud-hosted → try to delete from user's cloud
  if (file.cloud_provider && file.cloud_file_id) {
    try {
      // We need the uploader's access token to delete from their cloud
      const settings = await getActiveCloudSettings(file.uploader_id);
      if (settings) {
        const provider = getCloudProvider(settings.provider as any);
        const token = await ensureValidToken(file.uploader_id, settings);
        await provider.deleteFile(token, file.cloud_file_id);
      }
    } catch (err) {
      console.warn('[drive] Could not delete cloud file:', err);
      // Continue to remove metadata row regardless
    }
  } else if (file.storage_path && !file.storage_path.startsWith('cloud://')) {
    // Supabase Storage
    await supabase.storage.from(BUCKET).remove([file.storage_path]);
  }

  // Remove metadata row
  const { error } = await supabase
    .from('room_files')
    .delete()
    .eq('id', file.id);

  if (error) throw error;
}

/**
 * Delete ALL files for a room (storage blobs + metadata rows).
 * Called when a room is closed / deactivated.
 */
export async function deleteAllRoomFiles(roomId: string): Promise<void> {
  // 1. Fetch every file (including non-ready) so we can remove blobs
  const { data: files, error: listErr } = await supabase
    .from('room_files')
    .select('*')
    .eq('room_id', roomId);

  if (listErr) {
    console.warn('[drive] Could not list room files for cleanup:', listErr.message);
    return;
  }

  if (!files || files.length === 0) return;

  // 2. Collect Supabase Storage paths to bulk-delete
  const storagePaths: string[] = [];
  for (const f of files as RoomFile[]) {
    if (f.storage_path && !f.storage_path.startsWith('cloud://')) {
      storagePaths.push(f.storage_path);
    }
  }

  // 3. Remove blobs from Supabase Storage (best-effort)
  if (storagePaths.length > 0) {
    const { error: rmErr } = await supabase.storage.from(BUCKET).remove(storagePaths);
    if (rmErr) console.warn('[drive] Could not remove storage blobs:', rmErr.message);
  }

  // 4. Delete all metadata rows for this room
  const { error: delErr } = await supabase
    .from('room_files')
    .delete()
    .eq('room_id', roomId);

  if (delErr) console.warn('[drive] Could not delete room_files rows:', delErr.message);
}

// ── Realtime ────────────────────────────────────

export function subscribeToRoomFiles(
  roomId: string,
  onChange: (files: RoomFile[]) => void,
) {
  const channel = supabase
    .channel(`room-files-${roomId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'room_files',
        filter: `room_id=eq.${roomId}`,
      },
      async () => {
        // Re-fetch full list on any change
        const files = await getRoomFiles(roomId);
        onChange(files);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
