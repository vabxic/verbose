import { db, storage } from './db';
import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  listAll,
} from 'firebase/storage';
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
  // Cloud columns (NULL when using Firebase Storage)
  cloud_provider: string | null;
  cloud_file_id: string | null;
  cloud_share_url: string | null;
}

// ── Helpers ─────────────────────────────────────

export class SaveToDriveFetchError extends Error {
  downloadUrl?: string | null;
  constructor(message: string, downloadUrl?: string | null) {
    super(message);
    this.name = 'SaveToDriveFetchError';
    this.downloadUrl = downloadUrl ?? null;
  }
}

/** Human-readable file size */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return value.toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
}

/** Pick an icon name based on MIME type */
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
 * Files always go to Firebase Storage so every room member can access them.
 * Recipients can save any file to their own connected Drive via saveFileToDrive().
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
  if (file.size > DRIVE_THRESHOLD) {
    try {
      return await uploadToDrive(roomId, uploaderId, uploaderName, file, onProgress);
    } catch (err) {
      console.warn('[drive] Drive upload failed, falling back to Firebase Storage:', err);
      return uploadToFirebaseStorage(roomId, uploaderId, uploaderName, file, onProgress);
    }
  }

  return uploadToFirebaseStorage(roomId, uploaderId, uploaderName, file, onProgress);
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
  if (!cloudSettings) throw new Error('No cloud storage connected for this user.');

  // 1. Insert metadata row (status = uploading)
  const now = new Date().toISOString();
  const metaData = {
    room_id: roomId,
    uploader_id: uploaderId,
    uploader_name: uploaderName,
    file_name: file.name,
    file_size: file.size,
    mime_type: file.type || 'application/octet-stream',
    storage_path: '',
    status: 'uploading' as const,
    cloud_provider: cloudSettings.provider,
    cloud_file_id: null,
    cloud_share_url: null,
    created_at: now,
  };
  const metaRef = await addDoc(collection(db, 'room_files'), metaData);

  try {
    const provider = getCloudProvider(cloudSettings.provider as any);
    const accessToken = await ensureValidToken(uploaderId, cloudSettings);
    const folderId = cloudSettings.folder_id || (await provider.ensureFolder(accessToken, 'Verbose'));

    const result = await provider.upload(accessToken, folderId, file, (pct) => {
      onProgress?.({ percent: pct, bytesUploaded: Math.round((pct / 100) * file.size), totalBytes: file.size });
    });

    // 3. Update row with cloud info and mark ready
    await updateDoc(metaRef, {
      status: 'ready',
      cloud_provider: result.provider,
      cloud_file_id: result.fileId,
      cloud_share_url: result.shareUrl,
      storage_path: '',
    });

    return { id: metaRef.id, ...metaData, status: 'ready', cloud_provider: result.provider, cloud_file_id: result.fileId, cloud_share_url: result.shareUrl };
  } catch (err) {
    try { await updateDoc(metaRef, { status: 'failed' }); } catch {}
    throw err;
  }
}

/**
 * Copy a room file to the current user's connected cloud Drive.
 */
export async function saveFileToDrive(
  file: RoomFile,
  userId: string,
  onProgress?: (p: UploadProgress) => void,
): Promise<void> {
  const cloudSettings = await getActiveCloudSettings(userId);
  if (!cloudSettings) throw new Error('Connect Google Drive first in cloud storage settings.');

  let response: Response | null = null;

  if (file.cloud_provider && file.cloud_file_id && file.cloud_provider === 'google_drive') {
    const driveDownload = 'https://www.googleapis.com/drive/v3/files/' + file.cloud_file_id + '?alt=media';
    try {
      response = await fetch(driveDownload);
      if (!response.ok) response = null;
    } catch { response = null; }
  }

  if (!response) {
    const downloadUrl = await getFileUrl(file);
    try {
      response = await fetch(downloadUrl);
    } catch (err: any) {
      const msg = String(err?.message || err || 'Failed to fetch');
      if (err instanceof TypeError || msg.toLowerCase().includes('failed to fetch')) {
        throw new SaveToDriveFetchError(
          'Failed to fetch file. This is often caused by CORS or the file not being publicly accessible. Try opening the Room Drive and downloading manually, or ask the sender to make the file public.',
          downloadUrl,
        );
      }
      throw new SaveToDriveFetchError('Failed to fetch file: ' + msg, downloadUrl);
    }
  }

  if (!response || !response.ok) {
    const status = response ? response.status : 'network-error';
    try {
      const downloadUrl = await getFileUrl(file);
      throw new SaveToDriveFetchError('Failed to fetch file: ' + status, downloadUrl);
    } catch {
      throw new SaveToDriveFetchError('Failed to fetch file: ' + status, null);
    }
  }
  const blob = await response.blob();
  const fileObj = new File([blob], file.file_name, { type: file.mime_type || 'application/octet-stream' });

  const provider = getCloudProvider(cloudSettings.provider as any);
  const accessToken = await ensureValidToken(userId, cloudSettings);
  const folderId = cloudSettings.folder_id!;

  await provider.upload(accessToken, folderId, fileObj, (pct) => {
    onProgress?.({ percent: pct, bytesUploaded: Math.round((pct / 100) * file.file_size), totalBytes: file.file_size });
  });
}

// ── Firebase Storage upload path ────────────────

async function uploadToFirebaseStorage(
  roomId: string,
  uploaderId: string,
  uploaderName: string,
  file: File,
  onProgress?: (p: UploadProgress) => void,
): Promise<RoomFile> {
  const storagePath = 'room-files/' + roomId + '/' + uploaderId + '/' + Date.now() + '_' + file.name;

  // 1. Insert metadata row (status = uploading)
  const now = new Date().toISOString();
  const metaData = {
    room_id: roomId,
    uploader_id: uploaderId,
    uploader_name: uploaderName,
    file_name: file.name,
    file_size: file.size,
    mime_type: file.type || 'application/octet-stream',
    storage_path: storagePath,
    status: 'uploading' as const,
    cloud_provider: null,
    cloud_file_id: null,
    cloud_share_url: null,
    created_at: now,
  };
  const metaRef = await addDoc(collection(db, 'room_files'), metaData);

  // 2. Upload blob to Firebase Storage
  try {
    const fileRef = storageRef(storage, storagePath);
    await new Promise<void>((resolve, reject) => {
      const uploadTask = uploadBytesResumable(fileRef, file);
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          onProgress?.({ percent: pct, bytesUploaded: snapshot.bytesTransferred, totalBytes: snapshot.totalBytes });
        },
        (error) => reject(error),
        () => resolve(),
      );
    });

    // 3. Mark as ready
    await updateDoc(metaRef, { status: 'ready' });
    return { id: metaRef.id, ...metaData, status: 'ready' };
  } catch (err: any) {
    // If Firebase rejects due to size limits, try fallback: upload to user's Drive
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

          await updateDoc(metaRef, {
            status: 'ready',
            cloud_provider: result.provider,
            cloud_file_id: result.fileId,
            cloud_share_url: result.shareUrl,
            storage_path: '',
          });

          return { id: metaRef.id, ...metaData, status: 'ready', cloud_provider: result.provider, cloud_file_id: result.fileId, cloud_share_url: result.shareUrl, storage_path: '' };
        }
      } catch (driveErr) {
        console.warn('[drive] Fallback to Drive failed:', driveErr);
      }
    }

    try { await updateDoc(metaRef, { status: 'failed' }); } catch {}
    throw err;
  }
}

// ── List & fetch ────────────────────────────────

export async function getRoomFiles(roomId: string): Promise<RoomFile[]> {
  const q = query(
    collection(db, 'room_files'),
    where('room_id', '==', roomId),
    where('status', '==', 'ready'),
    orderBy('created_at', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RoomFile);
}

/** Get a download URL for a file. */
export async function getFileUrl(file: RoomFile): Promise<string> {
  // Cloud-hosted file -> use the public share URL directly
  if (file.cloud_share_url) return file.cloud_share_url;

  // Firebase Storage
  const fileRef = storageRef(storage, file.storage_path);
  return getDownloadURL(fileRef);
}

/** Get a URL optimised for inline viewing in the browser. */
export async function getFileViewUrl(file: RoomFile): Promise<string> {
  if (file.cloud_provider && file.cloud_file_id) {
    const provider = getCloudProvider(file.cloud_provider as any);
    return provider.getViewUrl(file.cloud_file_id);
  }

  // Firebase Storage download URLs work for inline viewing as well
  const fileRef = storageRef(storage, file.storage_path);
  return getDownloadURL(fileRef);
}

/**
 * Save a file available at `url` (or a data: URL) into the specified user's connected Drive.
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

  let blob: Blob;
  if (url.startsWith('data:')) {
    const match = url.match(/^data:(.*?);base64,(.*)$/);
    if (!match) throw new Error('Invalid data URL');
    const bstr = atob(match[2]);
    const u8 = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
    blob = new Blob([u8], { type: match[1] || mimeType || 'application/octet-stream' });
  } else {
    let resp: Response;
    try {
      resp = await fetch(url);
      if (!resp.ok) throw new Error('Fetch returned ' + resp.status);
    } catch (err) {
      const tryDriveDirect = (u: string) => {
        const fileIdMatch = u.match(/(?:\/d\/|open\?id=|id=)([a-zA-Z0-9_-]{10,})/);
        if (fileIdMatch) return 'https://drive.google.com/uc?export=download&id=' + fileIdMatch[1];
        return null;
      };

      const alt = tryDriveDirect(url);

      const tryProxyFetch = async (u: string) => {
        try {
          if (typeof window === 'undefined') return null;
          const proxy = window.location.origin + '/api/fetch-file?url=' + encodeURIComponent(u);
          const r = await fetch(proxy);
          if (!r.ok) throw new Error('Proxy returned ' + r.status);
          return r;
        } catch { return null; }
      };

      if (alt) {
        try {
          resp = await fetch(alt);
          if (!resp.ok) throw new Error('Drive direct download returned ' + resp.status);
        } catch (err2) {
          const proxied = await tryProxyFetch(url) ?? (await tryProxyFetch(alt));
          if (proxied) { resp = proxied; }
          else { throw new Error('Failed to fetch file for copying (tried original URL and Drive direct link): ' + String(err2) + '. If this is a Google Drive link ensure the file is shared publicly or use Room Drive to move the file.'); }
        }
      } else {
        const proxied = await tryProxyFetch(url);
        if (proxied) { resp = proxied; }
        else { throw new Error('Failed to fetch file for copying: ' + String(err) + '. This may be a CORS or sharing restriction. For Drive files, make them public or use Room Drive.'); }
      }
    }
    blob = await resp!.blob();
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
  // Cloud-hosted -> try to delete from user's cloud
  if (file.cloud_provider && file.cloud_file_id) {
    try {
      const settings = await getActiveCloudSettings(file.uploader_id);
      if (settings) {
        const provider = getCloudProvider(settings.provider as any);
        const token = await ensureValidToken(file.uploader_id, settings);
        await provider.deleteFile(token, file.cloud_file_id);
      }
    } catch (err) {
      console.warn('[drive] Could not delete cloud file:', err);
    }
  } else if (file.storage_path) {
    // Firebase Storage
    try {
      const fileRef = storageRef(storage, file.storage_path);
      await deleteObject(fileRef);
    } catch (err) {
      console.warn('[drive] Could not delete storage file:', err);
    }
  }

  // Remove metadata row
  await deleteDoc(doc(db, 'room_files', file.id));
}

/** Delete ALL files for a room (storage blobs + metadata rows). */
export async function deleteAllRoomFiles(roomId: string): Promise<void> {
  // 1. Fetch all file metadata
  const q = query(collection(db, 'room_files'), where('room_id', '==', roomId));
  const snap = await getDocs(q);
  if (snap.empty) return;

  // 2. Delete Firebase Storage blobs (best-effort)
  for (const d of snap.docs) {
    const f = d.data() as RoomFile;
    if (f.storage_path && !f.cloud_provider) {
      try {
        const fileRef = storageRef(storage, f.storage_path);
        await deleteObject(fileRef);
      } catch {}
    }
  }

  // 3. Also try to delete the room folder in Storage (best-effort)
  try {
    const folderRef = storageRef(storage, 'room-files/' + roomId);
    const list = await listAll(folderRef);
    await Promise.all(list.items.map((item) => deleteObject(item)));
  } catch {}

  // 4. Delete all metadata rows
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}

// ── Realtime ────────────────────────────────────

export function subscribeToRoomFiles(
  roomId: string,
  onChange: (files: RoomFile[]) => void,
) {
  const q = query(
    collection(db, 'room_files'),
    where('room_id', '==', roomId),
    where('status', '==', 'ready'),
    orderBy('created_at', 'desc'),
  );

  const unsub = onSnapshot(q, (snapshot) => {
    onChange(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as RoomFile));
  });

  return () => unsub();
}
