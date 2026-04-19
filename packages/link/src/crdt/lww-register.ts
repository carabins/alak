import type { CRDT, CRDTState } from '../types'

export interface LWWState<T = any> {
  value: T | undefined
  timestamp: number
  peerId: string
}

/**
 * Last-Write-Wins Register.
 * Higher timestamp wins. Equal timestamps → higher peerId wins (deterministic).
 */
export class LWWRegister<T = any> implements CRDT<T | undefined> {
  private _value: T | undefined
  private _timestamp: number
  private _peerId: string

  constructor(
    private readonly localPeerId: string,
    value?: T,
    timestamp = 0,
  ) {
    this._value = value
    this._timestamp = timestamp
    this._peerId = localPeerId
  }

  get value(): T | undefined {
    return this._value
  }

  get timestamp(): number {
    return this._timestamp
  }

  get peerId(): string {
    return this._peerId
  }

  set(value: T, timestamp?: number): LWWState<T> {
    const ts = timestamp ?? Date.now()
    this._value = value
    this._timestamp = ts
    this._peerId = this.localPeerId
    return { value, timestamp: ts, peerId: this.localPeerId }
  }

  get state(): CRDTState {
    return {
      type: 'lww',
      state: {
        value: this._value,
        timestamp: this._timestamp,
        peerId: this._peerId,
      } satisfies LWWState<T>,
    }
  }

  merge(remote: CRDTState): void {
    const r = remote.state as LWWState<T>
    if (
      r.timestamp > this._timestamp ||
      (r.timestamp === this._timestamp && r.peerId > this._peerId)
    ) {
      this._value = r.value
      this._timestamp = r.timestamp
      this._peerId = r.peerId
    }
  }
}
