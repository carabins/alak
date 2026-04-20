/**
 * Synchronous trace context.
 *
 * A trace is opened when an atom action is invoked; every nucl mutation
 * inside that action inherits the action's `trace_id`, so the AI can
 * pull a causal chain via `logi_get_trace`.
 *
 * We use a module-level stack (sync). Works in both browser and Node for
 * synchronous code paths. Async boundaries inside actions need explicit
 * `withTrace(trace, fn)` wrapping — the quark/nucl reactive model is
 * synchronous by default, so the common case is covered without
 * AsyncLocalStorage overhead.
 *
 * Why not AsyncLocalStorage: (1) browser target, (2) adds Node-only dep,
 * (3) the hot path here is sync mutation. When users explicitly go async
 * inside an action, they call `withTrace` — explicit is better than
 * surprising AsyncLocalStorage behavior.
 */

export interface TraceFrame {
  trace_id: string
  span_id: string
  parent_span: string
  started_at: number
}

const stack: TraceFrame[] = []

/** 12-char base36 id — enough uniqueness for a browser session. */
function mkId(): string {
  return (
    Date.now().toString(36).slice(-6) +
    Math.random().toString(36).slice(2, 8)
  )
}

export function current(): TraceFrame | undefined {
  return stack[stack.length - 1]
}

export function beginSpan(): TraceFrame {
  const parent = current()
  const frame: TraceFrame = {
    trace_id: parent ? parent.trace_id : mkId(),
    span_id: mkId(),
    parent_span: parent ? parent.span_id : '',
    started_at: Date.now(),
  }
  stack.push(frame)
  return frame
}

export function endSpan(expected?: TraceFrame): TraceFrame | undefined {
  if (expected && stack[stack.length - 1] !== expected) {
    // Mismatch — likely async leak. Don't unwind blindly; drop stale frames
    // up to and including `expected`, or leave it if not found.
    const idx = stack.lastIndexOf(expected)
    if (idx >= 0) stack.splice(idx, 1)
    return expected
  }
  return stack.pop()
}

/** Run `fn` inside an explicit trace span. Used for async continuations. */
export function withTrace<T>(frame: TraceFrame, fn: () => T): T {
  stack.push(frame)
  try {
    return fn()
  } finally {
    endSpan(frame)
  }
}

/** For tests. */
export function __resetTrace(): void {
  stack.length = 0
}
