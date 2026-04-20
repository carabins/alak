// Runtime observation tools — talk directly to a self-hosted Logi HTTP API.
//
// We intentionally avoid routing through Logi's own MCP server (no double-proxy).
// Each tool makes 1–2 HTTP calls, then reshapes the raw Event list into alaq-
// specific semantics (atoms, traces, idb stores). All tools return structured
// JSON with `ok: boolean` — network / HTTP failures become `{ok: false}`, never
// thrown errors (the MCP server's try/catch is the last line of defence).
//
// Logi endpoints used (verified against logi-core/src/main.rs @ this commit):
//   GET /health                                           — liveness probe
//   GET /api/projects                                     — project list
//   GET /api/events/recent?project=<slug>&limit=N         — tail of events
//   GET /api/events/search?project=<slug>&q=<str>&since=<ISO>&until=<ISO>&kind=<e>&level=<l>&limit=N
//                                                         — message ILIKE '%q%' + filters
//   GET /api/stats?project=<slug>&since_hours=N           — aggregate stats
//   GET /api/trace/<trace_id>?project=<slug>              — events in a trace
//
// `q` is a substring match on `message` (not fingerprint). Fingerprint filtering
// therefore happens client-side after we fetch a wider window. `events/search`
// caps limit at 1000 server-side.

export interface LogiEvent {
  ts: string
  project_id: string
  service: string
  environment: string
  host: string
  kind: string           // 'error' | 'log' | 'span' | 'metric' | 'event'
  level: string
  trace_id: string
  span_id: string
  parent_span: string
  message: string
  fingerprint: string
  error_type: string
  error_module: string
  stack: string
  attrs: Record<string, string>
  numeric: Record<string, number>
  sdk: string
  release: string
}

interface Config {
  endpoint: string
  project: string
}

function resolveConfig(args: { endpoint?: string; project?: string }): Config {
  const env = (typeof process !== 'undefined' && process.env) ? process.env : {}
  return {
    endpoint: args.endpoint ?? env.LOGI_ENDPOINT ?? 'http://localhost:2025',
    project: args.project ?? env.LOGI_PROJECT ?? 'demo',
  }
}

type Ok<T> = { ok: true } & T
type Err = { ok: false; error: string; hint?: string; details?: unknown }
type Result<T> = Ok<T> | Err

function isErr<T>(r: Result<T>): r is Err { return r.ok === false }

/**
 * Fetch JSON with graceful degradation — network failures and non-2xx responses
 * become structured `{ok:false,...}` objects rather than exceptions. Callers
 * check `isErr` and forward the error.
 */
async function fetchJson<T>(url: string): Promise<Result<T & object>> {
  let res: Response
  try {
    res = await fetch(url)
  } catch (e: any) {
    return {
      ok: false,
      error: `logi unreachable at ${originOf(url)}`,
      hint: 'is Logi running? check docker compose in A:/source/logi',
      details: e?.message ?? String(e),
    }
  }
  if (!res.ok) {
    let body: unknown = null
    try { body = await res.text() } catch { /* ignore */ }
    return {
      ok: false,
      error: `logi API returned ${res.status}`,
      details: body,
      hint: res.status === 404
        ? 'endpoint not found — Logi version may be older than expected'
        : 'see details for server response body',
    }
  }
  try {
    const data = await res.json() as T & object
    return Object.assign({ ok: true as const }, data)
  } catch (e: any) {
    return {
      ok: false,
      error: 'logi returned non-JSON response',
      details: e?.message ?? String(e),
    }
  }
}

function originOf(url: string): string {
  try { return new URL(url).origin } catch { return url }
}

/**
 * Resolve project slug → confirm it exists. Returns Err with a helpful hint
 * if the project does not exist. Used by every tool that queries events,
 * because nearly all read endpoints are project-scoped.
 *
 * `/api/projects` returns a bare JSON array, not an object, so we can't use
 * `fetchJson` (which assumes an object shape). Parse directly.
 */
async function verifyProject(cfg: Config): Promise<Result<{}>> {
  const url = `${cfg.endpoint}/api/projects`
  let projects: Array<{ id: string; slug: string; name: string }>
  try {
    const res = await fetch(url)
    if (!res.ok) {
      return {
        ok: false,
        error: `logi API returned ${res.status}`,
        hint: 'GET /api/projects failed — check Logi server logs',
      }
    }
    projects = await res.json() as any
  } catch (e: any) {
    return {
      ok: false,
      error: `logi unreachable at ${cfg.endpoint}`,
      hint: 'is Logi running? check docker compose in A:/source/logi',
      details: e?.message ?? String(e),
    }
  }
  if (!Array.isArray(projects) || !projects.find(p => p.slug === cfg.project)) {
    return {
      ok: false,
      error: `project '${cfg.project}' not found`,
      hint: 'pass project arg or set LOGI_PROJECT env; use alaq_capabilities to see available projects',
      details: { known_slugs: Array.isArray(projects) ? projects.map(p => p.slug) : [] },
    }
  }
  return { ok: true }
}

/**
 * Fetch a time-bounded event window via `/api/events/search`. Fingerprint
 * filtering is post-hoc (server-side `q` is a message ILIKE, not fingerprint).
 */
async function fetchEventsSince(
  cfg: Config,
  hours: number,
  limit: number,
  extra: { kind?: string; q?: string } = {},
): Promise<Result<{ events: LogiEvent[] }>> {
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString()
  const params = new URLSearchParams({
    project: cfg.project,
    since,
    limit: String(Math.min(Math.max(limit, 1), 1000)),
  })
  if (extra.kind) params.set('kind', extra.kind)
  if (extra.q) params.set('q', extra.q)
  const url = `${cfg.endpoint}/api/events/search?${params.toString()}`
  return fetchJson<{ events: LogiEvent[] }>(url)
}

function byFingerprint(events: LogiEvent[], fp: string): LogiEvent[] {
  return events.filter(e => e.fingerprint === fp)
}

function isIdbMessage(m: string): boolean {
  return typeof m === 'string' && m.startsWith('idb:')
}

function isTauriMessage(m: string): boolean {
  return typeof m === 'string' && m.startsWith('tauri:')
}

// ────────────────────────────────────────────────────────────────
// 1. alaq_capabilities

export interface AlaqCapabilitiesInput {
  hours?: number
  endpoint?: string
  project?: string
}

export async function alaqCapabilities(args: AlaqCapabilitiesInput = {}): Promise<any> {
  const cfg = resolveConfig(args)
  const hours = args.hours ?? 24
  const verify = await verifyProject(cfg)
  if (isErr(verify)) return verify

  // Pull a large window (capped at 1000) and classify client-side.
  const r = await fetchEventsSince(cfg, hours, 1000)
  if (isErr(r)) return r
  const events = r.events

  const idbEvents = events.filter(e => isIdbMessage(e.message))
  const tauriEvents = events.filter(e => isTauriMessage(e.message))
  // plugin-logi is "active" if ANY frames are present (it produces them all).
  const logiActive = events.length > 0

  const idbMessages = Array.from(new Set(idbEvents.map(e => e.message))).sort()

  const plugins_detected: string[] = []
  const evidence: Record<string, any> = {}
  if (logiActive) {
    plugins_detected.push('logi')
    evidence.logi = {
      frames_last_window: events.length,
      first_seen: events.length ? events[events.length - 1].ts : null,
    }
  }
  if (idbEvents.length > 0) {
    plugins_detected.push('idb')
    evidence.idb = {
      frames_last_window: idbEvents.length,
      messages_seen: idbMessages,
      first_seen: idbEvents[idbEvents.length - 1].ts,
    }
  }
  if (tauriEvents.length > 0) {
    plugins_detected.push('tauri')
    evidence.tauri = {
      frames_last_window: tauriEvents.length,
      first_seen: tauriEvents[tauriEvents.length - 1].ts,
    }
  }

  const releases = Array.from(new Set(events.map(e => e.release).filter(Boolean))).sort()

  const hint = events.length === 0
    ? `no frames in the last ${hours}h — plugin-logi may not be wired up or app has not run`
    : `detected ${plugins_detected.join(', ')} over ${events.length} frames; ${releases.length} release(s)`

  return {
    ok: true,
    project: cfg.project,
    endpoint: cfg.endpoint,
    window_hours: hours,
    plugins_detected,
    evidence,
    releases,
    hint,
  }
}

// ────────────────────────────────────────────────────────────────
// 2. alaq_trace

export interface AlaqTraceInput {
  trace_id: string
  endpoint?: string
  project?: string
}

interface TreeNode {
  type: string
  name?: string
  fingerprint?: string
  span_id?: string
  phase?: string
  duration_ms?: number
  prev_shape?: unknown
  next_shape?: unknown
  message?: string
  children: TreeNode[]
}

/**
 * Reconstruct a tree from `parent_span` links. Frames without a known parent
 * become roots. Span-pair frames (`phase=begin`/`phase=end`) collapse to a
 * single node that carries the end-frame's `duration_ms`.
 */
function buildSemanticTree(events: LogiEvent[]): TreeNode[] {
  // Index by span_id for parent lookups.
  const bySpan = new Map<string, LogiEvent[]>()
  for (const e of events) {
    const arr = bySpan.get(e.span_id) ?? []
    arr.push(e)
    bySpan.set(e.span_id, arr)
  }

  // Build one node per unique span_id (collapsing begin/end pairs).
  const nodes = new Map<string, TreeNode>()
  for (const [span_id, frames] of bySpan) {
    // Prefer a begin frame as the "anchor" of the span; if absent use first.
    const begin = frames.find(f => f.attrs?.phase === 'begin') ?? frames[0]
    const end = frames.find(f => f.attrs?.phase === 'end')
    const duration = end?.numeric?.duration_ms ?? begin?.numeric?.duration_ms
    const kind = begin.kind
    const type =
      kind === 'span' ? 'action' :
      kind === 'error' ? 'error' :
      begin.attrs?.phase ? 'action' : 'change'

    nodes.set(span_id, {
      type,
      name: begin.fingerprint,
      fingerprint: begin.fingerprint,
      span_id,
      phase: begin.attrs?.phase,
      duration_ms: typeof duration === 'number' ? duration : undefined,
      prev_shape: parseShape(begin.attrs?.prev_shape),
      next_shape: parseShape(begin.attrs?.next_shape),
      message: begin.message,
      children: [],
    })
  }

  // Wire up parent → child.
  const roots: TreeNode[] = []
  for (const ev of events) {
    // Only process first frame per span for linkage.
    const node = nodes.get(ev.span_id)
    if (!node) continue
    if (ev.parent_span && nodes.has(ev.parent_span)) {
      const parent = nodes.get(ev.parent_span)!
      if (!parent.children.includes(node) && parent !== node) {
        parent.children.push(node)
      }
    }
  }
  for (const [span_id, node] of nodes) {
    // A node is a root if its parent_span is missing or unknown in this trace.
    const anyFrame = bySpan.get(span_id)![0]
    if (!anyFrame.parent_span || !nodes.has(anyFrame.parent_span)) {
      roots.push(node)
    }
  }
  return roots
}

function parseShape(s: string | undefined): unknown {
  if (!s) return undefined
  try { return JSON.parse(s) } catch { return s }
}

export async function alaqTrace(args: AlaqTraceInput): Promise<any> {
  if (!args?.trace_id || typeof args.trace_id !== 'string') {
    return { ok: false, error: 'alaq_trace: "trace_id" is required' }
  }
  const cfg = resolveConfig(args)
  const verify = await verifyProject(cfg)
  if (isErr(verify)) return verify

  const url = `${cfg.endpoint}/api/trace/${encodeURIComponent(args.trace_id)}?project=${encodeURIComponent(cfg.project)}`
  const r = await fetchJson<{ events: LogiEvent[] }>(url)
  if (isErr(r)) return r
  const events = r.events

  if (events.length === 0) {
    return {
      ok: true,
      trace_id: args.trace_id,
      release: null,
      span_count: 0,
      duration_ms: 0,
      summary: 'no events with this trace_id in Logi',
      frames: [],
      semantic_tree: [],
    }
  }

  const semantic_tree = buildSemanticTree(events)

  // Span count = unique span_id values.
  const spans = new Set(events.map(e => e.span_id))

  // Trace duration: latest ts − earliest ts in ms.
  const sortedTs = events.map(e => Date.parse(e.ts)).filter(n => !Number.isNaN(n)).sort((a, b) => a - b)
  const duration_ms = sortedTs.length >= 2 ? sortedTs[sortedTs.length - 1] - sortedTs[0] : 0

  // Summary: look for an action root, report what it touched.
  const firstAction = semantic_tree.find(n => n.type === 'action')
  const changes = events.filter(e => !e.attrs?.phase).map(e => e.fingerprint)
  let summary: string
  if (firstAction) {
    const touched = Array.from(new Set(changes))
    summary = `action '${firstAction.fingerprint ?? 'unknown'}' touched ${touched.length} atom(s)${touched.length ? `: ${touched.slice(0, 3).join(', ')}${touched.length > 3 ? '…' : ''}` : ''}`
  } else {
    summary = `${events.length} frame(s) across ${spans.size} span(s), no action root`
  }

  return {
    ok: true,
    trace_id: args.trace_id,
    release: events[0].release || null,
    span_count: spans.size,
    duration_ms,
    summary,
    frames: events,
    semantic_tree,
  }
}

// ────────────────────────────────────────────────────────────────
// 3. alaq_atom_activity

export interface AlaqAtomActivityInput {
  fingerprint: string
  hours?: number
  limit?: number
  endpoint?: string
  project?: string
}

export async function alaqAtomActivity(args: AlaqAtomActivityInput): Promise<any> {
  if (!args?.fingerprint || typeof args.fingerprint !== 'string') {
    return { ok: false, error: 'alaq_atom_activity: "fingerprint" is required' }
  }
  const cfg = resolveConfig(args)
  const verify = await verifyProject(cfg)
  if (isErr(verify)) return verify
  const hours = args.hours ?? 1
  const limit = args.limit ?? 100

  // Fingerprint isn't a search filter, so pull a wide window then filter.
  const r = await fetchEventsSince(cfg, hours, 1000)
  if (isErr(r)) return r
  const events = byFingerprint(r.events, args.fingerprint)

  const errors = events.filter(e => e.kind === 'error').length
  const mutations = events.filter(e => !e.attrs?.phase && e.kind !== 'error').length

  const transitions = new Map<string, number>()
  for (const e of events) {
    const prev = normShape(e.attrs?.prev_shape)
    const next = normShape(e.attrs?.next_shape)
    if (!prev && !next) continue
    const key = `${prev ?? 'none'}→${next ?? 'none'}`
    transitions.set(key, (transitions.get(key) ?? 0) + 1)
  }
  const shape_transitions = Array.from(transitions.entries()).map(([k, count]) => {
    const [from, to] = k.split('→')
    return { from, to, count }
  })

  // events come sorted DESC by ts; slice first `limit` for recent.
  const recent_frames = events.slice(0, limit)

  const tsList = events.map(e => Date.parse(e.ts)).filter(n => !Number.isNaN(n)).sort((a, b) => a - b)
  const first_seen = tsList.length ? new Date(tsList[0]).toISOString() : null
  const last_seen = tsList.length ? new Date(tsList[tsList.length - 1]).toISOString() : null

  return {
    ok: true,
    fingerprint: args.fingerprint,
    window_hours: hours,
    total_frames: events.length,
    mutations,
    errors,
    shape_transitions,
    recent_frames,
    first_seen,
    last_seen,
  }
}

/**
 * Collapse a JSON-stringified ValueShape to a compact label used as a key in
 * shape-transition histograms. Returns null for undefined/invalid input.
 */
function normShape(s: string | undefined): string | null {
  if (!s) return null
  try {
    const o = JSON.parse(s)
    if (o?.t === 'primitive') return `primitive:${o.kind}`
    if (o?.t === 'array') return `array:len=${o.len}`
    if (o?.t === 'object') return `object:keys=${o.keys}`
    if (o?.t) return String(o.t)
    return 'unknown'
  } catch {
    return 'unparseable'
  }
}

// ────────────────────────────────────────────────────────────────
// 4. alaq_hot_atoms

export interface AlaqHotAtomsInput {
  hours?: number
  limit?: number
  endpoint?: string
  project?: string
}

export async function alaqHotAtoms(args: AlaqHotAtomsInput = {}): Promise<any> {
  const cfg = resolveConfig(args)
  const verify = await verifyProject(cfg)
  if (isErr(verify)) return verify
  const hours = args.hours ?? 1
  const limit = args.limit ?? 10

  const r = await fetchEventsSince(cfg, hours, 1000)
  if (isErr(r)) return r

  const byFp = new Map<string, { writes: number; errors: number }>()
  for (const e of r.events) {
    if (!e.fingerprint) continue
    const cur = byFp.get(e.fingerprint) ?? { writes: 0, errors: 0 }
    if (e.kind === 'error') cur.errors++
    // Only non-span-boundary frames count as "writes" (action boundaries are
    // not mutations; they wrap mutations).
    else if (!e.attrs?.phase) cur.writes++
    byFp.set(e.fingerprint, cur)
  }

  const hot_atoms = Array.from(byFp.entries())
    .map(([fingerprint, v]) => ({ fingerprint, writes: v.writes, errors: v.errors }))
    .sort((a, b) => b.writes - a.writes || b.errors - a.errors)
    .slice(0, limit)

  return {
    ok: true,
    window_hours: hours,
    hot_atoms,
  }
}

// ────────────────────────────────────────────────────────────────
// 5. alaq_idb_stores

export interface AlaqIdbStoresInput {
  hours?: number
  endpoint?: string
  project?: string
}

export async function alaqIdbStores(args: AlaqIdbStoresInput = {}): Promise<any> {
  const cfg = resolveConfig(args)
  const verify = await verifyProject(cfg)
  if (isErr(verify)) return verify
  const hours = args.hours ?? 24

  // Fetch all events in window then filter client-side to idb:* messages.
  // Using `q=idb:` would narrow this server-side but produces false positives
  // if user messages also contain "idb:". Client-side filter is safer.
  const r = await fetchEventsSince(cfg, hours, 1000)
  if (isErr(r)) return r
  const idbEvents = r.events.filter(e => isIdbMessage(e.message))

  // Group by fingerprint.
  const byFp = new Map<string, {
    total_ops: number
    errors: number
    has_op_count: boolean
    last_activity: string
    messages: Set<string>
  }>()
  for (const e of idbEvents) {
    const cur = byFp.get(e.fingerprint) ?? {
      total_ops: 0, errors: 0, has_op_count: false, last_activity: '', messages: new Set<string>(),
    }
    cur.total_ops++
    cur.messages.add(e.message)
    if (e.kind === 'error') cur.errors++
    // numeric.op_count is present only on collection put batches.
    if (typeof e.numeric?.op_count === 'number') cur.has_op_count = true
    if (!cur.last_activity || e.ts > cur.last_activity) cur.last_activity = e.ts
    byFp.set(e.fingerprint, cur)
  }

  const stores = Array.from(byFp.entries()).map(([fingerprint, v]) => ({
    fingerprint,
    // "collection" if any op_count attribute seen; else "kv" if only idb:open
    // means we can't tell → unknown. Heuristic (brief says it's not strict).
    mode: v.has_op_count ? 'collection' : (v.messages.size > 1 ? 'kv' : 'unknown'),
    total_ops: v.total_ops,
    errors: v.errors,
    last_activity: v.last_activity,
  })).sort((a, b) => b.total_ops - a.total_ops)

  return { ok: true, stores, window_hours: hours }
}

// ────────────────────────────────────────────────────────────────
// 6. alaq_idb_store_stats

export interface AlaqIdbStoreStatsInput {
  fingerprint: string
  hours?: number
  endpoint?: string
  project?: string
}

export async function alaqIdbStoreStats(args: AlaqIdbStoreStatsInput): Promise<any> {
  if (!args?.fingerprint || typeof args.fingerprint !== 'string') {
    return { ok: false, error: 'alaq_idb_store_stats: "fingerprint" is required' }
  }
  const cfg = resolveConfig(args)
  const verify = await verifyProject(cfg)
  if (isErr(verify)) return verify
  const hours = args.hours ?? 24

  const r = await fetchEventsSince(cfg, hours, 1000)
  if (isErr(r)) return r
  const events = byFingerprint(r.events, args.fingerprint).filter(e => isIdbMessage(e.message))

  let opens = 0, hits = 0, misses = 0, putCount = 0, putErrors = 0
  let putDurationSum = 0, putDurationSamples = 0
  const errors: Array<{ ts: string; message: string; error_type: string }> = []

  for (const e of events) {
    const msg = e.message
    if (msg === 'idb:open') opens++
    else if (msg === 'idb:get:hit') hits++
    else if (msg === 'idb:get:miss') misses++
    else if (msg === 'idb:put:end') {
      putCount++
      const d = e.numeric?.duration_ms
      if (typeof d === 'number') { putDurationSum += d; putDurationSamples++ }
    } else if (e.kind === 'error' && msg.startsWith('idb:')) {
      putErrors++
      errors.push({
        ts: e.ts,
        message: msg,
        error_type: e.error_type || e.attrs?.error_type || '',
      })
    }
  }

  return {
    ok: true,
    fingerprint: args.fingerprint,
    window_hours: hours,
    operations: {
      opens,
      gets: { hits, misses },
      puts: {
        count: putCount,
        errors: putErrors,
        avg_duration_ms: putDurationSamples > 0
          ? Math.round((putDurationSum / putDurationSamples) * 100) / 100
          : null,
      },
    },
    errors,
  }
}

// ────────────────────────────────────────────────────────────────
// 7. alaq_idb_errors

export interface AlaqIdbErrorsInput {
  hours?: number
  limit?: number
  endpoint?: string
  project?: string
}

export async function alaqIdbErrors(args: AlaqIdbErrorsInput = {}): Promise<any> {
  const cfg = resolveConfig(args)
  const verify = await verifyProject(cfg)
  if (isErr(verify)) return verify
  const hours = args.hours ?? 24
  const limit = args.limit ?? 20

  const r = await fetchEventsSince(cfg, hours, 1000, { kind: 'error' })
  if (isErr(r)) return r
  const errs = r.events.filter(e => isIdbMessage(e.message)).slice(0, limit)

  return {
    ok: true,
    window_hours: hours,
    errors: errs.map(e => ({
      ts: e.ts,
      fingerprint: e.fingerprint,
      error_type: e.error_type || e.attrs?.error_type || '',
      message: e.message,
      release: e.release,
      trace_id: e.trace_id,
    })),
  }
}
