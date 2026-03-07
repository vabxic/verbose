import { supabase } from './supabase';

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

// ── Presence ────────────────────────────────────

export async function setOnline(userId: string): Promise<void> {
  const { error } = await supabase
    .from('user_presence')
    .upsert(
      { user_id: userId, is_online: true, last_seen: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
  if (error) console.warn('[friends-chat] Failed to set online:', error);
}

export async function setOffline(userId: string): Promise<void> {
  const { error } = await supabase
    .from('user_presence')
    .upsert(
      { user_id: userId, is_online: false, last_seen: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
  if (error) console.warn('[friends-chat] Failed to set offline:', error);
}

export async function getPresence(userIds: string[]): Promise<UserPresence[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await supabase
    .from('user_presence')
    .select('*')
    .in('user_id', userIds);

  if (error) {
    console.warn('[friends-chat] Failed to get presence:', error);
    return [];
  }
  return (data ?? []) as UserPresence[];
}

export function subscribeToPresence(
  userIds: string[],
  onChange: (presence: UserPresence[]) => void,
) {
  if (userIds.length === 0) return () => {};

  const channel = supabase
    .channel('user-presence-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_presence',
      },
      async () => {
        const presence = await getPresence(userIds);
        onChange(presence);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ── Direct Messages ─────────────────────────────

export async function sendDirectMessage(
  senderId: string,
  receiverId: string,
  content: string,
  type: 'text' | 'file' | 'system' = 'text',
  fileMetadata?: FileMetadata,
): Promise<DirectMessage> {
  const { data, error } = await supabase
    .from('direct_messages')
    .insert({
      sender_id: senderId,
      receiver_id: receiverId,
      content,
      type,
      file_metadata: fileMetadata ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as DirectMessage;
}

export async function getDirectMessages(
  userId: string,
  friendId: string,
  limit = 200,
): Promise<DirectMessage[]> {
  const { data, error } = await supabase
    .from('direct_messages')
    .select('*')
    .or(
      `and(sender_id.eq.${userId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${userId})`,
    )
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as DirectMessage[];
}

export async function markMessagesAsRead(
  userId: string,
  friendId: string,
): Promise<void> {
  const { error } = await supabase
    .from('direct_messages')
    .update({ read: true })
    .eq('sender_id', friendId)
    .eq('receiver_id', userId)
    .eq('read', false);

  if (error) console.warn('[friends-chat] Failed to mark messages as read:', error);
}

export async function clearChat(
  userId: string,
  friendId: string,
): Promise<void> {
  // Delete messages in both directions
  const { error: err1 } = await supabase
    .from('direct_messages')
    .delete()
    .eq('sender_id', userId)
    .eq('receiver_id', friendId);

  const { error: err2 } = await supabase
    .from('direct_messages')
    .delete()
    .eq('sender_id', friendId)
    .eq('receiver_id', userId);

  if (err1) console.warn('[friends-chat] Error clearing sent messages:', err1);
  if (err2) console.warn('[friends-chat] Error clearing received messages:', err2);
}

export async function getUnreadCount(
  userId: string,
  friendId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('direct_messages')
    .select('*', { count: 'exact', head: true })
    .eq('sender_id', friendId)
    .eq('receiver_id', userId)
    .eq('read', false);

  if (error) return 0;
  return count ?? 0;
}

export function subscribeToDMs(
  userId: string,
  friendId: string,
  onMessage: (msg: DirectMessage) => void,
) {
  // Listen for messages from friend to us
  const channel1 = supabase
    .channel(`dm-${userId}-${friendId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
        filter: `sender_id=eq.${friendId}`,
      },
      (payload) => {
        const msg = payload.new as DirectMessage;
        if (msg.receiver_id === userId) {
          onMessage(msg);
        }
      },
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
        filter: `sender_id=eq.${userId}`,
      },
      (payload) => {
        const msg = payload.new as DirectMessage;
        if (msg.receiver_id === friendId) {
          onMessage(msg);
        }
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel1);
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
  const { error } = await supabase
    .from('dm_signals')
    .delete()
    .eq('channel_id', channelId);

  if (error) {
    console.warn('[friends-chat] Could not clean old DM signals:', error.message);
  }
}

export async function sendDMSignal(
  channelId: string,
  senderId: string,
  type: DMSignal['type'],
  payload: Record<string, unknown>,
  targetId?: string,
): Promise<void> {
  const { error } = await supabase
    .from('dm_signals')
    .insert({
      channel_id: channelId,
      sender_id: senderId,
      target_id: targetId ?? null,
      type,
      payload,
    });

  if (error) throw error;
}

export function subscribeToDMSignals(
  channelId: string,
  currentUserId: string,
  onSignal: (signal: DMSignal) => void,
) {
  const channel = supabase
    .channel(`dm-signals-${channelId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'dm_signals',
        filter: `channel_id=eq.${channelId}`,
      },
      (payload) => {
        const signal = payload.new as DMSignal;
        // Ignore own signals
        if (signal.sender_id === currentUserId) return;
        // Ignore signals not targeted at us
        if (signal.target_id && signal.target_id !== currentUserId) return;
        onSignal(signal);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
