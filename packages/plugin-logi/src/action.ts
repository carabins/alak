/**
 * Wrap an atom action to open a trace span. Every nucl mutation inside
 * the action will inherit `trace_id`. Emits two frames:
 *   - kind: 'action', phase: 'begin'
 *   - kind: 'action', phase: 'end', duration_ms
 *
 * Usage: the atom factory calls this via a plugin hook (`onMethod`).
 * Standalone users can also wrap manually:
 *
 *   const increment = traceAction('app', 'counter', 'increment', () => {
 *     count(count.value + 1)
 *   })
 */

import { beginSpan, endSpan, type TraceFrame } from './context/trace'
import { emitFrame } from './plugin'
import { shapesOf } from './shape'
import { __getRuntime } from './plugin'

export function traceAction<F extends (...args: any[]) => any>(
  realm: string,
  atom: string,
  action: string,
  fn: F,
): F {
  return function traced(this: unknown, ...args: unknown[]) {
    const span = beginSpan()
    emitFrame({
      kind: 'action',
      realm,
      atom,
      prop: action,
      phase: 'begin',
      trace_id: span.trace_id,
      span_id: span.span_id,
      parent_span: span.parent_span,
      args_shape: shapesOf(args),
      args_value: captureArgs(args),
      message: `action:begin ${atom}.${action}`,
    })

    let threw: unknown = null
    try {
      const out = fn.apply(this, args)
      if (isPromiseLike(out)) {
        return out.then(
          (v) => { finishSpan(span, realm, atom, action, null); return v },
          (e) => { finishSpan(span, realm, atom, action, e); throw e },
        )
      }
      return out
    } catch (e) {
      threw = e
      throw e
    } finally {
      if (!isPromiseLike(undefined)) {
        // Sync finish (promise path handled above).
        if (!threw) finishSpan(span, realm, atom, action, null)
        else       finishSpan(span, realm, atom, action, threw)
      }
    }
  } as F
}

function finishSpan(span: TraceFrame, realm: string, atom: string, action: string, err: unknown | null): void {
  endSpan(span)
  const duration_ms = Date.now() - span.started_at
  if (err) {
    emitFrame({
      kind: 'error',
      realm, atom, prop: action,
      trace_id: span.trace_id,
      span_id: span.span_id,
      parent_span: span.parent_span,
      duration_ms,
      message: `action:error ${atom}.${action}: ${describeError(err)}`,
      extra: { error: describeError(err) },
    })
  }
  emitFrame({
    kind: 'action',
    realm, atom, prop: action,
    phase: 'end',
    trace_id: span.trace_id,
    span_id: span.span_id,
    parent_span: span.parent_span,
    duration_ms,
    message: `action:end ${atom}.${action} (${duration_ms}ms)`,
  })
}

function captureArgs(args: unknown[]): unknown[] | undefined {
  const rt = __getRuntime()
  if (!rt || !rt.config.debugValues) return undefined
  return args
}

function isPromiseLike(x: unknown): x is PromiseLike<unknown> {
  return !!x && typeof (x as { then?: unknown }).then === 'function'
}

function describeError(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`
  try { return String(e) } catch { return 'unknown error' }
}
