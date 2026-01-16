import type { Job } from './types';

export class PriorityQueue<T extends Job> {
  private _heap: T[] = [];

  get size(): number {
    return this._heap.length;
  }

  get isEmpty(): boolean {
    return this._heap.length === 0;
  }

  peek(): T | undefined {
    return this._heap[0];
  }

  push(item: T): void {
    this._heap.push(item);
    this._siftUp();
  }

  pop(): T | undefined {
    if (this.isEmpty) return undefined;
    
    const root = this._heap[0];
    const last = this._heap.pop()!;
    
    if (!this.isEmpty) {
      this._heap[0] = last;
      this._siftDown();
    }
    
    return root;
  }

  remove(id: string): boolean {
    const idx = this._heap.findIndex(job => job.id === id);
    if (idx === -1) return false;

    if (idx === this._heap.length - 1) {
        this._heap.pop();
        return true;
    }

    const last = this._heap.pop()!;
    this._heap[idx] = last;
    
    // Try both directions to restore heap property
    this._siftUp(idx);
    this._siftDown(idx);
    
    return true;
  }

  clear(): void {
    this._heap = [];
  }

  // --- Private Helpers ---

  private _compare(a: T, b: T): number {
    // Higher priority first
    const pA = a.options.priority || 0;
    const pB = b.options.priority || 0;
    if (pA !== pB) return pA - pB; // Descending sort logic handled in sift

    // FIFO fallback for same priority (using creation/insertion order implied by ID or timestamp?)
    // For simplicity, we assume stability isn't strictly guaranteed without a sequence number.
    // Ideally, add `_seq` to Job if FIFO is critical for equal priorities.
    return 0; 
  }

  private _siftUp(idx: number = this._heap.length - 1): void {
    let nodeIdx = idx;
    while (nodeIdx > 0) {
      const parentIdx = (nodeIdx - 1) >>> 1;
      const parent = this._heap[parentIdx];
      const node = this._heap[nodeIdx];

      if (this._compare(node, parent) <= 0) break; // Node is smaller/equal (lower priority), correct position for MaxHeap?
      // Wait, we want MaxHeap (higher priority first).
      // If node > parent, swap.
      
      this._swap(nodeIdx, parentIdx);
      nodeIdx = parentIdx;
    }
  }

  private _siftDown(idx: number = 0): void {
    let nodeIdx = idx;
    const length = this._heap.length;
    const node = this._heap[nodeIdx];

    while (true) {
      const leftChildIdx = (nodeIdx << 1) + 1;
      const rightChildIdx = leftChildIdx + 1;
      let swapIdx: number | null = null;

      if (leftChildIdx < length) {
        const leftChild = this._heap[leftChildIdx];
        if (this._compare(leftChild, node) > 0) {
          swapIdx = leftChildIdx;
        }
      }

      if (rightChildIdx < length) {
        const rightChild = this._heap[rightChildIdx];
        const current = swapIdx === null ? node : this._heap[leftChildIdx];
        if (this._compare(rightChild, current) > 0) {
          swapIdx = rightChildIdx;
        }
      }

      if (swapIdx === null) break;

      this._swap(nodeIdx, swapIdx);
      nodeIdx = swapIdx;
    }
  }

  private _swap(i: number, j: number): void {
    const temp = this._heap[i];
    this._heap[i] = this._heap[j];
    this._heap[j] = temp;
  }
}
