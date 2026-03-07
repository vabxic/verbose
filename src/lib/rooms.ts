import { supabase } from './supabase';

// ── Types ───────────────────────────────────────
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

// ── Room code generation (client-side fallback) ─
function generateRoomCode(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    code += chars[array[i] % chars.length];
  }
  return code;
}

// ── Room CRUD ───────────────────────────────────

export async function createRoom(
  userId: string,
  name?: string,
): Promise<Room> {
  // Try up to 5 times to generate a unique code
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode();
    const { data, error } = await supabase
      .from('rooms')
      .insert({
        code,
        name: name || `Room ${code}`,
        created_by: userId,
        max_participants: 50,
      })
      .select()
      .single();

    if (error) {
      // Unique violation → retry with new code
      if (error.code === '23505') continue;
      throw error;
    }
    return data as Room;
  }
  throw new Error('Could not generate a unique room code. Please try again.');
}

export async function joinRoomByCode(
  code: string,
  userId: string,
  displayName: string,
): Promise<{ room: Room; participant: RoomParticipant }> {
  console.log('[rooms] Joining room by code:', code, 'user:', userId, 'name:', displayName);
  // Find the room
  const { data: room, error: roomErr } = await supabase
    .from('rooms')
    .select('*')
    .eq('code', code.toUpperCase().trim())
    .eq('is_active', true)
    .single();

  console.log('[rooms] Room lookup result:', { room, error: roomErr });

  if (roomErr || !room) {
    console.error('[rooms] Room not found:', roomErr);
    throw new Error('Room not found or no longer active.');
  }

  // Upsert participant
  console.log('[rooms] Upserting participant...');
  const { data: participant, error: partErr } = await supabase
    .from('room_participants')
    .upsert(
      { room_id: room.id, user_id: userId, display_name: displayName },
      { onConflict: 'room_id,user_id' },
    )
    .select()
    .single();

  console.log('[rooms] Participant upsert result:', { participant, error: partErr });

  if (partErr) {
    console.error('[rooms] Failed to add participant:', partErr);
    throw partErr;
  }

  console.log('[rooms] Successfully joined room');
  return { room: room as Room, participant: participant as RoomParticipant };
}

export async function getRoomParticipants(roomId: string): Promise<RoomParticipant[]> {
  const { data, error } = await supabase
    .from('room_participants')
    .select('*')
    .eq('room_id', roomId)
    .order('joined_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as RoomParticipant[];
}

export async function leaveRoom(roomId: string, userId: string): Promise<void> {
  await supabase
    .from('room_participants')
    .delete()
    .eq('room_id', roomId)
    .eq('user_id', userId);
}

// ── Messages ────────────────────────────────────

export async function sendMessage(
  roomId: string,
  senderId: string,
  senderName: string,
  content: string,
  type: 'text' | 'system' | 'file' = 'text',
): Promise<RoomMessage> {
  console.log('[rooms] Sending message:', { roomId, senderId, senderName, content, type });
  const { data, error } = await supabase
    .from('room_messages')
    .insert({ room_id: roomId, sender_id: senderId, sender_name: senderName, content, type })
    .select()
    .single();

  if (error) {
    console.error('[rooms] Error sending message:', error);
    throw error;
  }
  console.log('[rooms] Message sent successfully:', data);
  return data as RoomMessage;
}

export async function getMessages(
  roomId: string,
  limit = 100,
): Promise<RoomMessage[]> {
  console.log('[rooms] Loading messages for room:', roomId);
  const { data, error } = await supabase
    .from('room_messages')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[rooms] Error loading messages:', error);
    throw error;
  }
  console.log('[rooms] Loaded', data?.length || 0, 'messages');
  return (data ?? []) as RoomMessage[];
}

// ── Signaling (WebRTC) ──────────────────────────

/** Delete old signals for a room to prevent stale offer/answer confusion */
export async function cleanOldSignals(roomId: string): Promise<void> {
  console.log('[rooms] Cleaning old signals for room:', roomId);
  const { error } = await supabase
    .from('room_signals')
    .delete()
    .eq('room_id', roomId);

  if (error) {
    // Non-fatal – RLS may prevent deleting other users' signals
    console.warn('[rooms] Could not clean old signals:', error.message);
  }
}

export async function sendSignal(
  roomId: string,
  senderId: string,
  type: RoomSignal['type'],
  payload: Record<string, unknown>,
  targetId?: string,
): Promise<void> {
  const { error } = await supabase
    .from('room_signals')
    .insert({
      room_id: roomId,
      sender_id: senderId,
      target_id: targetId ?? null,
      type,
      payload,
    });

  if (error) throw error;
}

// ── Realtime subscriptions ──────────────────────

export function subscribeToMessages(
  roomId: string,
  onMessage: (msg: RoomMessage) => void,
) {
  console.log('[rooms] Setting up message subscription for room:', roomId);
  const channel = supabase
    .channel(`room-messages-${roomId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'room_messages',
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        console.log('[rooms] Received realtime message event:', payload);
        onMessage(payload.new as RoomMessage);
      },
    )
    .subscribe((status) => {
      console.log('[rooms] Message subscription status:', status);
    });

  return () => {
    console.log('[rooms] Unsubscribing from messages');
    supabase.removeChannel(channel);
  };
}

export function subscribeToSignals(
  roomId: string,
  currentUserId: string,
  onSignal: (signal: RoomSignal) => void,
) {
  console.log('[rooms] Setting up signal subscription for room:', roomId, 'user:', currentUserId);
  const channel = supabase
    .channel(`room-signals-${roomId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'room_signals',
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        const signal = payload.new as RoomSignal;
        console.log('[rooms] Received signal:', signal);
        // Ignore own signals and signals not targeted at us
        if (signal.sender_id === currentUserId) {
          console.log('[rooms] Ignoring own signal');
          return;
        }
        if (signal.target_id && signal.target_id !== currentUserId) {
          console.log('[rooms] Signal not targeted at us, ignoring');
          return;
        }
        console.log('[rooms] Processing signal');
        onSignal(signal);
      },
    )
    .subscribe((status) => {
      console.log('[rooms] Signal subscription status:', status);
    });

  return () => {
    console.log('[rooms] Unsubscribing from signals');
    supabase.removeChannel(channel);
  };
}

export function subscribeToParticipants(
  roomId: string,
  onChange: (participants: RoomParticipant[]) => void,
) {
  // Refresh full list on any change
  const channel = supabase
    .channel(`room-participants-${roomId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'room_participants',
        filter: `room_id=eq.${roomId}`,
      },
      async () => {
        const participants = await getRoomParticipants(roomId);
        onChange(participants);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
