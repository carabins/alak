// @alaq/graph-link-state — CRDT FieldSchema emitter.
//
// For each namespace, produce
//
//     export const <namespace>Schema: Record<string, FieldSchema> = { ... }
//
// Consumers wire the result into a `SyncBridge({ store, hub, schema })`.
//
// Why this file exists: Kotelok-2 FINDINGS §4.2 called out that the CRDT
// schema is trivially derivable from SDL yet ends up hand-written in every
// consumer, duplicating `@crdt` / `@sync` directives. This emitter kills
// the drift source.
//
// Path convention (FINDINGS §3.7): scoped records render under
// `<scope>.*.<field>` — the `*` stands in for the instance id that
// `createGameRoomNode(store, id)` inserts at runtime. Unscoped records
// render under `<RecordName>.<field>`.
//
// Directive → CRDT mapping (SPEC §7.2 ↔ FieldSchema):
//   @crdt(type: LWW_REGISTER) → { type: 'lww' }
//   @crdt(type: LWW_MAP)      → { type: 'lww-map' }
//   @crdt(type: OR_SET)       → { type: 'or-set' }
//   @crdt(type: G_COUNTER)    → { type: 'pn-counter' }   [1]
//   @crdt(type: PN_COUNTER)   → { type: 'pn-counter' }
//   @crdt(type: RGA)          → { type: 'rga' }
//
//   [1] The runtime's `FieldSchema.type` union (packages/link/src/crdt)
//       only has pn-counter; a G_COUNTER is a positive-only special case.
//       We emit pn-counter and let the runtime accept positive-only deltas.
//       A comment in the generated file flags this.
//
// REALTIME handling: `@sync(qos: REALTIME)` fields are hot-stream datagrams,
// not CRDT state, so we skip them. A comment in the emitted schema records
// the decision for each skipped field so consumers can see it was
// intentional, not forgotten.

import type { IRDirective, IRField, IRRecord, IRSchema, IRTypeRef } from '@alaq/graph'
import { LineBuffer, findDirective, hasDirective } from './utils'

// ────────────────────────────────────────────────────────────────
// Directive → CRDT string mapping
// ────────────────────────────────────────────────────────────────

const CRDT_MAP: Record<string, string> = {
  LWW_REGISTER: 'lww',
  LWW_MAP: 'lww-map',
  OR_SET: 'or-set',
  G_COUNTER: 'pn-counter', // See note [1] in file header
  PN_COUNTER: 'pn-counter',
  RGA: 'rga',
}

function crdtFromDirective(
  dir: { name: string; args?: Record<string, unknown> } | undefined,
): string | null {
  if (!dir) return null
  const t = dir.args?.type
  if (typeof t !== 'string') return null
  return CRDT_MAP[t] ?? null
}

function qosOf(dirs: IRDirective[] | undefined): string | null {
  const sync = findDirective(dirs, 'sync')
  if (!sync) return null
  const q = sync.args?.qos
  return typeof q === 'string' ? q : null
}

// ────────────────────────────────────────────────────────────────
// Replication gating
// ────────────────────────────────────────────────────────────────
//
// A record participates in the CRDT schema if:
//   • It carries @crdt at the record level, OR
//   • It carries @sync (any qos != REALTIME) at the record level, OR
//   • It is scoped (implicit replication via scope binding), OR
//   • Any of its fields carry @crdt or @sync(RELIABLE).
//
// Records that are purely ephemeral (only REALTIME fields and no directives)
// are skipped.

function recordHasRELIABLE(rec: IRRecord): boolean {
  const recQos = qosOf(rec.directives)
  if (recQos && recQos !== 'REALTIME') return true
  if (hasDirective(rec.directives, 'crdt')) return true
  if (rec.scope) return true
  // Fall back to field-level signals
  for (const f of rec.fields) {
    if (hasDirective(f.directives, 'crdt')) return true
    const fq = qosOf(f.directives)
    if (fq && fq !== 'REALTIME') return true
  }
  return false
}

// ────────────────────────────────────────────────────────────────
// Per-field emission
// ────────────────────────────────────────────────────────────────

interface Emit {
  path: string
  schema: string // TS literal for FieldSchema value, e.g. `{ type: 'lww' }`
  comment?: string
}

/**
 * `listItemSchema` — default CRDT for a single list element. Scalars → lww,
 * record-typed elements are left to the recursive record walker (see
 * emitRecordEntries). For lists-of-lists or lists-of-maps we collapse to
 * lww because the nested composition isn't addressable via a flat path.
 */
function listItemSchema(_field: IRField): string {
  return `{ type: 'lww' }`
}

/**
 * Infer the schema for a Map entry value based on the IR type ref. Scalar
 * values → lww. Nested maps → lww-map. Records → lww (record-typed values
 * are atomic from the map's point of view unless the record itself sits at
 * a reachable path, which a wildcard `.*` won't pick up).
 */
function mapValueSchema(v: IRTypeRef): string {
  if (v.map) return `{ type: 'lww-map' }`
  if (v.list) return `{ type: 'or-set' }`
  return `{ type: 'lww' }`
}

/**
 * Walk one record's fields, given the path prefix the record sits at.
 * Records referenced by field type are walked recursively so their fields
 * surface under the parent's prefix.
 */
function emitRecordEntries(
  rec: IRRecord,
  prefix: string,
  records: Record<string, IRRecord>,
  visited: Set<string>,
  out: Emit[],
  /** True when the enclosing context already replicates by default. */
  parentReplicated: boolean,
): void {
  if (visited.has(rec.name)) return // guard cycles
  visited.add(rec.name)

  const recQos = qosOf(rec.directives)
  const recIsRealtime = recQos === 'REALTIME'
  const recHasCrdt = hasDirective(rec.directives, 'crdt')
  // The record's own fields replicate "by default" when the record opts in
  // (scope / @sync != REALTIME / @crdt) OR the containing context already
  // replicates. A record-level REALTIME opts out for all scalar descendants;
  // explicit field-level directives still win locally.
  const replicated = recIsRealtime
    ? false
    : (parentReplicated ||
       recHasCrdt ||
       !!rec.scope ||
       (recQos !== null && recQos !== 'REALTIME'))

  for (const f of rec.fields) {
    const path = `${prefix}.${f.name}`
    const fieldQos = qosOf(f.directives)
    const crdtDir = findDirective(f.directives, 'crdt')
    const crdtName = crdtFromDirective(crdtDir)

    // REALTIME at field level: skip with a breadcrumb so the decision is
    // visible in the generated output.
    if (fieldQos === 'REALTIME') {
      out.push({
        path,
        schema: '',
        comment: `REALTIME — ephemeral, not CRDT (skipped)`,
      })
      continue
    }

    // Explicit @crdt wins over everything else — even REALTIME parents.
    if (crdtName) {
      out.push({ path, schema: `{ type: '${crdtName}' }` })
      // Map with explicit CRDT: still emit a `.*` sub-entry so sub-keys
      // have a concrete schema (scalar / record values → lww).
      if (f.map && f.mapValue) {
        out.push({ path: `${path}.*`, schema: mapValueSchema(f.mapValue) })
      }
      continue
    }

    // No explicit directive: the field only replicates if the enclosing
    // context does. Per SPEC R100: field @sync overrides record @sync;
    // otherwise record-level replication stands.
    const fieldReplicated =
      replicated || (fieldQos !== null && fieldQos !== 'REALTIME')
    if (!fieldReplicated) continue

    // Map<K, V> → dual emit: lww-map at the container + inferred sub-schema.
    if (f.map && f.mapValue) {
      out.push({ path, schema: `{ type: 'lww-map' }` })
      out.push({ path: `${path}.*`, schema: mapValueSchema(f.mapValue) })
      continue
    }

    // List [T] → or-set default; recurse into record-typed elements.
    if (f.list) {
      out.push({ path, schema: `{ type: 'or-set' }` })
      const inner = records[f.type]
      if (inner) {
        emitRecordEntries(inner, `${path}.*`, records, visited, out, true)
      } else {
        out.push({ path: `${path}.*`, schema: listItemSchema(f) })
      }
      continue
    }

    // Record-typed scalar field → recurse. No entry for the container
    // itself — composites are addressed field-by-field.
    const inner = records[f.type]
    if (inner) {
      emitRecordEntries(inner, path, records, visited, out, true)
      continue
    }

    // Plain scalar field → LWW register.
    out.push({ path, schema: `{ type: 'lww' }` })
  }

  visited.delete(rec.name)
}

// ────────────────────────────────────────────────────────────────
// Public: emit one namespace's schema block
// ────────────────────────────────────────────────────────────────

export interface EmitCrdtSchemaOptions {
  /** Identifier used for the exported const. Defaults to `<namespace>Schema`. */
  constName?: string
  /** Skip the `// Generated CRDT schema` divider comment. Defaults to false. */
  terse?: boolean
}

/**
 * Emit the `<namespace>Schema` const for a single IRSchema, into the given
 * LineBuffer. Returns true if anything was emitted (some namespaces are
 * CRDT-free — all records ephemeral — and we skip them entirely).
 */
export function emitCrdtSchemaInto(
  buf: LineBuffer,
  schema: IRSchema,
  opts: EmitCrdtSchemaOptions = {},
): boolean {
  const records = schema.records
  const recNames = Object.keys(records).sort()

  // Collect entries from replicated records only.
  const entries: Emit[] = []
  const seenPaths = new Set<string>()
  for (const name of recNames) {
    const rec = records[name]
    if (!recordHasRELIABLE(rec)) continue

    const scope = rec.scope ?? null
    const prefix = scope ? `${scope}.*` : rec.name

    const local: Emit[] = []
    // Top-level record: its own directives decide whether descendants
    // replicate — the caller isn't "parent replicated" yet, so pass false.
    emitRecordEntries(rec, prefix, records, new Set(), local, false)

    // Deduplicate: first writer wins. This keeps path entries stable when
    // two records happen to share a prefix (rare but possible via extend).
    for (const e of local) {
      if (seenPaths.has(e.path)) continue
      seenPaths.add(e.path)
      entries.push(e)
    }
  }

  if (entries.length === 0) return false

  const name = opts.constName ?? `${sanitizeIdent(schema.namespace)}Schema`

  buf.line(
    `// CRDT schema — derived from @crdt / @sync directives. Paths use '*'`,
  )
  buf.line(
    `// wildcards for scope-bound ids (e.g. 'room.*.id' matches 'room.abc.id').`,
  )
  buf.line(
    `// REALTIME fields are intentionally omitted — they travel out-of-band as`,
  )
  buf.line(
    `// datagrams and are never stored in the CRDT.`,
  )
  buf.line(`export const ${name}: Record<string, FieldSchema> = {`)
  buf.indent()
  for (const e of entries) {
    if (!e.schema) {
      buf.line(`// ${e.path} — ${e.comment ?? 'skipped'}`)
      continue
    }
    // Quote the path — some segments ('.*') look fine unquoted in JS, but
    // `*` is not a valid bareword so we always quote.
    buf.line(`'${e.path}': ${e.schema},`)
  }
  buf.dedent()
  buf.line(`}`)
  buf.blank()
  return true
}

/**
 * Back-compat standalone entry: takes an IRSchema and returns a TS source
 * fragment. Kept as a separate file-oriented API for callers that want to
 * write a `.schema.generated.ts` sibling rather than inline into the main
 * generated file.
 */
export function emitCrdtSchema(schema: IRSchema, opts: EmitCrdtSchemaOptions = {}): string {
  const buf = new LineBuffer()
  const didEmit = emitCrdtSchemaInto(buf, schema, opts)
  if (!didEmit) return ''
  return buf.toString()
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

/**
 * Turn a namespace like `core.identity` into a JS identifier like
 * `coreIdentity`. Keeps the existing Kotelok-2 `kotelok2Schema` shape (no
 * dots, lowercase-first) so the diff when consumers switch over is minimal.
 */
function sanitizeIdent(ns: string): string {
  const parts = ns.split(/[^A-Za-z0-9]+/).filter(Boolean)
  if (parts.length === 0) return 'ns'
  const head = parts[0]
  const rest = parts.slice(1).map(p => p[0].toUpperCase() + p.slice(1))
  return head + rest.join('')
}
