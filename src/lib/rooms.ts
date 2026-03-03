import { db } from './db';
import {
  collection,
  doc,
  addDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';

// -- Types ---
export interface Room {
  id: string;
  code: string;
  name: string | null;
  created_by: string;
  is_active: boolean;
  max_participants: number;
  created_at: string;
  updated_at: string;
}

export interface RoomParticipant {
  id: string;
  room_id: string;
  user_id: string;
  display_name: string | null;
  joined_at: string;
}

export interface RoomMessage {
  id: string;
  room_id: string;
  sender_id: string;
  sender_name: string | null;
  content: string;
  type: 'text' | 'system' | 'file';
  created_at: string;
}

export interface RoomSignal {
  id: string;
  room_id: string;
  sender_id: string;
  target_id: string | null;
  type: 'offer' | 'answer' | 'ice-candidate' | 'hang-up';
  payload: Record<string, unknown>;
  created_at: string;
}

// -- Helpers --

function toISO(val: any): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

function docToRoom(id: string, d: any): Room {
  return { id, code: d.code, name: d.name ?? null, created_by: d.created_by, is_active: d.is_active ?? true, max_participants: d.max_participants ?? 50, created_at: toISO(d.created_at), updated_at: toISO(d.updated_at) };
}
function docToParticipant(id: string, d: any): RoomParticipant {
  return { id, room_id: d.room_id, user_id: d.user_id, display_name: d.display_name ?? null, joined_at: toISO(d.joined_at) };
}
function docToMessage(id: string, d: any): RoomMessage {
  return { id, room_id: d.room_id, sender_id: d.sender_id, sender_name: d.sender_name ?? null, content: d.content, type: d.type ?? 'text', created_at: toISO(d.created_at) };
}

function generateRoomCode(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) code += chars[array[i] % chars.length];
  return code;
}

// -- Room CRUD --

export async function createRoom(userId: string, name?: string): Promise<Room> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode();
    const existing = await getDocs(query(collection(db, 'rooms'), where('code', '==', code), where('is_active', '==', true)));
    if (!existing.empty) continue;
    const now = new Date().toISOString();
    const data = { code, name: name || `Room ${code}`, created_by: userId, is_active: true, max_participants: 50, created_at: now, updated_at: now };
    const ref = await addDoc(collection(db, 'rooms'), data);
    return { id: ref.id, ...data };
  }
  throw new Error('Could not generate a unique room code. Please try again.');
}

export async function joinRoomByCode(code: string, userId: string, displayName: string): Promise<{ room: Room; participant: RoomParticipant }> {
  const q = query(collection(db, 'rooms'), where('code', '==', code.toUpperCase().trim()), where('is_active', '==', true));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('Room not found or no longer active.');
  const roomDoc = snap.docs[0];
  const room = docToRoom(roomDoc.id, roomDoc.data());
  const pid = `${room.id}_${userId}`;
  const pData = { room_id: room.id, user_id: userId, display_name: displayName, joined_at: new Date().toISOString() };
  await setDoc(doc(db, 'room_participants', pid), pData, { merge: true });
  return { room, participant: { id: pid, ...pData } };
}

export async function getRoomParticipants(roomId: string): Promise<RoomParticipant[]> {
  const q = query(collection(db, 'room_participants'), where('room_id', '==', roomId), orderBy('joined_at', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => docToParticipant(d.id, d.data()));
}

export async function leaveRoom(roomId: string, userId: string): Promise<void> {
  await deleteDoc(doc(db, 'room_participants', `${roomId}_${userId}`));
}

export async function transferRoomHost(roomId: string, newHostUserId: string): Promise<void> {
  await updateDoc(doc(db, 'rooms', roomId), { created_by: newHostUserId });
}

export async function deactivateRoom(roomId: string): Promise<void> {
  await updateDoc(doc(db, 'rooms', roomId), { is_active: false });
}

// -- Messages --

export async function sendMessage(roomId: string, senderId: string, senderName: string, content: string, type: 'text' | 'system' | 'file' = 'text'): Promise<RoomMessage> {
  const now = new Date().toISOString();
  const data = { room_id: roomId, sender_id: senderId, sender_name: senderName, content, type, created_at: now };
  const ref = await addDoc(collection(db, 'room_messages'), data);
  return { id: ref.id, ...data };
}

export async function getMessages(roomId: string, limit = 100): Promise<RoomMessage[]> {
  const q = query(collection(db, 'room_messages'), where('room_id', '==', roomId), orderBy('created_at', 'asc'), firestoreLimit(limit));
  const snap = await getDocs(q);
  return snap.docs.map(d => docToMessage(d.id, d.data()));
}

// -- Signaling (WebRTC) --

export async function cleanOldSignals(roomId: string): Promise<void> {
  const q = query(collection(db, 'room_signals'), where('room_id', '==', roomId));
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
}

export async function sendSignal(roomId: string, senderId: string, type: RoomSignal['type'], payload: Record<string, unknown>, targetId?: string): Promise<void> {
  await addDoc(collection(db, 'room_signals'), { room_id: roomId, sender_id: senderId, target_id: targetId ?? null, type, payload, created_at: new Date().toISOString() });
}

// -- Realtime subscriptions (Firestore onSnapshot) --

export function subscribeToMessages(roomId: string, onMessage: (msg: RoomMessage) => void) {
  const q = query(collection(db, 'room_messages'), where('room_id', '==', roomId), orderBy('created_at', 'asc'));
  const seenIds = new Set<string>();
  const unsub = onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added' && !seenIds.has(change.doc.id)) {
        seenIds.add(change.doc.id);
        onMessage(docToMessage(change.doc.id, change.doc.data()));
      }
    });
  });
  return unsub;
}

export function subscribeToSignals(roomId: string, currentUserId: string, onSignal: (signal: RoomSignal) => void) {
  const q = query(collection(db, 'room_signals'), where('room_id', '==', roomId));
  const seenIds = new Set<string>();
  const unsub = onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added' && !seenIds.has(change.doc.id)) {
        seenIds.add(change.doc.id);
        const d = change.doc.data();
        const signal: RoomSignal = { id: change.doc.id, room_id: d.room_id, sender_id: d.sender_id, target_id: d.target_id ?? null, type: d.type, payload: d.payload, created_at: toISO(d.created_at) };
        if (signal.sender_id === currentUserId) return;
        if (signal.target_id && signal.target_id !== currentUserId) return;
        onSignal(signal);
      }
    });
  });
  return unsub;
}

export function subscribeToParticipants(roomId: string, onChange: (participants: RoomParticipant[]) => void) {
  const q = query(collection(db, 'room_participants'), where('room_id', '==', roomId));
  const unsub = onSnapshot(q, (snapshot) => {
    onChange(snapshot.docs.map(d => docToParticipant(d.id, d.data())));
  });
  return unsub;
}
