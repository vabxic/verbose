import { sendSignal, subscribeToSignals } from './rooms';
import type { RoomSignal } from './rooms';

// ── STUN / TURN configuration ───────────────────
// Uses Google's free public STUN servers.
// For production, add TURN servers for reliability behind symmetric NATs.
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

const RTC_CONFIG: RTCConfiguration = {
  iceServers: ICE_SERVERS,
  iceCandidatePoolSize: 10,
};

export type CallType = 'audio' | 'video';

export interface WebRTCCallbacks {
  onRemoteStream: (stream: MediaStream) => void;
  onCallEnded: () => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
}

export class WebRTCService {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private unsubSignals: (() => void) | null = null;

  private roomId: string;
  private userId: string;
  private callbacks: WebRTCCallbacks;

  constructor(roomId: string, userId: string, callbacks: WebRTCCallbacks) {
    this.roomId = roomId;
    this.userId = userId;
    this.callbacks = callbacks;
  }

  // ── Get local media stream ──────────────────
  async getLocalStream(callType: CallType): Promise<MediaStream> {
    if (this.localStream) return this.localStream;

    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: callType === 'video',
    });
    return this.localStream;
  }

  // ── Create peer connection ──────────────────
  private createPeerConnection(): RTCPeerConnection {
    if (this.pc) {
      this.pc.close();
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal(this.roomId, this.userId, 'ice-candidate', {
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (event) => {
      if (event.streams[0]) {
        this.callbacks.onRemoteStream(event.streams[0]);
      }
    };

    pc.onconnectionstatechange = () => {
      this.callbacks.onConnectionStateChange(pc.connectionState);
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.callbacks.onCallEnded();
      }
    };

    this.pc = pc;
    return pc;
  }

  // ── Start listening for signaling messages ──
  startSignaling(): void {
    this.unsubSignals = subscribeToSignals(
      this.roomId,
      this.userId,
      (signal) => this.handleSignal(signal),
    );
  }

  // ── Handle incoming signals ─────────────────
  private async handleSignal(signal: RoomSignal): Promise<void> {
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
        this.callbacks.onCallEnded();
        break;
    }
  }

  // ── Initiate a call (caller side) ───────────
  async startCall(callType: CallType): Promise<void> {
    const stream = await this.getLocalStream(callType);
    const pc = this.createPeerConnection();

    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await sendSignal(this.roomId, this.userId, 'offer', {
      sdp: offer.sdp,
      type: offer.type,
      callType,
    });
  }

  // ── Handle incoming offer (callee side) ─────
  private async handleOffer(signal: RoomSignal): Promise<void> {
    const payload = signal.payload as { sdp: string; type: RTCSdpType; callType: CallType };

    const stream = await this.getLocalStream(payload.callType);
    const pc = this.createPeerConnection();

    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    await pc.setRemoteDescription(
      new RTCSessionDescription({ sdp: payload.sdp, type: payload.type }),
    );

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await sendSignal(
      this.roomId,
      this.userId,
      'answer',
      { sdp: answer.sdp, type: answer.type },
      signal.sender_id,
    );
  }

  // ── Handle incoming answer ──────────────────
  private async handleAnswer(signal: RoomSignal): Promise<void> {
    const payload = signal.payload as { sdp: string; type: RTCSdpType };
    if (!this.pc) return;
    await this.pc.setRemoteDescription(
      new RTCSessionDescription({ sdp: payload.sdp, type: payload.type }),
    );
  }

  // ── Handle ICE candidate ────────────────────
  private async handleIceCandidate(signal: RoomSignal): Promise<void> {
    const payload = signal.payload as { candidate: RTCIceCandidateInit };
    if (!this.pc) return;
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
    } catch (err) {
      console.warn('Error adding ICE candidate:', err);
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
    await sendSignal(this.roomId, this.userId, 'hang-up', {});
    this.cleanup();
  }

  // ── Cleanup ─────────────────────────────────
  cleanup(): void {
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;

    this.pc?.close();
    this.pc = null;

    this.unsubSignals?.();
    this.unsubSignals = null;
  }
}
