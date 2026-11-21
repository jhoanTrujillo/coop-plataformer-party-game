// Direct Local LAN / Wi-Fi / Mobile Hotspot WebRTC DataChannel Mesh
// Uses ICE host candidates first so phones on the same Wi-Fi or Hotspot communicate directly (~2-12ms UDP)
// without bouncing gameplay packets through distant cloud servers!

export type PeerSignalPayload =
  | {kind: 'offer'; sdp: RTCSessionDescriptionInit}
  | {kind: 'answer'; sdp: RTCSessionDescriptionInit}
  | {kind: 'ice'; candidate: RTCIceCandidateInit};

export interface PeerLinkStatus {
  peerId: string;
  connected: boolean;
  isLocalLan: boolean;
  rttMs: number | null;
}

interface PeerEntry {
  pc: RTCPeerConnection;
  dc: RTCDataChannel | null;
  connected: boolean;
  isLocalLan: boolean;
  rttMs: number | null;
  pingSentAt: number;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{urls: 'stun:stun.l.google.com:19302'}],
  iceCandidatePoolSize: 2,
};

export class LocalPeerMesh {
  private peers = new Map<string, PeerEntry>();
  private pingTimer: number | null = null;
  private onSendSignal: (targetId: string, signal: PeerSignalPayload) => void;
  private onData: (peerId: string, data: Record<string, unknown>) => void;
  private onStatusChange: (statuses: PeerLinkStatus[]) => void;

  constructor(opts: {
    onSendSignal: (targetId: string, signal: PeerSignalPayload) => void;
    onData: (peerId: string, data: Record<string, unknown>) => void;
    onStatusChange: (statuses: PeerLinkStatus[]) => void;
  }) {
    this.onSendSignal = opts.onSendSignal;
    this.onData = opts.onData;
    this.onStatusChange = opts.onStatusChange;

    this.pingTimer = window.setInterval(() => {
      const now = performance.now();
      for (const [, entry] of this.peers) {
        if (entry.dc && entry.dc.readyState === 'open') {
          entry.pingSentAt = now;
          try {
            entry.dc.send(JSON.stringify({t: 'ping', ts: now}));
          } catch {
            // Ignore transient channel congestion
          }
        }
      }
    }, 1800);
  }

  public isPeerOpen(peerId: string): boolean {
    const e = this.peers.get(peerId);
    return Boolean(e && e.connected && e.dc && e.dc.readyState === 'open');
  }

  public getStatuses(): PeerLinkStatus[] {
    return Array.from(this.peers.entries()).map(([peerId, e]) => ({
      peerId,
      connected: e.connected,
      isLocalLan: e.isLocalLan,
      rttMs: e.rttMs,
    }));
  }

  public async connectToPeer(peerId: string) {
    if (this.peers.has(peerId)) return;
    if (typeof RTCPeerConnection === 'undefined') return;

    const entry = this.createPeerEntry(peerId);
    // Unreliable, unordered UDP-style DataChannel = lowest possible game latency (zero head-of-line blocking!)
    const dc = entry.pc.createDataChannel('starhop-fast', {
      ordered: false,
      maxRetransmits: 0,
    });
    this.attachDataChannel(peerId, entry, dc);

    try {
      const offer = await entry.pc.createOffer();
      await entry.pc.setLocalDescription(offer);
      this.onSendSignal(peerId, {kind: 'offer', sdp: offer});
    } catch {
      this.removePeer(peerId);
    }
  }

  public async handleSignal(fromId: string, signal: PeerSignalPayload) {
    if (typeof RTCPeerConnection === 'undefined') return;
    let entry = this.peers.get(fromId);
    if (!entry) {
      entry = this.createPeerEntry(fromId);
      entry.pc.ondatachannel = (ev) => {
        this.attachDataChannel(fromId, entry!, ev.channel);
      };
    }

    try {
      if (signal.kind === 'offer') {
        await entry.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await entry.pc.createAnswer();
        await entry.pc.setLocalDescription(answer);
        this.onSendSignal(fromId, {kind: 'answer', sdp: answer});
      } else if (signal.kind === 'answer') {
        await entry.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      } else if (signal.kind === 'ice' && signal.candidate) {
        await entry.pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    } catch {
      // Ignore stale ICE/SDP races
    }
  }

  public sendToPeer(peerId: string, payload: unknown): boolean {
    const entry = this.peers.get(peerId);
    if (!entry || !entry.dc || entry.dc.readyState !== 'open') return false;
    // Skip frame if send buffer is backed up (prevents latency buildup!)
    if (entry.dc.bufferedAmount > 64 * 1024) return true;
    try {
      entry.dc.send(JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  }

  public broadcast(payload: unknown): Set<string> {
    const sent = new Set<string>();
    const raw = JSON.stringify(payload);
    for (const [peerId, entry] of this.peers) {
      if (!entry.dc || entry.dc.readyState !== 'open') continue;
      if (entry.dc.bufferedAmount > 64 * 1024) {
        sent.add(peerId);
        continue;
      }
      try {
        entry.dc.send(raw);
        sent.add(peerId);
      } catch {
        // Fallback will handle this peer
      }
    }
    return sent;
  }

  public syncPeerIds(activePeerIds: string[]) {
    const keep = new Set(activePeerIds);
    for (const existingId of Array.from(this.peers.keys())) {
      if (!keep.has(existingId)) {
        this.removePeer(existingId);
      }
    }
  }

  public removePeer(peerId: string) {
    const entry = this.peers.get(peerId);
    if (!entry) return;
    try {
      entry.dc?.close();
      entry.pc.close();
    } catch {
      // Ignore close errors
    }
    this.peers.delete(peerId);
    this.emitStatuses();
  }

  public destroy() {
    if (this.pingTimer !== null) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    for (const peerId of Array.from(this.peers.keys())) {
      this.removePeer(peerId);
    }
  }

  private createPeerEntry(peerId: string): PeerEntry {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    const entry: PeerEntry = {
      pc,
      dc: null,
      connected: false,
      isLocalLan: false,
      rttMs: null,
      pingSentAt: 0,
    };
    this.peers.set(peerId, entry);

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        this.onSendSignal(peerId, {kind: 'ice', candidate: ev.candidate.toJSON()});
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        void this.detectLocalLan(entry);
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        entry.connected = false;
        this.emitStatuses();
      }
    };

    return entry;
  }

  private attachDataChannel(peerId: string, entry: PeerEntry, dc: RTCDataChannel) {
    entry.dc = dc;
    dc.onopen = () => {
      entry.connected = true;
      void this.detectLocalLan(entry);
      this.emitStatuses();
    };
    dc.onclose = () => {
      entry.connected = false;
      this.emitStatuses();
    };
    dc.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as Record<string, unknown>;
        if (msg.t === 'ping') {
          dc.send(JSON.stringify({t: 'pong', ts: msg.ts}));
          return;
        }
        if (msg.t === 'pong' && typeof msg.ts === 'number') {
          entry.rttMs = Math.max(1, Math.round(performance.now() - msg.ts));
          this.emitStatuses();
          return;
        }
        this.onData(peerId, msg);
      } catch {
        // Ignore bad packet
      }
    };
  }

  private async detectLocalLan(entry: PeerEntry) {
    try {
      const stats = await entry.pc.getStats();
      stats.forEach((report) => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          const local = stats.get(report.localCandidateId);
          const remote = stats.get(report.remoteCandidateId);
          if (local?.candidateType === 'host' && remote?.candidateType === 'host') {
            entry.isLocalLan = true;
          }
          if (typeof report.currentRoundTripTime === 'number') {
            entry.rttMs = Math.max(1, Math.round(report.currentRoundTripTime * 1000));
          }
        }
      });
      this.emitStatuses();
    } catch {
      // Stats optional
    }
  }

  private emitStatuses() {
    this.onStatusChange(this.getStatuses());
  }
}
