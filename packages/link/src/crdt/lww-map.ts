import type { CRDT, CRDTState } from '../types'
import { LWWRegister, type LWWState } from './lww-register'

const TOMBSTONE = Symbol.for('alaq:tombstone')

export interface LWWMapState {
  entries: Record<string, LWWState>
}

/**
 * LWW-Map: each key is an independent LWW Register.
 * Delete = set(key, TOMBSTONE) with timestamp.
 * Per-key merge: concurrent writes to different keys are preserved,
 * concurrent writes to same key → LWW.
 */
export class LWWMap<V = any> implements CRDT<Map<string, V>> {
  private registers = new Map<string, LWWRegister<V | typeof TOMBSTONE>>()

  constructor(private readonly localPeerId: string) {}

  private getOrCreate(key: string): LWWRegister<V | typeof TOMBSTONE> {
    let reg = this.registers.get(key)
    if (!reg) {
      reg = new LWWRegister<V | typeof TOMBSTONE>(this.localPeerId)
      this.registers.set(key, reg)
    }
    return reg
  }

  get value(): Map<string, V> {
    const result = new Map<string, V>()
    for (const [k, reg] of this.registers) {
      if (reg.value !== TOMBSTONE && reg.value !== undefined) {
        result.set(k, reg.value as V)
      }
    }
    return result
  }

  get(key: string): V | undefined {
    const reg = this.registers.get(key)
    if (!reg || reg.value === TOMBSTONE) return undefined
    return reg.value as V | undefined
  }

  set(key: string, value: V, timestamp?: number): void {
    this.getOrCreate(key).set(value, timestamp)
  }

  delete(key: string, timestamp?: number): void {
    this.getOrCreate(key).set(TOMBSTONE, timestamp)
  }

  has(key: string): boolean {
    const reg = this.registers.get(key)
    return !!reg && reg.value !== TOMBSTONE && reg.value !== undefined
  }

  keys(): string[] {
    const result: string[] = []
    for (const [k, reg] of this.registers) {
      if (reg.value !== TOMBSTONE && reg.value !== undefined) {
        result.push(k)
      }
    }
    return result
  }

  entries(): [string, V][] {
    const result: [string, V][] = []
    for (const [k, reg] of this.registers) {
      if (reg.value !== TOMBSTONE && reg.value !== undefined) {
        result.push([k, reg.value as V])
      }
    }
    return result
  }

  get state(): CRDTState {
    const entries: Record<string, LWWState> = {}
    for (const [k, reg] of this.registers) {
      const s = reg.state.state as LWWState
      // Serialize TOMBSTONE as null for wire format
      entries[k] = {
        value: s.value === TOMBSTONE ? null : s.value,
        timestamp: s.timestamp,
        peerId: s.peerId,
      }
    }
    return { type: 'lww-map', state: { entries } satisfies LWWMapState }
  }

  merge(remote: CRDTState): void {
    const r = remote.state as LWWMapState
    for (const [k, remoteState] of Object.entries(r.entries)) {
      const reg = this.getOrCreate(k)
      // Deserialize null back to TOMBSTONE
      const state: LWWState = {
        ...remoteState,
        value: remoteState.value === null ? TOMBSTONE : remoteState.value,
      }
      reg.merge({ type: 'lww', state })
    }
  }
}
