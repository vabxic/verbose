import { supabase } from './supabase';
import {
  getActiveCloudSettings,
  ensureValidToken,
  getCloudProvider,
} from './cloud-storage';
import type { CloudSettings } from './cloud-storage';

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
 * Strategy:
 *   1. If the user has a connected cloud provider → upload to their cloud.
 *   2. Otherwise → fallback to Supabase Storage.
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
  // Check if user has active cloud storage
  const cloudSettings = await getActiveCloudSettings(uploaderId);

  if (cloudSettings) {
    return uploadToCloud(roomId, uploaderId, uploaderName, file, cloudSettings, onProgress);
  }

  return uploadToSupabase(roomId, uploaderId, uploaderName, file, onProgress);
}

// ── Cloud upload path ───────────────────────────

async function uploadToCloud(
  roomId: string,
  uploaderId: string,
  uploaderName: string,
  file: File,
  settings: CloudSettings,
  onProgress?: (p: UploadProgress) => void,
): Promise<RoomFile> {
  const provider = getCloudProvider(settings.provider as any);
  const accessToken = await ensureValidToken(uploaderId, settings);
  const folderId = settings.folder_id!;

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
      storage_path: '', // empty – not using Supabase Storage
      status: 'uploading',
      cloud_provider: settings.provider,
    })
    .select()
    .single();

  if (metaErr) throw metaErr;

  try {
    // 2. Upload directly to user's cloud
    const result = await provider.upload(accessToken, folderId, file, (pct) => {
      onProgress?.({
        percent: pct,
        bytesUploaded: Math.round((pct / 100) * file.size),
        totalBytes: file.size,
      });
    });

    // 3. Mark ready with cloud metadata
    const { data: updated, error: updateErr } = await supabase
      .from('room_files')
      .update({
        status: 'ready',
        cloud_file_id: result.fileId,
        cloud_share_url: result.shareUrl,
        storage_path: `cloud://${settings.provider}/${result.fileId}`,
      })
      .eq('id', meta.id)
      .select()
      .single();

    if (updateErr) throw updateErr;
    return updated as RoomFile;
  } catch (err) {
    await supabase
      .from('room_files')
      .update({ status: 'failed' })
      .eq('id', meta.id);
    throw err;
  }
}

// ── Supabase Storage upload path (fallback) ─────

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
  } catch (err) {
    // Mark failed
    await supabase
      .from('room_files')
      .update({ status: 'failed' })
      .eq('id', meta.id);
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
