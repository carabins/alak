import type { LinkHub } from './types'
import type { CRDTOp } from './types'
import { ServerMsg } from './types'
import { CRDTEngine, type CRDTEngineConfig, type FieldSchema } from './crdt/index'
import { encodeMessage } from './codec'
import { isGhost } from '@alaq/deep-state'

export interface BridgeConfig {
  hub: LinkHub
  schema: Record<string, FieldSchema>
  /** SyncStore instance — duck-typed to avoid hard dep on link-state */
  store: {
    applyPatch(path: string, value: any): void
    _subscribePath(path: string, fn: Function): () => void
  }
}

/**
 * Bridge between SyncStore and LinkHub via CRDT Engine.
 *
 * Flow:
 *   App → SyncStore → Bridge → CRDT Engine → LinkHub → Network
 *   Network → LinkHub → Bridge → CRDT Engine → SyncStore → App
 */
export class SyncBridge {
  private crdt: CRDTEngine
  private unsubs: (() => void)[] = []
  private hub: LinkHub
  private store: BridgeConfig['store']

  constructor(config: BridgeConfig) {
    this.hub = config.hub
    this.store = config.store

    this.crdt = new CRDTEngine({
      peerId: config.hub.peerId,
      schema: config.schema,
      onBroadcast: (op) => {
        config.hub.send('crdt', op, 'reliable')
      },
    })

    // Listen for remote CRDT ops
    this.unsubs.push(
      config.hub.on('crdt', (data: CRDTOp, _peerId) => {
        const resolved = this.crdt.applyRemote(data)
        if (resolved !== undefined) {
          this.store.applyPatch(data.path, resolved)
        }
      })
    )

    // Listen for snapshots (initial state sync)
    this.unsubs.push(
      config.hub.on('snapshot', (data: Record<string, any>, _peerId) => {
        this.crdt.mergeState(data)
        // Apply all resolved values to store
        for (const [path] of Object.entries(data)) {
          const val = this.crdt.getValue(path)
          if (val !== undefined) {
            this.store.applyPatch(path, val)
          }
        }
      })
    )
  }

  /** Watch a path in SyncStore and feed changes into CRDT */
  watch(path: string): () => void {
    let lastValue: any
    const unsub = this.store._subscribePath(path, (value: any) => {
      // Ghost proxies represent "no data yet" — never broadcast them.
      // Without this guard, the initial subscribe push feeds a ghost into
      // CRDT.applyLocal, which serializes proxy state, broadcasts it, and
      // on remote echo triggers another listener → another applyLocal loop.
      if (isGhost(value) || value === undefined) return
      // Avoid echo (remote → store → bridge → broadcast)
      if (value === lastValue) return
      lastValue = value
      this.crdt.applyLocal(path, value)
    })
    this.unsubs.push(unsub)
    return unsub
  }

  /** Get full CRDT state (for sending to new peers) */
  getState(): Record<string, any> {
    return this.crdt.getState()
  }

  destroy(): void {
    for (const unsub of this.unsubs) unsub()
    this.unsubs = []
  }
}
