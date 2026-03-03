import { db } from './db';
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import type { Room } from './rooms';

// ── Types ───────────────────────────────────────

export interface SavedRoom {
  id: string;
  user_id: string;
  room_id: string;
  saved_at: string;
  room?: Room;
}

export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  sender_name: string | null;
  receiver_name: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  updated_at: string;
}

// ── Helpers ─────────────────────────────────────

function toISO(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

// ── Saved Rooms ─────────────────────────────────

export async function saveRoom(userId: string, roomId: string): Promise<SavedRoom> {
  const id = `${userId}_${roomId}`;
  const data = { user_id: userId, room_id: roomId, saved_at: new Date().toISOString() };
  await setDoc(doc(db, 'saved_rooms', id), data, { merge: true });
  return { id, ...data };
}

export async function unsaveRoom(userId: string, roomId: string): Promise<void> {
  await deleteDoc(doc(db, 'saved_rooms', `${userId}_${roomId}`));
}

export async function getSavedRooms(userId: string): Promise<(SavedRoom & { room: Room })[]> {
  try {
    const q = query(collection(db, 'saved_rooms'), where('user_id', '==', userId), orderBy('saved_at', 'desc'));
    const snap = await getDocs(q);
    const results: (SavedRoom & { room: Room })[] = [];
    for (const d of snap.docs) {
      const sr = { id: d.id, ...d.data() } as SavedRoom;
      // Fetch the linked room document
      const roomSnap = await getDoc(doc(db, 'rooms', sr.room_id));
      if (roomSnap.exists()) {
        const roomData = roomSnap.data();
        const room: Room = {
          id: roomSnap.id,
          code: roomData.code,
          name: roomData.name ?? null,
          created_by: roomData.created_by,
          is_active: roomData.is_active ?? true,
          max_participants: roomData.max_participants ?? 50,
          created_at: toISO(roomData.created_at),
          updated_at: toISO(roomData.updated_at),
        };
        results.push({ ...sr, room });
      }
    }
    return results;
  } catch (err: unknown) {
    console.warn('[social] Error fetching saved rooms:', err);
    return [];
  }
}

export async function isRoomSaved(userId: string, roomId: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'saved_rooms', `${userId}_${roomId}`));
    return snap.exists();
  } catch {
    return false;
  }
}

// ── Friend Requests ─────────────────────────────

export async function sendFriendRequest(
  senderId: string,
  senderName: string,
  receiverId: string,
  receiverName: string,
): Promise<FriendRequest> {
  if (senderId === receiverId) {
    throw new Error("You can't send a friend request to yourself.");
  }

  // Check if a request already exists in either direction
  const col = collection(db, 'friend_requests');
  const q1 = query(col, where('sender_id', '==', senderId), where('receiver_id', '==', receiverId), where('status', 'in', ['pending', 'accepted']));
  const q2 = query(col, where('sender_id', '==', receiverId), where('receiver_id', '==', senderId), where('status', 'in', ['pending', 'accepted']));
  const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

  if (!snap1.empty || !snap2.empty) {
    const existing = (snap1.empty ? snap2 : snap1).docs[0].data();
    if (existing.status === 'accepted') throw new Error('You are already friends with this user.');
    throw new Error('A friend request already exists with this user.');
  }

  const now = new Date().toISOString();
  const data = { sender_id: senderId, receiver_id: receiverId, sender_name: senderName, receiver_name: receiverName, status: 'pending' as const, created_at: now, updated_at: now };
  const ref = await addDoc(col, data);
  return { id: ref.id, ...data };
}

export async function acceptFriendRequest(requestId: string): Promise<FriendRequest> {
  const ref = doc(db, 'friend_requests', requestId);
  const now = new Date().toISOString();
  await updateDoc(ref, { status: 'accepted', updated_at: now });
  const snap = await getDoc(ref);
  return { id: snap.id, ...snap.data() } as FriendRequest;
}

export async function rejectFriendRequest(requestId: string): Promise<void> {
  await updateDoc(doc(db, 'friend_requests', requestId), { status: 'rejected', updated_at: new Date().toISOString() });
}

export async function deleteFriendRequest(requestId: string): Promise<void> {
  await deleteDoc(doc(db, 'friend_requests', requestId));
}

export async function getIncomingFriendRequests(userId: string): Promise<FriendRequest[]> {
  try {
    const q = query(collection(db, 'friend_requests'), where('receiver_id', '==', userId), where('status', '==', 'pending'), orderBy('created_at', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FriendRequest);
  } catch (err) {
    console.warn('[social] Error fetching incoming requests:', err);
    return [];
  }
}

export async function getOutgoingFriendRequests(userId: string): Promise<FriendRequest[]> {
  try {
    const q = query(collection(db, 'friend_requests'), where('sender_id', '==', userId), where('status', '==', 'pending'), orderBy('created_at', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FriendRequest);
  } catch (err) {
    console.warn('[social] Error fetching outgoing requests:', err);
    return [];
  }
}

export async function getFriends(userId: string): Promise<FriendRequest[]> {
  try {
    // Firestore doesn't support OR on different fields natively, so we run two queries
    const col = collection(db, 'friend_requests');
    const q1 = query(col, where('sender_id', '==', userId), where('status', '==', 'accepted'));
    const q2 = query(col, where('receiver_id', '==', userId), where('status', '==', 'accepted'));
    const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    const map = new Map<string, FriendRequest>();
    for (const d of [...s1.docs, ...s2.docs]) {
      map.set(d.id, { id: d.id, ...d.data() } as FriendRequest);
    }
    return Array.from(map.values()).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  } catch (err) {
    console.warn('[social] Error fetching friends:', err);
    return [];
  }
}

export async function getPendingRequestCount(userId: string): Promise<number> {
  try {
    const q = query(collection(db, 'friend_requests'), where('receiver_id', '==', userId), where('status', '==', 'pending'));
    const snap = await getDocs(q);
    return snap.size;
  } catch {
    return 0;
  }
}

// ── Realtime subscriptions ──────────────────────

export function subscribeToFriendRequests(userId: string, onChange: () => void) {
  // Listen for changes where the user is receiver
  const q1 = query(collection(db, 'friend_requests'), where('receiver_id', '==', userId));
  const q2 = query(collection(db, 'friend_requests'), where('sender_id', '==', userId));

  const unsub1 = onSnapshot(q1, () => onChange());
  const unsub2 = onSnapshot(q2, () => onChange());

  return () => {
    unsub1();
    unsub2();
  };
}
