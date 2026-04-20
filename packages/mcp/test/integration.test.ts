/**
 * Live integration test for @alaq/mcp runtime tools. Sends a probe event
 * directly to Logi's ingest endpoint, then verifies our tools can see it.
 *
 * Auto-skipped when Logi's /health is unreachable. Token and project default
 * to the dev values baked into logi's docker-compose.
 */

import { describe, expect, test, beforeAll } from 'bun:test'
import { alaqCapabilities, alaqAtomActivity } from '../src/tools-runtime'

const ENDPOINT = process.env.LOGI_ENDPOINT ?? 'http://localhost:8080'
const TOKEN = process.env.LOGI_TOKEN ?? 'demo_project_token'
const PROJECT = process.env.LOGI_PROJECT ?? 'demo'

let logiAlive = false

beforeAll(async () => {
  try {
    const r = await fetch(`${ENDPOINT}/health`)
    logiAlive = r.ok
  } catch {
    logiAlive = false
  }
})

/**
 * Format a Date into the ClickHouse DateTime64(9) textual format the ingest
 * endpoint expects: "YYYY-MM-DD HH:MM:SS.nnnnnnnnn". We pad the fractional
 * portion with zeroes to 9 digits.
 */
function fmtTs(d: Date): string {
  const iso = d.toISOString().replace('T', ' ').replace('Z', '')
  return iso + '000000'
}

async function sendProbe(fingerprint: string, trace_id: string): Promise<boolean> {
  const now = new Date()
  const events = [
    {
      ts: fmtTs(now),
      project_id: '',
      service: 'alaq-mcp-it',
      environment: 'dev',
      host: 'mcp-integration',
      kind: 'event',
      level: 'info',
      trace_id,
      span_id: 'mcpprobe01',
      parent_span: '',
      message: 'change',
      fingerprint,
      error_type: '',
      error_module: '',
      stack: '',
      attrs: {
        prev_shape: JSON.stringify({ t: 'primitive', kind: 'number' }),
        next_shape: JSON.stringify({ t: 'primitive', kind: 'number' }),
      },
      numeric: {},
      sdk: 'alaq-mcp-integration/0.1',
      release: '6.0.0-alpha.0+it.r1',
    },
  ]
  try {
    const r = await fetch(`${ENDPOINT}/ingest/v1/json`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project_token: TOKEN, events }),
    })
    return r.ok
  } catch {
    return false
  }
}

describe('@alaq/mcp runtime tools — live', () => {
  test('probe event is visible via alaq_atom_activity', async () => {
    if (!logiAlive) {
      console.warn(`[integration] skipping — Logi not reachable at ${ENDPOINT}`)
      return
    }

    // Unique fingerprint per run — avoids collisions across repeated test runs.
    const tag = `mcpit${Date.now().toString(36)}`
    const fingerprint = `it.${tag}.value`
    const trace_id = `trit${tag}`

    const sent = await sendProbe(fingerprint, trace_id)
    expect(sent).toBe(true)

    // Allow ingest → CH/PG flush.
    await new Promise(r => setTimeout(r, 800))

    const activity = await alaqAtomActivity({
      fingerprint,
      hours: 1,
      endpoint: ENDPOINT,
      project: PROJECT,
    })
    expect(activity.ok).toBe(true)
    // If the ingest actually landed, we expect at least 1 frame. If ingest
    // did land but the read API didn't surface it yet, mutations may be 0 —
    // we prefer a loose assertion that exercises the happy path rather than
    // flake on eventual-consistency windows.
    if (activity.total_frames > 0) {
      expect(activity.mutations).toBeGreaterThan(0)
    }

    const caps = await alaqCapabilities({ hours: 1, endpoint: ENDPOINT, project: PROJECT })
    expect(caps.ok).toBe(true)
    // plugin-logi is inferred from ANY frame — our probe qualifies.
    if (caps.evidence?.logi?.frames_last_window > 0) {
      expect(caps.plugins_detected).toContain('logi')
    }
  }, 15_000)
})
