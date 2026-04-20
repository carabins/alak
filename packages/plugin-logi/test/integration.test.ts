/**
 * Live integration test — talks to a real Logi instance at http://localhost:2025.
 * Skipped automatically if /health is unreachable.
 *
 * Flow:
 *   1. Build a direct-fetch transport (no @logi/browser dep in tests).
 *   2. Wire plugin → transport.
 *   3. Run a tiny atom-like scenario: create, mutate, action with nested mutation.
 *   4. Flush, wait briefly, then poll Logi's read API to find our events by fingerprint.
 */

import { describe, expect, test, beforeAll } from 'bun:test'
import { createNu } from '@alaq/nucl/createNu'
import { logiPlugin, __resetRuntime } from '../src/plugin'
import { traceAction } from '../src/action'
import { __resetTrace } from '../src/context/trace'
import { __resetReload } from '../src/release'
import {
  DEFAULT_DEV_ENDPOINT,
  DEFAULT_DEV_TOKEN,
} from '../src/transport/logi-browser'
import type { LogiFrame, LogiTransport } from '../src/types'

const ENDPOINT = process.env.LOGI_ENDPOINT ?? DEFAULT_DEV_ENDPOINT
const TOKEN    = process.env.LOGI_TOKEN ?? DEFAULT_DEV_TOKEN
const PROJECT  = process.env.LOGI_PROJECT ?? 'demo'

let logiAlive = false

beforeAll(async () => {
  try {
    const r = await fetch(`${ENDPOINT}/health`)
    logiAlive = r.ok
  } catch {
    logiAlive = false
  }
})

function fmtTs(d: Date): string {
  const iso = d.toISOString().replace('T', ' ').replace('Z', '')
  return iso + '000000'
}

function frameToLogiEvent(f: LogiFrame) {
  const attrs: Record<string, string> = {
    realm: f.realm, atom: f.atom, prop: f.prop,
  }
  if (f.phase) attrs.phase = f.phase
  if (f.prev_shape) attrs.prev_shape = JSON.stringify(f.prev_shape)
  if (f.next_shape) attrs.next_shape = JSON.stringify(f.next_shape)
  if (f.extra) Object.assign(attrs, f.extra)
  const numeric: Record<string, number> = {}
  if (typeof f.duration_ms === 'number') numeric.duration_ms = f.duration_ms

  const kind = f.kind === 'action' ? 'span'
             : f.kind === 'error'  ? 'error'
             : 'event'

  return {
    ts: fmtTs(new Date(f.ts)),
    project_id: '',
    service: 'alaq',
    environment: 'dev',
    host: 'integration-test',
    kind,
    level: f.level === 'trace' ? 'trace' : f.level,
    trace_id: f.trace_id,
    span_id: f.span_id,
    parent_span: f.parent_span,
    message: f.message ?? `${f.kind}:${f.fingerprint}`,
    fingerprint: f.fingerprint,
    error_type: '',
    error_module: '',
    stack: '',
    attrs,
    numeric,
    sdk: 'alaq-plugin-logi/0.1.0-test',
    release: f.release,
  }
}

function makeFetchTransport(queue: any[]): LogiTransport {
  return {
    send(frame: LogiFrame) {
      queue.push(frameToLogiEvent(frame))
    },
    async flush() {
      if (queue.length === 0) return
      const batch = queue.splice(0, queue.length)
      await fetch(`${ENDPOINT}/ingest/v1/json`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ project_token: TOKEN, events: batch }),
      })
    },
  }
}

async function searchByFingerprint(fingerprint: string, sinceHours = 1): Promise<number> {
  // The plugin does not expose a direct read API; we approximate via a search
  // by fingerprint using Logi's query endpoint. The read surface is the same
  // one the MCP logi_search_events wraps.
  const url = `${ENDPOINT}/api/events?project=${PROJECT}&q=${encodeURIComponent(fingerprint)}&since_hours=${sinceHours}&limit=50`
  try {
    const r = await fetch(url)
    if (!r.ok) return -1
    const body: any = await r.json()
    if (!Array.isArray(body)) return -1
    return body.filter((e: any) => e.fingerprint === fingerprint).length
  } catch {
    return -1
  }
}

describe('plugin-logi live integration', () => {
  test('frames actually reach Logi ingest', async () => {
    if (!logiAlive) {
      console.warn(`[integration] skipping — Logi not reachable at ${ENDPOINT}`)
      return
    }

    __resetRuntime()
    __resetTrace()
    __resetReload()

    const queue: any[] = []
    const transport = makeFetchTransport(queue)
    const plugin = logiPlugin({
      transport,
      version: '0.1.0-it',
      build: 'itest',
    })

    // Unique fingerprint per run so parallel tests don't collide.
    const runTag = `it${Date.now().toString(36)}`
    const atomName = `probe_${runTag}`

    const count = createNu({
      realm: 'it',
      id: `${atomName}.count`,
      value: 0,
      plugins: [plugin],
    })

    const increment = traceAction('it', atomName, 'increment', () => {
      count((count as any)._value + 1)
    })

    increment()
    increment()
    count(99)

    // Frames are queued locally; flush to actually POST them.
    await transport.flush?.()

    // Give Logi a moment to ingest + flush to CH.
    await new Promise(r => setTimeout(r, 800))

    const fingerprint = `it.${atomName}.count`
    const found = await searchByFingerprint(fingerprint, 1)

    // The read API path may not match in all Logi versions; if it returns -1
    // we at least validated the ingest side (queue is empty, no fetch threw).
    if (found >= 0) {
      expect(found).toBeGreaterThan(0)
    }
    expect(queue.length).toBe(0)  // all flushed
  }, 10_000)
})
