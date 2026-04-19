import type { CRDT, CRDTState } from '../types'

export interface GCounterState {
  counts: Record<string, number>
}

/**
 * Grow-only Counter. Each peer increments its own slot.
 * Value = sum of all peer slots.
 * Merge = per-peer max.
 */
export class GCounter implements CRDT<number> {
  private counts = new Map<string, number>()

  constructor(private readonly localPeerId: string) {}

  get value(): number {
    let sum = 0
    for (const v of this.counts.values()) sum += v
    return sum
  }

  increment(by = 1): void {
    const current = this.counts.get(this.localPeerId) ?? 0
    this.counts.set(this.localPeerId, current + by)
  }

  get state(): CRDTState {
    const counts: Record<string, number> = {}
    for (const [k, v] of this.counts) counts[k] = v
    return { type: 'g-counter', state: { counts } satisfies GCounterState }
  }

  merge(remote: CRDTState): void {
    const r = remote.state as GCounterState
    for (const [peerId, count] of Object.entries(r.counts)) {
      const local = this.counts.get(peerId) ?? 0
      this.counts.set(peerId, Math.max(local, count))
    }
  }
}

export interface PNCounterState {
  positive: GCounterState
  negative: GCounterState
}

/**
 * Positive-Negative Counter. Supports increment and decrement.
 * Value = positive.value - negative.value.
 */
export class PNCounter implements CRDT<number> {
  private readonly p: GCounter
  private readonly n: GCounter

  constructor(private readonly localPeerId: string) {
    this.p = new GCounter(localPeerId)
    this.n = new GCounter(localPeerId)
  }

  get value(): number {
    return this.p.value - this.n.value
  }

  increment(by = 1): void {
    this.p.increment(by)
  }

  decrement(by = 1): void {
    this.n.increment(by)
  }

  get state(): CRDTState {
    return {
      type: 'pn-counter',
      state: {
        positive: this.p.state.state,
        negative: this.n.state.state,
      } satisfies PNCounterState,
    }
  }

  merge(remote: CRDTState): void {
    const r = remote.state as PNCounterState
    this.p.merge({ type: 'g-counter', state: r.positive })
    this.n.merge({ type: 'g-counter', state: r.negative })
  }
}
