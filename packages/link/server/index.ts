import { ServerMsg } from '../src/types'
import { encodeMessage, decodeMessage, msgpackCodec } from '../src/codec'
import type { Codec } from '../src/types'

// Bun runtime is provided by the host. We declare it loosely so this
// package's `.d.ts` bundle builds without `@types/bun` in the tree.
declare const Bun: any

export interface LinkServerConfig {
  port?: number
  hostname?: string
  tls?: { cert: string; key: string }
  codec?: Codec
  onAction?: (action: string, path: string, args: any, peerId: string) => any
}

interface ServerPeer {
  id: string
  ws: any // Bun ServerWebSocket
  ip: string
  metadata: Record<string, any>
  joinedAt: number
}

/**
 * Bun.js Link Server.
 *
 * The server is a special peer — not a traditional REST backend.
 * It holds the "crown" (authority) by default and manages:
 *   - WebSocket endpoint for all clients
 *   - Signaling relay for WebRTC P2P setup
 *   - Cloud Echo (LAN peer matching by IP)
 *   - State persistence (in-memory)
 */
export function createLinkServer(config: LinkServerConfig = {}) {
  const port = config.port ?? 3000
  const codec = config.codec ?? msgpackCodec
  const peers = new Map<string, ServerPeer>()
  const state = new Map<string, any>() // in-memory state
  let crownHolder = '__server__'

  function broadcast(msg: Uint8Array, exclude?: string, roomId?: string) {
    for (const [id, peer] of peers) {
      if (id !== exclude) {
        if (roomId && peer.metadata.roomId !== roomId) continue
        peer.ws.send(msg)
      }
    }
  }

  function sendTo(peerId: string, msgType: ServerMsg, payload: any) {
    const peer = peers.get(peerId)
    if (peer) {
      peer.ws.send(encodeMessage(msgType, payload, codec))
    }
  }

  function getPeerList(exclude?: string, roomId?: string) {
    const list: any[] = []
    for (const [id, p] of peers) {
      if (id !== exclude) {
        if (roomId && p.metadata.roomId !== roomId) continue
        list.push({
          id,
          name: p.metadata.name,
          isLocal: false,
          connection: 'server',
          metadata: p.metadata,
        })
      }
    }
    return list
  }

  // Cloud Echo: find peers with same public IP
  function findLocalPeers(ip: string, exclude: string): string[] {
    const local: string[] = []
    for (const [id, p] of peers) {
      if (id !== exclude && p.ip === ip) {
        local.push(id)
      }
    }
    return local
  }

  function generatePeerId(): string {
    return Math.random().toString(36).slice(2, 10)
  }

  const server = Bun.serve({
    port,
    ...(config.hostname ? { hostname: config.hostname } : {}),
    ...(config.tls ? { tls: config.tls } : {}),

    fetch(req, server) {
      const url = new URL(req.url)

      // Reference Protocol — serve large payloads via HTTP
      if (url.pathname.startsWith('/ref/')) {
        const key = url.pathname.slice(5)
        const data = state.get(key)
        if (data) {
          return new Response(codec.encode(data), {
            headers: { 'Content-Type': 'application/octet-stream' },
          })
        }
        return new Response('Not found', { status: 404 })
      }

      // WebSocket upgrade
      if (server.upgrade(req, { data: { peerId: generatePeerId() } })) {
        return
      }

      return new Response('Alaq Link Server', { status: 200 })
    },

    websocket: {
      open(ws) {
        const peerId = (ws.data as any).peerId as string
        const ip = ws.remoteAddress ?? 'unknown'

        const peer: ServerPeer = {
          id: peerId,
          ws,
          ip,
          metadata: {},
          joinedAt: Date.now(),
        }
        peers.set(peerId, peer)
      },

      async message(ws, msg) {
        const peerId = (ws.data as any).peerId as string
        const raw = msg instanceof Buffer ? new Uint8Array(msg) : new Uint8Array(msg as ArrayBuffer)

        let decoded: { type: ServerMsg; payload: any }
        try {
          decoded = decodeMessage(raw, codec)
        } catch {
          return // malformed message
        }

        const { type, payload } = decoded

        switch (type) {
          case ServerMsg.HELLO: {
            const peer = peers.get(peerId)
            if (peer) {
              peer.metadata = payload.metadata ?? {}
            }

            // Evict stale connection with the same clientId (page refresh)
            const incomingClientId = payload.metadata?.clientId
            if (incomingClientId) {
              for (const [oldId, oldPeer] of peers) {
                if (oldId !== peerId && oldPeer.metadata.clientId === incomingClientId) {
                  const oldRoomId = oldPeer.metadata.roomId
                  peers.delete(oldId)
                  try { oldPeer.ws.close() } catch {}
                  broadcast(
                    encodeMessage(ServerMsg.PEER_LEAVE, { id: oldId }, codec),
                    undefined,
                    oldRoomId
                  )
                }
              }
            }

            const peerRoomId = payload.metadata?.roomId

            // Send welcome with peer list (scoped to room)
            sendTo(peerId, ServerMsg.WELCOME, {
              peerId,
              crownHolder,
              peers: getPeerList(peerId, peerRoomId),
            })

            // Notify others in the same room
            broadcast(
              encodeMessage(ServerMsg.PEER_JOIN, {
                id: peerId,
                name: payload.metadata?.name,
                metadata: payload.metadata,
              }, codec),
              peerId,
              peerRoomId
            )

            // Cloud Echo: notify about LAN peers via PATCH (not PEER_JOIN — that would create ghost peers)
            const peer2 = peers.get(peerId)
            if (peer2) {
              const localPeers = findLocalPeers(peer2.ip, peerId)
              if (localPeers.length > 0) {
                sendTo(peerId, ServerMsg.PATCH, {
                  ch: 'cloud-echo',
                  d: { localPeers },
                })
              }
            }
            break
          }

          case ServerMsg.PATCH: {
            // Broadcast to peers in the same room
            const room = peers.get(peerId)?.metadata.roomId
            broadcast(raw, peerId, room)
            break
          }

          case ServerMsg.CRDT_OP: {
            const room = peers.get(peerId)?.metadata.roomId
            broadcast(raw, peerId, room)
            break
          }

          case ServerMsg.CRDT_STATE: {
            const room = peers.get(peerId)?.metadata.roomId
            broadcast(raw, peerId, room)
            break
          }

          case ServerMsg.FETCH: {
            // Request-response: forward to action handler or return from state.
            // onAction can be async; await so the Promise is not serialized as {}.
            const result = await config.onAction?.(payload.d?.action, payload.d?.path, payload.d?.args, peerId)
            sendTo(peerId, ServerMsg.FETCH, { seq: payload.seq, d: result })
            break
          }

          case ServerMsg.SUB:
          case ServerMsg.UNSUB:
            // Subscription management — no-op for now (CRDT handles sync)
            break

          case ServerMsg.ACTION:
            // Forward action to handler
            config.onAction?.(payload.action, payload.path, payload.args, peerId)
            break

          case ServerMsg.PING:
            // Respond with PONG
            sendTo(peerId, ServerMsg.PONG, {
              t: Date.now(),
              rt: payload.t,
            })
            break

          case ServerMsg.CROWN_BEAT:
            // Crown heartbeat — relay to all
            crownHolder = payload.holder
            broadcast(raw, peerId)
            break

          case ServerMsg.CROWN_CLAIM:
            crownHolder = payload.claimant
            broadcast(raw)
            break

          // Signaling relay — forward to target peer
          case ServerMsg.SIG_OFFER:
          case ServerMsg.SIG_ANSWER:
          case ServerMsg.SIG_ICE:
            if (payload.target) {
              sendTo(payload.target, type, { ...payload, from: peerId })
            }
            break
        }
      },

      close(ws) {
        const peerId = (ws.data as any).peerId as string
        // Already evicted by HELLO handler — skip
        if (!peers.has(peerId)) return
        const peerRoomId = peers.get(peerId)?.metadata.roomId
        peers.delete(peerId)

        // Notify others in the same room
        broadcast(
          encodeMessage(ServerMsg.PEER_LEAVE, { id: peerId }, codec),
          undefined,
          peerRoomId
        )

        // If crown holder left, trigger election (broadcast claim for lowest remaining peer)
        if (peerId === crownHolder && peers.size > 0) {
          const sorted = [...peers.keys()].sort()
          crownHolder = sorted[0]
          broadcast(
            encodeMessage(ServerMsg.CROWN_CLAIM, { claimant: crownHolder }, codec)
          )
        }
      },
    },
  })

  return {
    server,
    port,
    get peers() { return peers },
    get crownHolder() { return crownHolder },
    stop() { server.stop() },
  }
}
