import { uuidV7 } from '@alaq/rune'
import type { LinkDriver, DriverCapabilities, DriverConfig, DriverState, QoS, MessageHandler, PeerInfo } from '../types'

interface RTCPeerState {
  connection: RTCPeerConnection
  reliableChannel: RTCDataChannel | null
  unreliableChannel: RTCDataChannel | null
  state: 'connecting' | 'connected' | 'failed'
}

export interface SignalingTransport {
  sendOffer(targetPeerId: string, sdp: RTCSessionDescriptionInit): void
  sendAnswer(targetPeerId: string, sdp: RTCSessionDescriptionInit): void
  sendIce(targetPeerId: string, candidate: RTCIceCandidateInit): void
}

/**
 * WebRTC Driver — P2P transport via RTCDataChannel.
 * Creates one RTCPeerConnection per remote peer.
 * Two channels per peer: reliable (ordered) + unreliable (maxRetransmits: 0).
 */
export class WebRTCDriver implements LinkDriver {
  readonly id = 'webrtc'
  readonly type = 'p2p' as const
  readonly capabilities: DriverCapabilities = {
    reliable: true,
    unreliable: true,
    ordered: false,
    maxMessageSize: 256 * 1024,
  }

  private peerConnections = new Map<string, RTCPeerState>()
  private _state: DriverState = 'idle'
  private handlers: MessageHandler[] = []
  private stateHandlers: ((state: DriverState) => void)[] = []
  private signaling: SignalingTransport | null = null
  private localPeerId = ''

  get state(): DriverState {
    return this._state
  }

  get peers(): Map<string, PeerInfo> {
    const result = new Map<string, PeerInfo>()
    for (const [id, pc] of this.peerConnections) {
      if (pc.state === 'connected') {
        result.set(id, { id, isLocal: true })
      }
    }
    return result
  }

  async connect(config: DriverConfig): Promise<void> {
    this.localPeerId = config.peerId ?? uuidV7()
    this.setState('connected') // WebRTC driver is "ready" once signaling is available
  }

  disconnect(): void {
    for (const [id] of this.peerConnections) {
      this.closePeer(id)
    }
    this.peerConnections.clear()
    this.setState('disconnected')
  }

  setSignaling(transport: SignalingTransport): void {
    this.signaling = transport
  }

  send(_channel: string, data: Uint8Array, qos: QoS): void {
    // Broadcast to all connected peers
    for (const [, pc] of this.peerConnections) {
      if (pc.state !== 'connected') continue
      const channel = qos === 'unreliable' ? pc.unreliableChannel : pc.reliableChannel
      if (channel && channel.readyState === 'open') {
        channel.send(data)
      }
    }
  }

  /** Send to a specific peer */
  sendToPeer(peerId: string, data: Uint8Array, qos: QoS): void {
    const pc = this.peerConnections.get(peerId)
    if (!pc || pc.state !== 'connected') return
    const channel = qos === 'unreliable' ? pc.unreliableChannel : pc.reliableChannel
    if (channel && channel.readyState === 'open') {
      channel.send(data)
    }
  }

  onMessage(handler: MessageHandler): void {
    this.handlers.push(handler)
  }

  onStateChange(handler: (state: DriverState) => void): void {
    this.stateHandlers.push(handler)
  }

  // ── Signaling Handlers (called by LinkHub when receiving signaling via WS) ──

  /** Initiate P2P connection to a remote peer */
  async createOffer(remotePeerId: string): Promise<void> {
    if (!this.signaling) return

    const pc = this.createPeerConnection(remotePeerId)

    // Create data channels (initiator creates them)
    pc.reliableChannel = pc.connection.createDataChannel('reliable', { ordered: true })
    pc.unreliableChannel = pc.connection.createDataChannel('unreliable', {
      ordered: false,
      maxRetransmits: 0,
    })

    this.setupChannel(pc.reliableChannel, remotePeerId)
    this.setupChannel(pc.unreliableChannel, remotePeerId)

    const offer = await pc.connection.createOffer()
    await pc.connection.setLocalDescription(offer)
    this.signaling.sendOffer(remotePeerId, offer)
  }

  /** Handle incoming SDP offer from a remote peer */
  async handleOffer(remotePeerId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    if (!this.signaling) return

    const pc = this.createPeerConnection(remotePeerId)

    // Answerer receives data channels via ondatachannel
    pc.connection.ondatachannel = (event) => {
      const ch = event.channel
      if (ch.label === 'reliable') {
        pc.reliableChannel = ch
      } else if (ch.label === 'unreliable') {
        pc.unreliableChannel = ch
      }
      this.setupChannel(ch, remotePeerId)
    }

    await pc.connection.setRemoteDescription(sdp)
    const answer = await pc.connection.createAnswer()
    await pc.connection.setLocalDescription(answer)
    this.signaling.sendAnswer(remotePeerId, answer)
  }

  /** Handle incoming SDP answer */
  async handleAnswer(remotePeerId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.peerConnections.get(remotePeerId)
    if (!pc) return
    await pc.connection.setRemoteDescription(sdp)
  }

  /** Handle incoming ICE candidate */
  async handleIce(remotePeerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const pc = this.peerConnections.get(remotePeerId)
    if (!pc) return
    await pc.connection.addIceCandidate(candidate)
  }

  closePeer(peerId: string): void {
    const pc = this.peerConnections.get(peerId)
    if (!pc) return
    pc.reliableChannel?.close()
    pc.unreliableChannel?.close()
    pc.connection.close()
    this.peerConnections.delete(peerId)
  }

  // ── Internal ──

  private createPeerConnection(remotePeerId: string): RTCPeerState {
    const existing = this.peerConnections.get(remotePeerId)
    if (existing) return existing

    const connection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    })

    const pcState: RTCPeerState = {
      connection,
      reliableChannel: null,
      unreliableChannel: null,
      state: 'connecting',
    }

    connection.onicecandidate = (event) => {
      if (event.candidate && this.signaling) {
        this.signaling.sendIce(remotePeerId, event.candidate.toJSON())
      }
    }

    connection.onconnectionstatechange = () => {
      if (connection.connectionState === 'connected') {
        pcState.state = 'connected'
      } else if (connection.connectionState === 'failed' || connection.connectionState === 'closed') {
        pcState.state = 'failed'
        this.peerConnections.delete(remotePeerId)
      }
    }

    this.peerConnections.set(remotePeerId, pcState)
    return pcState
  }

  private setupChannel(channel: RTCDataChannel, peerId: string): void {
    channel.binaryType = 'arraybuffer'
    channel.onmessage = (ev) => {
      const data = new Uint8Array(ev.data as ArrayBuffer)
      for (const h of this.handlers) {
        h(channel.label, data, peerId)
      }
    }
  }

  private setState(s: DriverState): void {
    this._state = s
    for (const h of this.stateHandlers) h(s)
  }
}
