import { db, rtdb } from './db';
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  limit as firestoreLimit,
  onSnapshot,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import {
  ref as rtdbRef,
  set as rtdbSet,
  onValue,
  onDisconnect,
  serverTimestamp as rtdbServerTimestamp,
} from 'firebase/database';

// ── Types ───────────────────────────────────────

export interface DirectMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  type: 'text' | 'file' | 'system';
  file_metadata: FileMetadata | null;
  read: boolean;
  created_at: string;
}

export interface FileMetadata {
  fileName: string;
  fileSize: number;
  mimeType: string;
  url: string;
}

export interface UserPresence {
  user_id: string;
  is_online: boolean;
  last_seen: string;
}

// ── Helpers ─────────────────────────────────────

function toISO(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

// ── Presence (Firebase Realtime Database) ───────

export async function setOnline(userId: string): Promise<void> {
  try {
    if (!rtdb) return;
    const presenceRef = rtdbRef(rtdb, 'presence/' + userId);
    await rtdbSet(presenceRef, { is_online: true, last_seen: rtdbServerTimestamp() });
    // When this client disconnects, mark offline
    onDisconnect(presenceRef).set({ is_online: false, last_seen: rtdbServerTimestamp() });
  } catch (err) {
    console.warn('[friends-chat] Failed to set online:', err);
  }
}

export async function setOffline(userId: string): Promise<void> {
  try {
    if (!rtdb) return;
    const presenceRef = rtdbRef(rtdb, 'presence/' + userId);
    await rtdbSet(presenceRef, { is_online: false, last_seen: rtdbServerTimestamp() });
  } catch (err) {
    console.warn('[friends-chat] Failed to set offline:', err);
  }
}

export async function getPresence(userIds: string[]): Promise<UserPresence[]> {
  if (userIds.length === 0) return [];
  if (!rtdb) return [];
  const db_ = rtdb;
  const results: UserPresence[] = [];
  // Read each user's presence node from RTDB
  for (const uid of userIds) {
    try {
      const val = await new Promise<UserPresence | null>((resolve) => {
        const presenceRef = rtdbRef(db_, 'presence/' + uid);
        onValue(presenceRef, (snap) => {
          if (snap.exists()) {
            const d = snap.val();
            resolve({
              user_id: uid,
              is_online: d.is_online ?? false,
              last_seen: typeof d.last_seen === 'number' ? new Date(d.last_seen).toISOString() : new Date().toISOString(),
            });
          } else {
            resolve(null);
          }
        }, { onlyOnce: true });
      });
      if (val) results.push(val);
    } catch {
      // skip
    }
  }
  return results;
}

export function subscribeToPresence(
  userIds: string[],
  onChange: (presence: UserPresence[]) => void,
) {
  if (userIds.length === 0) return () => {};
  if (!rtdb) return () => {};
  const db_ = rtdb;

  const unsubs: (() => void)[] = [];
  const state = new Map<string, UserPresence>();

  for (const uid of userIds) {
    const presenceRef = rtdbRef(db_, 'presence/' + uid);
    const unsub = onValue(presenceRef, (snap) => {
      if (snap.exists()) {
        const d = snap.val();
        state.set(uid, {
          user_id: uid,
          is_online: d.is_online ?? false,
          last_seen: typeof d.last_seen === 'number' ? new Date(d.last_seen).toISOString() : new Date().toISOString(),
        });
      } else {
        state.set(uid, { user_id: uid, is_online: false, last_seen: new Date().toISOString() });
      }
      onChange(Array.from(state.values()));
    });
    unsubs.push(unsub);
  }

  return () => unsubs.forEach((u) => u());
}

// ── Direct Messages ─────────────────────────────

export async function sendDirectMessage(
  senderId: string,
  receiverId: string,
  content: string,
  type: 'text' | 'file' | 'system' = 'text',
  fileMetadata?: FileMetadata,
): Promise<DirectMessage> {
  const now = new Date().toISOString();
  const data = {
    sender_id: senderId,
    receiver_id: receiverId,
    content,
    type,
    file_metadata: fileMetadata ?? null,
    read: false,
    created_at: now,
  };
  const ref = await addDoc(collection(db, 'direct_messages'), data);
  return { id: ref.id, ...data };
}

export async function getDirectMessages(
  userId: string,
  friendId: string,
  limit = 200,
): Promise<DirectMessage[]> {
  // Firestore doesn't support OR on different fields natively — run two queries
  const col = collection(db, 'direct_messages');
  const q1 = query(col, where('sender_id', '==', userId), where('receiver_id', '==', friendId), firestoreLimit(limit));
  const q2 = query(col, where('sender_id', '==', friendId), where('receiver_id', '==', userId), firestoreLimit(limit));
  const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
  const all = [...s1.docs, ...s2.docs].map((d) => ({ id: d.id, ...d.data(), created_at: toISO(d.data().created_at) }) as DirectMessage);
  all.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return all.slice(0, limit);
}

export async function markMessagesAsRead(userId: string, friendId: string): Promise<void> {
  try {
    const q = query(
      collection(db, 'direct_messages'),
      where('sender_id', '==', friendId),
      where('receiver_id', '==', userId),
      where('read', '==', false),
    );
    const snap = await getDocs(q);
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
    await batch.commit();
  } catch (err) {
    console.warn('[friends-chat] Failed to mark messages as read:', err);
  }
}

export async function clearChat(userId: string, friendId: string): Promise<void> {
  const col = collection(db, 'direct_messages');
  const q1 = query(col, where('sender_id', '==', userId), where('receiver_id', '==', friendId));
  const q2 = query(col, where('sender_id', '==', friendId), where('receiver_id', '==', userId));
  const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
  const allDocs = [...s1.docs, ...s2.docs];
  // Batch delete (Firestore limit 500 per batch)
  while (allDocs.length > 0) {
    const batch = writeBatch(db);
    const chunk = allDocs.splice(0, 500);
    chunk.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

export async function getUnreadCount(userId: string, friendId: string): Promise<number> {
  try {
    const q = query(
      collection(db, 'direct_messages'),
      where('sender_id', '==', friendId),
      where('receiver_id', '==', userId),
      where('read', '==', false),
    );
    const snap = await getDocs(q);
    return snap.size;
  } catch {
    return 0;
  }
}

export function subscribeToDMs(
  userId: string,
  friendId: string,
  onMessage: (msg: DirectMessage) => void,
) {
  const col = collection(db, 'direct_messages');
  // Listen for messages from friend to us
  const q1 = query(col, where('sender_id', '==', friendId), where('receiver_id', '==', userId));
  // Listen for messages from us to friend (for echo back to own UI)
  const q2 = query(col, where('sender_id', '==', userId), where('receiver_id', '==', friendId));

  const seenIds = new Set<string>();

  const unsub1 = onSnapshot(q1, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added' && !seenIds.has(change.doc.id)) {
        seenIds.add(change.doc.id);
        onMessage({ id: change.doc.id, ...change.doc.data(), created_at: toISO(change.doc.data().created_at) } as DirectMessage);
      }
    });
  });

  const unsub2 = onSnapshot(q2, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added' && !seenIds.has(change.doc.id)) {
        seenIds.add(change.doc.id);
        onMessage({ id: change.doc.id, ...change.doc.data(), created_at: toISO(change.doc.data().created_at) } as DirectMessage);
      }
    });
  });

  return () => {
    unsub1();
    unsub2();
  };
}

// ── Helper: get friend's user ID from friend request ──

export function getFriendUserId(
  friendRequest: { sender_id: string; receiver_id: string },
  currentUserId: string,
): string {
  return friendRequest.sender_id === currentUserId
    ? friendRequest.receiver_id
    : friendRequest.sender_id;
}

export function getFriendName(
  friendRequest: { sender_id: string; sender_name: string | null; receiver_name: string | null },
  currentUserId: string,
): string {
  return friendRequest.sender_id === currentUserId
    ? friendRequest.receiver_name || 'User'
    : friendRequest.sender_name || 'User';
}

// ── DM Signaling (WebRTC for Direct Messages) ───

export interface DMSignal {
  id: string;
  channel_id: string;
  sender_id: string;
  target_id: string | null;
  type: 'offer' | 'answer' | 'ice-candidate' | 'hang-up';
  payload: Record<string, unknown>;
  created_at: string;
}

/** Create a deterministic channel ID for a DM pair */
export function getDMChannelId(userA: string, userB: string): string {
  return [userA, userB].sort().join('_');
}

/** Delete old DM signals for a channel */
export async function cleanOldDMSignals(channelId: string): Promise<void> {
  try {
    const q = query(collection(db, 'dm_signals'), where('channel_id', '==', channelId));
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  } catch (err) {
    console.warn('[friends-chat] Could not clean old DM signals:', err);
  }
}

export async function sendDMSignal(
  channelId: string,
  senderId: string,
  type: DMSignal['type'],
  payload: Record<string, unknown>,
  targetId?: string,
): Promise<void> {
  await addDoc(collection(db, 'dm_signals'), {
    channel_id: channelId,
    sender_id: senderId,
    target_id: targetId ?? null,
    type,
    payload,
    created_at: new Date().toISOString(),
  });
}

export function subscribeToDMSignals(
  channelId: string,
  currentUserId: string,
  onSignal: (signal: DMSignal) => void,
) {
  const q = query(collection(db, 'dm_signals'), where('channel_id', '==', channelId));
  const seenIds = new Set<string>();

  const unsub = onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added' && !seenIds.has(change.doc.id)) {
        seenIds.add(change.doc.id);
        const d = change.doc.data();
        const signal: DMSignal = {
          id: change.doc.id,
          channel_id: d.channel_id,
          sender_id: d.sender_id,
          target_id: d.target_id ?? null,
          type: d.type,
          payload: d.payload,
          created_at: toISO(d.created_at),
        };
        if (signal.sender_id === currentUserId) return;
        if (signal.target_id && signal.target_id !== currentUserId) return;
        onSignal(signal);
      }
    });
  });

  return () => unsub();
}
