import type { CRDT, CRDTState } from '../types'

interface RGANode<T = any> {
  id: string        // `${peerId}:${clock}`
  value: T
  deleted: boolean
  leftId: string | null  // id of predecessor at insertion time
}

export interface RGAState<T = any> {
  nodes: RGANode<T>[]
}

/**
 * Replicated Growable Array (simplified YATA-like).
 * Ordered list CRDT — concurrent inserts at same position
 * resolve deterministically by id comparison.
 */
export class RGA<T = any> implements CRDT<T[]> {
  private nodes: RGANode<T>[] = []
  private nodeIndex = new Map<string, number>() // id → index in nodes
  private clock = 0

  constructor(private readonly localPeerId: string) {}

  private id(): string {
    return `${this.localPeerId}:${++this.clock}`
  }

  private rebuildIndex(): void {
    this.nodeIndex.clear()
    for (let i = 0; i < this.nodes.length; i++) {
      this.nodeIndex.set(this.nodes[i].id, i)
    }
  }

  // Visible index → real index (skipping tombstones)
  private visibleToReal(visibleIdx: number): number {
    let seen = 0
    for (let i = 0; i < this.nodes.length; i++) {
      if (!this.nodes[i].deleted) {
        if (seen === visibleIdx) return i
        seen++
      }
    }
    return this.nodes.length // append position
  }

  get value(): T[] {
    const result: T[] = []
    for (const n of this.nodes) {
      if (!n.deleted) result.push(n.value)
    }
    return result
  }

  get length(): number {
    let count = 0
    for (const n of this.nodes) {
      if (!n.deleted) count++
    }
    return count
  }

  get(index: number): T | undefined {
    const real = this.visibleToReal(index)
    return real < this.nodes.length ? this.nodes[real].value : undefined
  }

  insert(index: number, value: T): string {
    const nodeId = this.id()
    const realIdx = this.visibleToReal(index)
    // leftId = the node just before insertion point
    const leftId = realIdx > 0 ? this.nodes[realIdx - 1].id : null

    const node: RGANode<T> = { id: nodeId, value, deleted: false, leftId }
    this.nodes.splice(realIdx, 0, node)
    this.rebuildIndex()
    return nodeId
  }

  push(value: T): string {
    return this.insert(this.length, value)
  }

  remove(index: number): void {
    const realIdx = this.visibleToReal(index)
    if (realIdx < this.nodes.length) {
      this.nodes[realIdx].deleted = true
    }
  }

  get state(): CRDTState {
    return {
      type: 'rga',
      state: { nodes: this.nodes.map(n => ({ ...n })) } satisfies RGAState<T>,
    }
  }

  merge(remote: CRDTState): void {
    const r = remote.state as RGAState<T>
    const localIds = new Set(this.nodes.map(n => n.id))

    for (const remoteNode of r.nodes) {
      if (localIds.has(remoteNode.id)) {
        // Node exists locally — merge tombstone (delete wins if either side deleted)
        const localIdx = this.nodeIndex.get(remoteNode.id)
        if (localIdx !== undefined && remoteNode.deleted) {
          this.nodes[localIdx].deleted = true
        }
        continue
      }

      // New node — find insertion position
      const insertPos = this.findInsertPosition(remoteNode)
      this.nodes.splice(insertPos, 0, { ...remoteNode })
      localIds.add(remoteNode.id)
    }

    this.rebuildIndex()
  }

  private findInsertPosition(node: RGANode<T>): number {
    if (node.leftId === null) {
      // Insert at beginning — but after any concurrent inserts with leftId=null and higher id
      let pos = 0
      while (
        pos < this.nodes.length &&
        this.nodes[pos].leftId === null &&
        this.nodes[pos].id > node.id
      ) {
        pos++
      }
      return pos
    }

    // Find left neighbor
    const leftIdx = this.nodeIndex.get(node.leftId)
    if (leftIdx === undefined) {
      // Left neighbor not found — append (will be resolved on next merge)
      return this.nodes.length
    }

    // Insert after left neighbor, but respect ordering with concurrent inserts
    // that also have the same leftId: higher id goes first (deterministic)
    let pos = leftIdx + 1
    while (pos < this.nodes.length) {
      const existing = this.nodes[pos]
      // Stop if we find a node with a different left origin
      if (existing.leftId !== node.leftId) break
      // Among siblings (same leftId), higher id goes first
      if (existing.id < node.id) break
      pos++
    }
    return pos
  }
}
