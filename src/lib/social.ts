import { supabase } from './supabase';
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

// ── Saved Rooms ─────────────────────────────────

export async function saveRoom(userId: string, roomId: string): Promise<SavedRoom> {
  const { data, error } = await supabase
    .from('saved_rooms')
    .upsert(
      { user_id: userId, room_id: roomId },
      { onConflict: 'user_id,room_id' },
    )
    .select()
    .single();

  if (error) throw error;
  return data as SavedRoom;
}

export async function unsaveRoom(userId: string, roomId: string): Promise<void> {
  const { error } = await supabase
    .from('saved_rooms')
    .delete()
    .eq('user_id', userId)
    .eq('room_id', roomId);

  if (error) throw error;
}

export async function getSavedRooms(userId: string): Promise<(SavedRoom & { room: Room })[]> {
  const { data, error } = await supabase
    .from('saved_rooms')
    .select('*, room:rooms(*)')
    .eq('user_id', userId)
    .order('saved_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as (SavedRoom & { room: Room })[];
}

export async function isRoomSaved(userId: string, roomId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('saved_rooms')
    .select('id')
    .eq('user_id', userId)
    .eq('room_id', roomId)
    .maybeSingle();

  if (error) return false;
  return !!data;
}

// ── Friend Requests ─────────────────────────────

export async function sendFriendRequest(
  senderId: string,
  senderName: string,
  receiverId: string,
  receiverName: string,
): Promise<FriendRequest> {
  // Don't allow sending to self
  if (senderId === receiverId) {
    throw new Error("You can't send a friend request to yourself.");
  }

  // Check if a request already exists in either direction
  const { data: existing } = await supabase
    .from('friend_requests')
    .select('*')
    .or(
      `and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId})`,
    )
    .in('status', ['pending', 'accepted']);

  if (existing && existing.length > 0) {
    const req = existing[0];
    if (req.status === 'accepted') {
      throw new Error('You are already friends with this user.');
    }
    throw new Error('A friend request already exists with this user.');
  }

  const { data, error } = await supabase
    .from('friend_requests')
    .insert({
      sender_id: senderId,
      receiver_id: receiverId,
      sender_name: senderName,
      receiver_name: receiverName,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('A friend request already exists with this user.');
    }
    throw error;
  }
  return data as FriendRequest;
}

export async function acceptFriendRequest(requestId: string): Promise<FriendRequest> {
  const { data, error } = await supabase
    .from('friend_requests')
    .update({ status: 'accepted', updated_at: new Date().toISOString() })
    .eq('id', requestId)
    .select()
    .single();

  if (error) throw error;
  return data as FriendRequest;
}

export async function rejectFriendRequest(requestId: string): Promise<void> {
  const { error } = await supabase
    .from('friend_requests')
    .update({ status: 'rejected', updated_at: new Date().toISOString() })
    .eq('id', requestId);

  if (error) throw error;
}

export async function deleteFriendRequest(requestId: string): Promise<void> {
  const { error } = await supabase
    .from('friend_requests')
    .delete()
    .eq('id', requestId);

  if (error) throw error;
}

export async function getIncomingFriendRequests(userId: string): Promise<FriendRequest[]> {
  const { data, error } = await supabase
    .from('friend_requests')
    .select('*')
    .eq('receiver_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as FriendRequest[];
}

export async function getOutgoingFriendRequests(userId: string): Promise<FriendRequest[]> {
  const { data, error } = await supabase
    .from('friend_requests')
    .select('*')
    .eq('sender_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as FriendRequest[];
}

export async function getFriends(userId: string): Promise<FriendRequest[]> {
  const { data, error } = await supabase
    .from('friend_requests')
    .select('*')
    .eq('status', 'accepted')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as FriendRequest[];
}

export async function getPendingRequestCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('friend_requests')
    .select('*', { count: 'exact', head: true })
    .eq('receiver_id', userId)
    .eq('status', 'pending');

  if (error) return 0;
  return count ?? 0;
}

// ── Realtime subscriptions ──────────────────────

export function subscribeToFriendRequests(
  userId: string,
  onChange: () => void,
) {
  const channel = supabase
    .channel(`friend-requests-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'friend_requests',
        filter: `receiver_id=eq.${userId}`,
      },
      () => {
        onChange();
      },
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'friend_requests',
        filter: `sender_id=eq.${userId}`,
      },
      () => {
        onChange();
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
