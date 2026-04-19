import type { CRDT, CRDTState } from '../types'

type Tag = string // `${peerId}:${clock}`

export interface ORSetState<T = any> {
  // element (JSON-stringified) → set of tags
  entries: Record<string, string[]>
  // all tags ever removed (for distributed consistency)
  removed: string[]
}

/**
 * Add-wins Observed-Remove Set.
 * Each add() creates a unique tag. remove() removes all current tags of an element.
 * Concurrent add + remove → element survives (add-wins).
 */
export class ORSet<T = any> implements CRDT<Set<T>> {
  // element key → set of active tags
  private entries = new Map<string, Set<Tag>>()
  // reverse: element key → element value (for deserialization)
  private elements = new Map<string, T>()
  private clock = 0
  // all removed tags (needed for merge correctness)
  private removed = new Set<Tag>()

  constructor(private readonly localPeerId: string) {}

  private key(element: T): string {
    return JSON.stringify(element)
  }

  private tag(): Tag {
    return `${this.localPeerId}:${++this.clock}`
  }

  get value(): Set<T> {
    const result = new Set<T>()
    for (const [k, tags] of this.entries) {
      if (tags.size > 0) result.add(this.elements.get(k)!)
    }
    return result
  }

  get size(): number {
    let count = 0
    for (const tags of this.entries.values()) {
      if (tags.size > 0) count++
    }
    return count
  }

  has(element: T): boolean {
    const k = this.key(element)
    const tags = this.entries.get(k)
    return !!tags && tags.size > 0
  }

  add(element: T): Tag {
    const k = this.key(element)
    const t = this.tag()
    let tags = this.entries.get(k)
    if (!tags) {
      tags = new Set()
      this.entries.set(k, tags)
    }
    tags.add(t)
    this.elements.set(k, element)
    return t
  }

  remove(element: T): void {
    const k = this.key(element)
    const tags = this.entries.get(k)
    if (tags) {
      for (const t of tags) this.removed.add(t)
      tags.clear()
    }
  }

  get state(): CRDTState {
    const entries: Record<string, string[]> = {}
    for (const [k, tags] of this.entries) {
      if (tags.size > 0) entries[k] = [...tags]
    }
    return {
      type: 'or-set',
      state: {
        entries,
        removed: [...this.removed],
      } satisfies ORSetState<T>,
    }
  }

  merge(remote: CRDTState): void {
    const r = remote.state as ORSetState<T>
    const remoteRemoved = new Set(r.removed)

    // Merge remote removed tags into local
    for (const t of r.removed) this.removed.add(t)

    // Apply remote entries
    for (const [k, remoteTags] of Object.entries(r.entries)) {
      let localTags = this.entries.get(k)
      if (!localTags) {
        localTags = new Set()
        this.entries.set(k, localTags)
        // Restore element value from key
        try { this.elements.set(k, JSON.parse(k)) } catch {}
      }

      for (const t of remoteTags) {
        // Add remote tag if not locally removed
        if (!this.removed.has(t)) {
          localTags.add(t)
        }
      }
    }

    // Remove locally any tags that remote has removed
    for (const [k, localTags] of this.entries) {
      for (const t of localTags) {
        if (remoteRemoved.has(t)) {
          localTags.delete(t)
        }
      }
    }
  }
}
