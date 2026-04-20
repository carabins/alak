/**
 * Debounced write scheduler.
 *
 * Per-nucl queue: single-value mode keeps only the latest pending value
 * (last-write-wins). Collection mode accumulates ops until the debounce
 * fires, then flushes them in one readwrite transaction.
 *
 * Contract:
 *   - `schedule(fn)` — registers a flush callback; clears previous timer.
 *   - `flushNow()`   — if pending, fires immediately.
 *   - `hasPending()` — boolean.
 *
 * The caller decides what "pending" means (e.g. for KV: staged value).
 */

/** Registry of all active queues — lets tests cancel pending timers on reset. */
const liveQueues: Set<WriteQueue> = new Set()

export class WriteQueue {
  private timer: any = null
  private pending = false
  private flushFn: (() => Promise<void>) | null = null

  constructor(public readonly debounceMs: number) {
    liveQueues.add(this)
  }

  schedule(fn: () => Promise<void>): void {
    this.pending = true
    this.flushFn = fn
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = setTimeout(() => this.trigger(), this.debounceMs)
  }

  async flushNow(): Promise<void> {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (this.pending && this.flushFn) {
      await this.trigger()
    }
  }

  hasPending(): boolean {
    return this.pending
  }

  /** Cancel any pending timer; drop staged flushFn. */
  cancel(): void {
    if (this.timer !== null) { clearTimeout(this.timer); this.timer = null }
    this.pending = false
    this.flushFn = null
  }

  /** Dispose — cancel + remove from registry. */
  dispose(): void {
    this.cancel()
    liveQueues.delete(this)
  }

  private async trigger(): Promise<void> {
    this.timer = null
    if (!this.pending || !this.flushFn) return
    const fn = this.flushFn
    this.flushFn = null
    this.pending = false
    await fn()
  }
}

/** For tests: cancel all pending writes system-wide. */
export function __cancelAllQueues(): void {
  for (const q of liveQueues) q.cancel()
  liveQueues.clear()
}
