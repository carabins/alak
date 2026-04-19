import type { CRDTState, CRDTOp } from '../types'
import { LWWRegister } from './lww-register'
import { PNCounter } from './counter'
import { ORSet } from './or-set'
import { LWWMap } from './lww-map'
import { RGA } from './rga'

export type CRDTType = 'lww' | 'pn-counter' | 'or-set' | 'lww-map' | 'rga'

export interface FieldSchema {
  type: CRDTType
}

export interface CRDTEngineConfig {
  peerId: string
  schema: Record<string, FieldSchema>
  onBroadcast: (op: CRDTOp) => void
}

/**
 * CRDT Engine — bridge between SyncStore and transport.
 *
 * - Manages a CRDT instance per field (based on schema).
 * - Intercepts local changes → wraps in CRDT op → broadcasts.
 * - Receives remote ops → merges → returns resolved value.
 */
export class CRDTEngine {
  private instances = new Map<string, any>()
  private clock = 0
  private readonly peerId: string
  private readonly schema: Record<string, FieldSchema>
  private readonly onBroadcast: (op: CRDTOp) => void

  constructor(config: CRDTEngineConfig) {
    this.peerId = config.peerId
    this.schema = config.schema
    this.onBroadcast = config.onBroadcast
  }

  /** Get or create a CRDT instance for a field path */
  private getInstance(path: string): any {
    let inst = this.instances.get(path)
    if (inst) return inst

    const fieldSchema = this.resolveSchema(path)
    if (!fieldSchema) return null

    switch (fieldSchema.type) {
      case 'lww':
        inst = new LWWRegister(this.peerId)
        break
      case 'pn-counter':
        inst = new PNCounter(this.peerId)
        break
      case 'or-set':
        inst = new ORSet(this.peerId)
        break
      case 'lww-map':
        inst = new LWWMap(this.peerId)
        break
      case 'rga':
        inst = new RGA(this.peerId)
        break
    }

    if (inst) this.instances.set(path, inst)
    return inst
  }

  /** Resolve schema for a path (supports wildcards: "room.players" matches "room.players.*") */
  private resolveSchema(path: string): FieldSchema | null {
    // Exact match
    if (this.schema[path]) return this.schema[path]

    // Try parent paths with wildcard
    const parts = path.split('.')
    for (let i = parts.length - 1; i >= 0; i--) {
      const prefix = parts.slice(0, i).join('.') + '.*'
      if (this.schema[prefix]) return this.schema[prefix]
    }

    // Default: LWW for unknown fields
    return { type: 'lww' }
  }

  /** Apply a local change (from SyncStore) and broadcast */
  applyLocal(path: string, value: any): void {
    const inst = this.getInstance(path)
    if (!inst) return

    const fieldSchema = this.resolveSchema(path)
    if (!fieldSchema) return

    // Apply locally
    switch (fieldSchema.type) {
      case 'lww':
        (inst as LWWRegister).set(value)
        break
      case 'pn-counter':
        // For counters, value is a delta (positive = increment, negative = decrement)
        if (typeof value === 'number') {
          if (value > 0) (inst as PNCounter).increment(value)
          else if (value < 0) (inst as PNCounter).decrement(-value)
        }
        break
      case 'or-set':
        // value = { add: element } or { remove: element }
        if (value?.add !== undefined) (inst as ORSet).add(value.add)
        else if (value?.remove !== undefined) (inst as ORSet).remove(value.remove)
        break
      case 'lww-map':
        // value = { key, value } or { key, delete: true }
        if (value?.delete) (inst as LWWMap).delete(value.key)
        else if (value?.key !== undefined) (inst as LWWMap).set(value.key, value.value)
        break
      case 'rga':
        // value = { insert: { index, value } } or { remove: index } or { push: value }
        if (value?.insert) (inst as RGA).insert(value.insert.index, value.insert.value)
        else if (value?.remove !== undefined) (inst as RGA).remove(value.remove)
        else if (value?.push !== undefined) (inst as RGA).push(value.push)
        break
    }

    // Broadcast
    this.onBroadcast({
      type: fieldSchema.type,
      peerId: this.peerId,
      clock: ++this.clock,
      path,
      op: inst.state,
    })
  }

  /** Apply a remote CRDT operation */
  applyRemote(op: CRDTOp): any {
    const inst = this.getInstance(op.path)
    if (!inst) return undefined

    inst.merge(op.op)
    return inst.value
  }

  /** Get current value of a CRDT field */
  getValue(path: string): any {
    const inst = this.instances.get(path)
    return inst?.value
  }

  /** Get full CRDT state for initial sync */
  getState(): Record<string, CRDTState> {
    const result: Record<string, CRDTState> = {}
    for (const [path, inst] of this.instances) {
      result[path] = inst.state
    }
    return result
  }

  /** Merge full state from another peer (initial sync) */
  mergeState(remoteState: Record<string, CRDTState>): void {
    for (const [path, state] of Object.entries(remoteState)) {
      const inst = this.getInstance(path)
      if (inst) inst.merge(state)
    }
  }
}
