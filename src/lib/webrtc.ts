import { sendSignal as roomSendSignal, subscribeToSignals as roomSubscribeToSignals } from './rooms';
import type { RoomSignal } from './rooms';

// Generic signal type used by both Room and DM WebRTC
export interface GenericSignal {
  id: string;
  sender_id: string;
  target_id: string | null;
  type: 'offer' | 'answer' | 'ice-candidate' | 'hang-up';
  payload: Record<string, unknown>;
  created_at: string;
}

export interface SignalAdapter {
  sendSignal: (channelId: string, senderId: string, type: GenericSignal['type'], payload: Record<string, unknown>, targetId?: string) => Promise<void>;
  subscribeToSignals: (channelId: string, currentUserId: string, onSignal: (signal: GenericSignal) => void) => () => void;
}

/** Default signal adapter using room_signals table */
const roomSignalAdapter: SignalAdapter = {
  sendSignal: roomSendSignal,
  subscribeToSignals: (channelId, currentUserId, onSignal) =>
    roomSubscribeToSignals(channelId, currentUserId, onSignal as (signal: RoomSignal) => void),
};

// ── STUN / TURN configuration ───────────────────
// Uses Google's free public STUN servers.
// For production, add TURN servers for reliability behind symmetric NATs.
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  // Free TURN relay servers for NAT traversal
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

const RTC_CONFIG: RTCConfiguration = {
  iceServers: ICE_SERVERS,
  iceCandidatePoolSize: 10,
};

export type CallType = 'audio' | 'video';

export interface WebRTCCallbacks {
  onRemoteStream: (stream: MediaStream) => void;
  /** Fired when the local camera/mic stream is acquired (for both caller & callee) */
  onLocalStream: (stream: MediaStream) => void;
  onCallEnded: () => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  /** Fired on the callee side when an incoming call is detected */
  onIncomingCall?: (callType: CallType) => void;
}

export class WebRTCService {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private unsubSignals: (() => void) | null = null;

  // ICE candidate buffering – candidates that arrive before remoteDescription is set
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private hasRemoteDescription = false;
  private pendingOfferSignal: GenericSignal | null = null;

  // Signal processing queue to prevent race conditions
  private signalQueue: GenericSignal[] = [];
  private processingSignal = false;

  private roomId: string;
  private userId: string;
  private callbacks: WebRTCCallbacks;
  private signalAdapter: SignalAdapter;

  constructor(roomId: string, userId: string, callbacks: WebRTCCallbacks, signalAdapter?: SignalAdapter) {
    this.roomId = roomId;
    this.userId = userId;
    this.callbacks = callbacks;
    this.signalAdapter = signalAdapter ?? roomSignalAdapter;
  }

  // ── Get local media stream ──────────────────
  async getLocalStream(callType: CallType): Promise<MediaStream> {
    if (this.localStream) return this.localStream;

    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: callType === 'video'
        ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
        : false,
    });
    return this.localStream;
  }

  // ── Create peer connection ──────────────────
  private createPeerConnection(): RTCPeerConnection {
    if (this.pc) {
      this.pc.close();
    }

    // Reset ICE buffering state for new connection
    this.pendingCandidates = [];
    this.hasRemoteDescription = false;

    const pc = new RTCPeerConnection(RTC_CONFIG);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[WebRTC] Sending ICE candidate');
        this.signalAdapter.sendSignal(this.roomId, this.userId, 'ice-candidate', {
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('[WebRTC] Remote track received:', event.track.kind);
      if (event.streams[0]) {
        this.callbacks.onRemoteStream(event.streams[0]);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE connection state:', pc.iceConnectionState);
    };

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', pc.connectionState);
      this.callbacks.onConnectionStateChange(pc.connectionState);
      // Only end on 'failed' – 'disconnected' is often temporary and may reconnect
      if (pc.connectionState === 'failed') {
        this.endCall();
        this.callbacks.onCallEnded();
      }
    };

    this.pc = pc;
    return pc;
  }

  // ── Start listening for signaling messages ──
  startSignaling(): void {
    this.unsubSignals = this.signalAdapter.subscribeToSignals(
      this.roomId,
      this.userId,
      (signal) => this.enqueueSignal(signal),
    );
  }

  // ── Signal queue – ensures signals are processed one at a time ──
  private enqueueSignal(signal: GenericSignal): void {
    this.signalQueue.push(signal);
    this.processSignalQueue();
  }

  private async processSignalQueue(): Promise<void> {
    if (this.processingSignal) return;
    this.processingSignal = true;

    while (this.signalQueue.length > 0) {
      const signal = this.signalQueue.shift()!;
      try {
        await this.handleSignal(signal);
      } catch (err) {
        console.error('[WebRTC] Error processing signal:', signal.type, err);
      }
    }

    this.processingSignal = false;
  }

  // ── Handle incoming signals ─────────────────
  private async handleSignal(signal: GenericSignal): Promise<void> {
    console.log('[WebRTC] Handling signal:', signal.type);
    switch (signal.type) {
      case 'offer':
        await this.handleOffer(signal);
        break;
      case 'answer':
        await this.handleAnswer(signal);
        break;
      case 'ice-candidate':
        await this.handleIceCandidate(signal);
        break;
      case 'hang-up':
        this.endCall();
        this.callbacks.onCallEnded();
        break;
    }
  }

  // ── Initiate a call (caller side) ───────────
  async startCall(callType: CallType): Promise<void> {
    const stream = await this.getLocalStream(callType);
    const pc = this.createPeerConnection();

    // Notify UI about local stream (caller side)
    this.callbacks.onLocalStream(stream);

    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    const offer = await pc.createOffer({ iceRestart: true });
    await pc.setLocalDescription(offer);

    await this.signalAdapter.sendSignal(this.roomId, this.userId, 'offer', {
      sdp: offer.sdp,
      type: offer.type,
      callType,
    });
  }

  // ── Handle incoming offer (callee side) ─────
  // Stores the offer and notifies UI; callee must call acceptCall() or rejectCall()
  private async handleOffer(signal: GenericSignal): Promise<void> {
    const payload = signal.payload as { sdp: string; type: RTCSdpType; callType: CallType };
    this.pendingOfferSignal = signal;
    this.callbacks.onIncomingCall?.(payload.callType);
  }

  // ── Accept an incoming call ─────────────────
  async acceptCall(): Promise<void> {
    if (!this.pendingOfferSignal) return;
    const signal = this.pendingOfferSignal;
    this.pendingOfferSignal = null;

    const payload = signal.payload as { sdp: string; type: RTCSdpType; callType: CallType };
    const stream = await this.getLocalStream(payload.callType);

    // Save buffered ICE candidates that arrived while waiting for user to accept
    const savedCandidates = [...this.pendingCandidates];
    const pc = this.createPeerConnection();
    // Restore the saved candidates (createPeerConnection resets the array)
    this.pendingCandidates = savedCandidates;

    this.callbacks.onLocalStream(stream);

    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    await pc.setRemoteDescription(
      new RTCSessionDescription({ sdp: payload.sdp, type: payload.type }),
    );

    this.hasRemoteDescription = true;
    await this.flushPendingCandidates();

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await this.signalAdapter.sendSignal(
      this.roomId,
      this.userId,
      'answer',
      { sdp: answer.sdp, type: answer.type },
      signal.sender_id,
    );
  }

  // ── Reject an incoming call ─────────────────
  async rejectCall(): Promise<void> {
    if (!this.pendingOfferSignal) return;
    const signal = this.pendingOfferSignal;
    this.pendingOfferSignal = null;
    await this.signalAdapter.sendSignal(this.roomId, this.userId, 'hang-up', {}, signal.sender_id);
  }

  // ── Handle incoming answer ──────────────────
  private async handleAnswer(signal: GenericSignal): Promise<void> {
    const payload = signal.payload as { sdp: string; type: RTCSdpType };
    if (!this.pc) return;
    await this.pc.setRemoteDescription(
      new RTCSessionDescription({ sdp: payload.sdp, type: payload.type }),
    );

    // Remote description is set – flush buffered ICE candidates
    this.hasRemoteDescription = true;
    await this.flushPendingCandidates();
  }

  // ── Handle ICE candidate ────────────────────
  private async handleIceCandidate(signal: GenericSignal): Promise<void> {
    const payload = signal.payload as { candidate: RTCIceCandidateInit };

    // Buffer if peer connection or remote description not ready yet
    if (!this.pc || !this.hasRemoteDescription) {
      console.log('[WebRTC] Buffering ICE candidate (PC or remote desc not ready)');
      this.pendingCandidates.push(payload.candidate);
      return;
    }

    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
    } catch (err) {
      console.warn('[WebRTC] Error adding ICE candidate:', err);
    }
  }

  // ── Flush buffered ICE candidates ───────────
  private async flushPendingCandidates(): Promise<void> {
    if (!this.pc || this.pendingCandidates.length === 0) return;
    console.log('[WebRTC] Flushing', this.pendingCandidates.length, 'buffered ICE candidates');
    const candidates = [...this.pendingCandidates];
    this.pendingCandidates = [];
    for (const candidate of candidates) {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('[WebRTC] Error adding buffered ICE candidate:', err);
      }
    }
  }

  // ── Toggle audio/video ──────────────────────
  toggleAudio(enabled: boolean): void {
    this.localStream?.getAudioTracks().forEach((t) => {
      t.enabled = enabled;
    });
  }

  toggleVideo(enabled: boolean): void {
    this.localStream?.getVideoTracks().forEach((t) => {
      t.enabled = enabled;
    });
  }

  // ── Hang up ─────────────────────────────────
  async hangUp(): Promise<void> {
    await this.signalAdapter.sendSignal(this.roomId, this.userId, 'hang-up', {});
    this.endCall();
  }

  // ── End current call (keeps signaling alive for future calls) ──
  endCall(): void {
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;

    this.pc?.close();
    this.pc = null;

    this.pendingCandidates = [];
    this.hasRemoteDescription = false;
    this.pendingOfferSignal = null;
  }

  // ── Full cleanup (unmount) ──────────────────
  cleanup(): void {
    this.endCall();
    this.signalQueue = [];
    this.processingSignal = false;

    this.unsubSignals?.();
    this.unsubSignals = null;
  }
}
