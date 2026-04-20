/**
 * Unit tests for runtime observation tools. All tests mock `globalThis.fetch`
 * so nothing talks to a real Logi server. The integration counterpart lives
 * in `test/integration.test.ts` and is auto-skipped if Logi is absent.
 *
 * We set LOGI_PROJECT=demo in the env (via test-time assignment) so tools pick
 * up a consistent default for paths that don't pass `project` explicitly.
 */

import { test, expect, describe, beforeEach, afterEach } from 'bun:test'
import {
  alaqCapabilities,
  alaqTrace,
  alaqAtomActivity,
  alaqHotAtoms,
  alaqIdbStores,
  alaqIdbStoreStats,
  alaqIdbErrors,
  type LogiEvent,
} from '../src/tools-runtime'

// ───── Mock plumbing ────────────────────────────────────────────

type FetchHandler = (url: string) => Response | Promise<Response>
let currentHandler: FetchHandler | null = null
const realFetch = globalThis.fetch

function installFetch(handler: FetchHandler) {
  currentHandler = handler
  globalThis.fetch = (async (input: any) => {
    const url = typeof input === 'string' ? input : input.url
    if (!currentHandler) throw new Error('no handler installed')
    return currentHandler(url)
  }) as any
}

function restoreFetch() {
  currentHandler = null
  globalThis.fetch = realFetch
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const PROJECTS = [{ id: 'pid-1', slug: 'demo', name: 'Demo' }]

function mkEvent(e: Partial<LogiEvent>): LogiEvent {
  return {
    ts: e.ts ?? '2026-04-19T00:00:00.000000Z',
    project_id: 'pid-1',
    service: 'alaq',
    environment: 'dev',
    host: 'h',
    kind: e.kind ?? 'event',
    level: e.level ?? 'info',
    trace_id: e.trace_id ?? 'trace-x',
    span_id: e.span_id ?? 'span-x',
    parent_span: e.parent_span ?? '',
    message: e.message ?? 'msg',
    fingerprint: e.fingerprint ?? 'app.a.p',
    error_type: e.error_type ?? '',
    error_module: '',
    stack: '',
    attrs: e.attrs ?? {},
    numeric: e.numeric ?? {},
    sdk: 'test',
    release: e.release ?? '0.1.0+test.r1',
  }
}

/**
 * Build a handler that responds to /api/projects and /api/events/search
 * with the given event list. Unrelated URLs trigger an assertion failure.
 */
function eventsHandler(events: LogiEvent[]): FetchHandler {
  return (url: string) => {
    if (url.endsWith('/api/projects')) return jsonResponse(PROJECTS)
    if (url.includes('/api/events/search')) return jsonResponse({ events })
    if (url.includes('/api/trace/')) return jsonResponse({ events })
    return new Response(`unexpected url ${url}`, { status: 500 })
  }
}

beforeEach(() => {
  // Deliberately unset so tests don't accidentally pick up a real env.
  delete (process.env as any).LOGI_ENDPOINT
  delete (process.env as any).LOGI_PROJECT
})
afterEach(() => {
  restoreFetch()
})

// ───── alaq_capabilities ────────────────────────────────────────

describe('alaq_capabilities', () => {
  test('detects plugin-logi (any frames) + plugin-idb (idb:* messages)', async () => {
    installFetch(eventsHandler([
      mkEvent({ message: 'change:app.counter.count', fingerprint: 'app.counter.count' }),
      mkEvent({ message: 'idb:open', fingerprint: 'app.settings.v' }),
      mkEvent({ message: 'idb:put:end', fingerprint: 'app.settings.v' }),
    ]))
    const r = await alaqCapabilities({ hours: 24 })
    expect(r.ok).toBe(true)
    expect(r.plugins_detected.sort()).toEqual(['idb', 'logi'])
    expect(r.evidence.idb.messages_seen).toContain('idb:open')
    expect(r.evidence.idb.messages_seen).toContain('idb:put:end')
    expect(r.releases).toContain('0.1.0+test.r1')
  })

  test('empty window → no plugins detected, helpful hint', async () => {
    installFetch(eventsHandler([]))
    const r = await alaqCapabilities({ hours: 1 })
    expect(r.ok).toBe(true)
    expect(r.plugins_detected).toEqual([])
    expect(r.hint).toMatch(/no frames/i)
  })

  test('unknown project → {ok:false}', async () => {
    installFetch(eventsHandler([]))
    const r = await alaqCapabilities({ project: 'ghost' })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/not found/)
  })

  test('logi unreachable → {ok:false, error}', async () => {
    installFetch(() => { throw new Error('ECONNREFUSED') })
    const r = await alaqCapabilities({ endpoint: 'http://127.0.0.1:1' })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/unreachable/)
  })
})

// ───── alaq_trace ───────────────────────────────────────────────

describe('alaq_trace', () => {
  test('builds semantic_tree from parent_span links', async () => {
    // action:begin (span A) → change (span B, parent A) → action:end (span A)
    const trace_id = 'tr-1'
    const frames: LogiEvent[] = [
      mkEvent({
        trace_id, span_id: 'A', parent_span: '',
        kind: 'span', fingerprint: 'app.counter.increment',
        message: 'action:begin', attrs: { phase: 'begin' },
      }),
      mkEvent({
        trace_id, span_id: 'B', parent_span: 'A',
        kind: 'event', fingerprint: 'app.counter.count',
        message: 'change',
        attrs: {
          prev_shape: '{"t":"primitive","kind":"number"}',
          next_shape: '{"t":"primitive","kind":"number"}',
        },
      }),
      mkEvent({
        trace_id, span_id: 'A', parent_span: '',
        kind: 'span', fingerprint: 'app.counter.increment',
        message: 'action:end', attrs: { phase: 'end' },
        numeric: { duration_ms: 42 },
      }),
    ]
    installFetch((url) => {
      if (url.endsWith('/api/projects')) return jsonResponse(PROJECTS)
      if (url.includes(`/api/trace/${trace_id}`)) return jsonResponse({ events: frames })
      return new Response('nope', { status: 500 })
    })
    const r = await alaqTrace({ trace_id })
    expect(r.ok).toBe(true)
    expect(r.span_count).toBe(2)          // two unique span_ids
    expect(r.semantic_tree).toHaveLength(1) // single root
    const root = r.semantic_tree[0]
    expect(root.type).toBe('action')
    expect(root.fingerprint).toBe('app.counter.increment')
    expect(root.duration_ms).toBe(42)
    expect(root.children).toHaveLength(1)
    expect(root.children[0].fingerprint).toBe('app.counter.count')
  })

  test('empty trace → ok:true with zero span_count', async () => {
    installFetch(eventsHandler([]))
    const r = await alaqTrace({ trace_id: 'nope' })
    expect(r.ok).toBe(true)
    expect(r.span_count).toBe(0)
    expect(r.semantic_tree).toEqual([])
  })

  test('missing trace_id → {ok:false}', async () => {
    installFetch(eventsHandler([]))
    const r = await alaqTrace({} as any)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/trace_id/)
  })
})

// ───── alaq_atom_activity ───────────────────────────────────────

describe('alaq_atom_activity', () => {
  test('aggregates shape_transitions and counts mutations', async () => {
    const fp = 'app.counter.count'
    installFetch(eventsHandler([
      mkEvent({
        fingerprint: fp,
        attrs: {
          prev_shape: '{"t":"primitive","kind":"number"}',
          next_shape: '{"t":"primitive","kind":"number"}',
        },
      }),
      mkEvent({
        fingerprint: fp,
        attrs: {
          prev_shape: '{"t":"primitive","kind":"number"}',
          next_shape: '{"t":"primitive","kind":"number"}',
        },
      }),
      mkEvent({
        fingerprint: fp,
        attrs: {
          prev_shape: '{"t":"primitive","kind":"number"}',
          next_shape: '{"t":"object","keys":2}',
        },
      }),
      // Other atom — should be filtered out.
      mkEvent({ fingerprint: 'app.other.x' }),
    ]))
    const r = await alaqAtomActivity({ fingerprint: fp })
    expect(r.ok).toBe(true)
    expect(r.total_frames).toBe(3)
    expect(r.mutations).toBe(3)
    // Two distinct transitions: primitive→primitive (x2), primitive→object (x1).
    const keys = r.shape_transitions.map((s: any) => `${s.from}→${s.to}:${s.count}`).sort()
    expect(keys).toEqual([
      'primitive:number→object:keys=2:1',
      'primitive:number→primitive:number:2',
    ])
  })

  test('missing fingerprint → {ok:false}', async () => {
    installFetch(eventsHandler([]))
    const r = await alaqAtomActivity({} as any)
    expect(r.ok).toBe(false)
  })
})

// ───── alaq_hot_atoms ───────────────────────────────────────────

describe('alaq_hot_atoms', () => {
  test('sorts by writes DESC', async () => {
    const ev = (fp: string, attrs: Record<string, string> = {}) =>
      mkEvent({ fingerprint: fp, attrs })
    installFetch(eventsHandler([
      ev('a.one'), ev('a.one'), ev('a.one'), ev('a.one'),
      ev('a.two'), ev('a.two'),
      ev('a.three'),
      // Action phase frames should NOT count as writes.
      ev('a.four', { phase: 'begin' }),
      ev('a.four', { phase: 'end' }),
    ]))
    const r = await alaqHotAtoms({ limit: 10 })
    expect(r.ok).toBe(true)
    expect(r.hot_atoms[0]).toEqual({ fingerprint: 'a.one', writes: 4, errors: 0 })
    expect(r.hot_atoms[1]).toEqual({ fingerprint: 'a.two', writes: 2, errors: 0 })
    // a.four's phase frames are excluded from writes.
    const four = r.hot_atoms.find((x: any) => x.fingerprint === 'a.four')
    expect(four.writes).toBe(0)
  })
})

// ───── alaq_idb_stores ──────────────────────────────────────────

describe('alaq_idb_stores', () => {
  test('filters only idb:* messages and groups by fingerprint', async () => {
    installFetch(eventsHandler([
      mkEvent({ fingerprint: 'app.settings.v', message: 'idb:open' }),
      mkEvent({ fingerprint: 'app.settings.v', message: 'idb:put:end' }),
      mkEvent({ fingerprint: 'app.todos.list', message: 'idb:open' }),
      mkEvent({
        fingerprint: 'app.todos.list',
        message: 'idb:put:end',
        numeric: { op_count: 3 },
      }),
      // Non-idb frame — excluded.
      mkEvent({ fingerprint: 'app.x.y', message: 'change' }),
    ]))
    const r = await alaqIdbStores({ hours: 24 })
    expect(r.ok).toBe(true)
    expect(r.stores.map((s: any) => s.fingerprint).sort())
      .toEqual(['app.settings.v', 'app.todos.list'])
    const todos = r.stores.find((s: any) => s.fingerprint === 'app.todos.list')
    expect(todos.mode).toBe('collection')
    const settings = r.stores.find((s: any) => s.fingerprint === 'app.settings.v')
    expect(settings.mode).toBe('kv')
  })
})

// ───── alaq_idb_store_stats ─────────────────────────────────────

describe('alaq_idb_store_stats', () => {
  test('builds operation histogram', async () => {
    const fp = 'app.settings.v'
    installFetch(eventsHandler([
      mkEvent({ fingerprint: fp, message: 'idb:open' }),
      mkEvent({ fingerprint: fp, message: 'idb:get:hit' }),
      mkEvent({ fingerprint: fp, message: 'idb:get:miss' }),
      mkEvent({ fingerprint: fp, message: 'idb:put:end', numeric: { duration_ms: 2 } }),
      mkEvent({ fingerprint: fp, message: 'idb:put:end', numeric: { duration_ms: 4 } }),
      mkEvent({
        fingerprint: fp,
        kind: 'error',
        level: 'error',
        message: 'idb:put:error',
        attrs: { error_type: 'idb:quota_exceeded' },
      }),
      // Other atom — excluded.
      mkEvent({ fingerprint: 'other', message: 'idb:put:end' }),
    ]))
    const r = await alaqIdbStoreStats({ fingerprint: fp })
    expect(r.ok).toBe(true)
    expect(r.operations.opens).toBe(1)
    expect(r.operations.gets).toEqual({ hits: 1, misses: 1 })
    expect(r.operations.puts.count).toBe(2)
    expect(r.operations.puts.avg_duration_ms).toBe(3)
    expect(r.operations.puts.errors).toBe(1)
    expect(r.errors[0].error_type).toBe('idb:quota_exceeded')
  })
})

// ───── alaq_idb_errors ──────────────────────────────────────────

describe('alaq_idb_errors', () => {
  test('filters to kind=error + idb:* messages', async () => {
    installFetch((url) => {
      if (url.endsWith('/api/projects')) return jsonResponse(PROJECTS)
      if (url.includes('/api/events/search')) {
        // Server is asked to filter by kind=error; we simulate that.
        expect(url).toContain('kind=error')
        return jsonResponse({
          events: [
            mkEvent({
              kind: 'error',
              message: 'idb:put:error',
              fingerprint: 'app.x.y',
              attrs: { error_type: 'idb:quota_exceeded' },
            }),
            mkEvent({
              kind: 'error',
              message: 'idb:get:error',
              fingerprint: 'app.x.y',
            }),
            // Non-idb error — excluded by our client-side filter.
            mkEvent({ kind: 'error', message: 'something else' }),
          ],
        })
      }
      return new Response('nope', { status: 500 })
    })
    const r = await alaqIdbErrors({ hours: 24, limit: 20 })
    expect(r.ok).toBe(true)
    expect(r.errors).toHaveLength(2)
    expect(r.errors[0].error_type).toBe('idb:quota_exceeded')
  })
})

// ───── Error handling ───────────────────────────────────────────

describe('error handling', () => {
  test('network failure returns {ok:false} — does not throw', async () => {
    installFetch(() => { throw new Error('ECONNREFUSED') })
    const r = await alaqAtomActivity({ fingerprint: 'x' })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/unreachable/)
  })

  test('HTTP 500 returns structured error', async () => {
    installFetch((url) => {
      if (url.endsWith('/api/projects')) return jsonResponse(PROJECTS)
      return new Response('boom', { status: 500 })
    })
    const r = await alaqHotAtoms({})
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/500/)
  })
})
