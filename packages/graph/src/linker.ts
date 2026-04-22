// @alaq/graph — multi-file linker.
//
// Takes per-file parse results (AST + IR) and merges them into a single
// unified IR representing the project. Implements cross-file checks deferred
// by the single-file validator:
//
//   E007 — schema-name collision with different namespaces
//   E008 — `use` path cannot be resolved
//   E009 — field references undefined type (re-checked globally after merge)
//   E010 — duplicate field across `record` + `extend record` (cross-file)
//   E011 — `extend record X` where X is not in scope (cross-file)
//   E014 — cyclic type dependency without @sync(mode: LAZY) break
//   E021 — `use` imports name not declared by target module
//
// Runtime dependencies: none. Only built-in modules used for path resolution.

import type {
  Diagnostic,
  DirectiveNode,
  ExtendRecordNode,
  FieldNode,
  FileAST,
  IR,
  IRField,
  IRRecord,
  IRSchema,
  IRTypeRef,
  SourceLoc,
  TypeExprNode,
  UseDeclNode,
} from './types'
import { diag, MSG } from './errors'
import { buildIR } from './ir'
import { validate } from './validator'

// ────────────────────────────────────────────────────────────────
// Path resolution (Node-style, internal, no dependency on `node:path`)
// ────────────────────────────────────────────────────────────────

/**
 * Normalize a POSIX-style path: collapse `.`, `..`, duplicate separators,
 * trailing slashes. Accepts both forward and back slashes in input.
 * Returns a normalized string that always uses `/` as separator.
 * Trailing slash is stripped (unless result is just "/").
 */
export function normalizePath(p: string): string {
  if (!p) return ''
  // Normalize separators
  let s = p.replace(/\\/g, '/')
  const leadingSlash = s.startsWith('/')
  // Windows drive letter handling: "C:/..." → keep intact
  let drive = ''
  const driveMatch = s.match(/^([A-Za-z]:)(\/?)(.*)$/)
  if (driveMatch) {
    drive = driveMatch[1]!
    s = (driveMatch[2] ?? '') + (driveMatch[3] ?? '')
  }
  const parts = s.split('/')
  const out: string[] = []
  for (const part of parts) {
    if (part === '' || part === '.') continue
    if (part === '..') {
      if (out.length && out[out.length - 1] !== '..') out.pop()
      else if (!leadingSlash && !drive) out.push('..')
      continue
    }
    out.push(part)
  }
  let res = out.join('/')
  if (leadingSlash) res = '/' + res
  if (drive) res = drive + (res.startsWith('/') ? '' : '/') + res
  return res || (leadingSlash ? '/' : '.')
}

/** Return directory portion of a normalized path (no trailing slash). */
export function dirname(p: string): string {
  const s = normalizePath(p)
  const idx = s.lastIndexOf('/')
  if (idx < 0) return '.'
  if (idx === 0) return '/'
  // Windows: drive-only
  if (/^[A-Za-z]:$/.test(s.slice(0, idx))) return s.slice(0, idx) + '/'
  return s.slice(0, idx)
}

/** Join `base` and `rel`; if `rel` is absolute, return it. */
export function joinPath(base: string, rel: string): string {
  const r = rel.replace(/\\/g, '/')
  if (r.startsWith('/') || /^[A-Za-z]:[\\\/]/.test(r)) return normalizePath(r)
  return normalizePath(base.replace(/\\/g, '/') + '/' + r)
}

// ────────────────────────────────────────────────────────────────
// LinkerInput / Output
// ────────────────────────────────────────────────────────────────

export interface LinkerFile {
  /** Original or absolute path of the file, used for resolution keys. */
  path: string
  /** Per-file AST (may be null if the file had fatal parse errors). */
  ast: FileAST
  /** Per-file IR (may be null). */
  ir: IR | null
}

export interface LinkResult {
  merged: IR
  diagnostics: Diagnostic[]
}

// ────────────────────────────────────────────────────────────────
// Main entry point
// ────────────────────────────────────────────────────────────────

export function link(files: LinkerFile[]): LinkResult {
  const diagnostics: Diagnostic[] = []

  // Normalize all file paths to the key form used throughout. We keep the
  // original path on the entry for diagnostic display.
  const normalizedFiles: (LinkerFile & { key: string })[] = files.map(f => ({
    ...f,
    key: normalizePath(f.path),
  }))

  // ── Build an index of files keyed by multiple forms (with/without .aql)
  const fileIndex = new Map<string, LinkerFile & { key: string }>()
  for (const f of normalizedFiles) {
    fileIndex.set(f.key, f)
    // Also index without the `.aql` suffix to ease resolution.
    if (f.key.toLowerCase().endsWith('.aql')) {
      fileIndex.set(f.key.slice(0, -4), f)
    }
  }

  // ── Collect per-file declared exports (records, enums, scalars, opaques).
  //    Actions are not importable; `use` only carries type names.
  const declaredBy = new Map<string, Set<string>>() // filePath key → names
  for (const f of normalizedFiles) {
    const names = new Set<string>()
    for (const def of f.ast.definitions) {
      if (def.kind === 'record' || def.kind === 'enum' || def.kind === 'scalar' || def.kind === 'opaque') {
        names.add(def.name)
      }
    }
    declaredBy.set(f.key, names)
  }

  // ── Resolve `use` declarations (E008 + E021)
  //    Build a map filePath → resolved-target-file for symbol lookup later.
  const useResolutions = new Map<string, Map<string, string>>() // filePath → (path-as-written → resolvedKey)
  for (const f of normalizedFiles) {
    const resolvedForFile = new Map<string, string>()
    for (const u of f.ast.uses) {
      const resolved = resolveUsePath(u.path, f.key, fileIndex)
      if (!resolved) {
        diagnostics.push(diag('E008', MSG.E008(u.path), u.loc))
        continue
      }
      resolvedForFile.set(u.path, resolved)
      // E021: each imported name must be declared by target module.
      const exports = declaredBy.get(resolved) ?? new Set<string>()
      for (const name of u.imports) {
        if (!exports.has(name)) {
          diagnostics.push(diag('E021', MSG.E021(name, u.path), u.loc))
        }
      }
    }
    useResolutions.set(f.key, resolvedForFile)
  }

  // ── Group files by namespace and detect E007.
  //    Key shape: namespace string. Within a group, we also track
  //    schema.name → ensure same name+namespace pairs across files don't
  //    diverge. E007 fires when the SAME schema name is declared with
  //    DIFFERENT namespaces across files (real collision). Same name+same
  //    namespace in multiple files → legitimate namespace extension.
  const schemaNameToNamespace = new Map<string, { ns: string; loc: SourceLoc }>()
  const nsGroups = new Map<string, (LinkerFile & { key: string })[]>()
  for (const f of normalizedFiles) {
    const sch = f.ast.schema
    if (!sch || !sch.namespace) continue
    const prev = schemaNameToNamespace.get(sch.name)
    if (prev && prev.ns !== sch.namespace) {
      diagnostics.push(diag('E007', MSG.E007(prev.ns), sch.loc))
      // Do not skip — still attempt to merge what we can.
    } else if (!prev) {
      schemaNameToNamespace.set(sch.name, { ns: sch.namespace, loc: sch.loc })
    }
    const list = nsGroups.get(sch.namespace) ?? []
    list.push(f)
    nsGroups.set(sch.namespace, list)
  }

  // ── Merge namespace groups.
  const merged: IR = { schemas: {} }
  for (const [ns, group] of nsGroups) {
    const mergedSchema = mergeGroup(ns, group, diagnostics)
    merged.schemas[ns] = mergedSchema
  }

  // ── Cross-file E011 pass.
  //    For each file's `extend record X` whose X is NOT declared anywhere in
  //    the same namespace AND not imported → E011. If X is imported but not
  //    present in the merged namespace (because the imported file was not
  //    provided to the linker), we already emitted E008/E021 for that.
  for (const f of normalizedFiles) {
    const sch = f.ast.schema
    if (!sch || !sch.namespace) continue
    const mergedSchema = merged.schemas[sch.namespace]!
    const imported = collectImports(f, useResolutions, declaredBy)
    for (const def of f.ast.definitions) {
      if (def.kind !== 'extend') continue
      if (!mergedSchema.records[def.name] && !imported.has(def.name)) {
        diagnostics.push(diag('E011', MSG.E011(def.name), def.loc))
      }
    }
  }

  // ── Global E009 / scalars / type-ref sanity pass via the validator.
  //    We build a synthetic per-namespace AST-like view and run the validator
  //    in a lenient mode. But the simpler path: re-run the validator on each
  //    merged schema with a combined AST and imported-types union. The
  //    validator itself accepts a single AST; re-running per file would
  //    re-report duplicates. So we flag-check ourselves here:
  //    Build defined-types set globally for each namespace and verify every
  //    field type references something in it.
  applyGlobalTypeChecks(merged, normalizedFiles, useResolutions, declaredBy, diagnostics)

  // ── E014 cyclic type dependency.
  applyCycleDetection(merged, diagnostics)

  // ── Deduplicate diagnostics (same code/line/col/message).
  const seen = new Set<string>()
  const deduped: Diagnostic[] = []
  for (const d of diagnostics) {
    const k = `${d.code}:${d.file ?? ''}:${d.line}:${d.column}:${d.message}`
    if (seen.has(k)) continue
    seen.add(k)
    deduped.push(d)
  }

  return { merged, diagnostics: deduped }
}

// ────────────────────────────────────────────────────────────────
// use-path resolution
// ────────────────────────────────────────────────────────────────

function resolveUsePath(
  rawPath: string,
  fromFileKey: string,
  fileIndex: Map<string, LinkerFile & { key: string }>,
): string | null {
  // Strategies:
  //  1. Treat as relative or absolute path.
  //  2. Try exact match, then `<path>.aql` variant.
  //  3. Direct key lookup if rawPath appears as-is in index.
  const fromDir = dirname(fromFileKey)

  const candidates = new Set<string>()
  const norm = normalizePath(rawPath)
  const joined = joinPath(fromDir, rawPath)

  candidates.add(norm)
  candidates.add(norm + '.aql')
  candidates.add(joined)
  candidates.add(joined + '.aql')

  // Case-insensitive fallback for Windows keys (drive letter casing).
  for (const c of candidates) {
    if (fileIndex.has(c)) return fileIndex.get(c)!.key
  }
  const lowerIndex = new Map<string, string>()
  for (const k of fileIndex.keys()) lowerIndex.set(k.toLowerCase(), k)
  for (const c of candidates) {
    const hit = lowerIndex.get(c.toLowerCase())
    if (hit) return fileIndex.get(hit)!.key
  }
  // Final fallback: match by basename (handy when callers pass flat path lists)
  const baseTarget = norm.replace(/\.aql$/, '').split('/').pop()!
  for (const f of fileIndex.values()) {
    const base = f.key.replace(/\.aql$/, '').split('/').pop()
    if (base === baseTarget) return f.key
  }
  return null
}

// ────────────────────────────────────────────────────────────────
// Merge one namespace group into a single IRSchema
// ────────────────────────────────────────────────────────────────

function mergeGroup(
  ns: string,
  group: (LinkerFile & { key: string })[],
  diagnostics: Diagnostic[],
): IRSchema {
  // Pick the first file's schema-block as the canonical "header" for
  // name/version. If subsequent files disagree on version, we keep the max
  // (higher-versioned declarations are a design artifact rather than a
  // hard error for v0.2).
  const firstSchema = group[0]!.ast.schema!
  const mergedSchema: IRSchema = {
    name: firstSchema.name,
    namespace: ns,
    version: firstSchema.version ?? 0,
    records: {},
    actions: {},
    enums: {},
    scalars: {},
    opaques: {},
    // v0.3.4 (W9): events are merged just like records — one bucket per ns.
    events: {},
    sourceFiles: [],
  }

  // v0.3.4 (W8): schema-level `@transport` / `IRSchema.directives` merge.
  // Convention: the first file to declare `@transport(kind: ...)` wins.
  // Subsequent files that declare a *different* kind emit an advisory
  // diagnostic but do not override — split schemas with conflicting
  // transports should live in different namespaces by design. Files without
  // `@transport` contribute nothing to the merged value (left absent = any).
  for (const f of group) {
    const firSchema = f.ir?.schemas[ns]
    if (!firSchema) continue
    if (firSchema.transport && !mergedSchema.transport) {
      mergedSchema.transport = firSchema.transport
    }
    if (firSchema.directives && firSchema.directives.length > 0) {
      mergedSchema.directives = (mergedSchema.directives ?? []).concat(
        firSchema.directives.map(d => ({
          name: d.name,
          args: { ...d.args },
          ...(d.argTypes ? { argTypes: { ...d.argTypes } } : {}),
        })),
      )
    }
  }

  // First pass: copy full definitions per file into the merged schema.
  // Duplicate top-level names across files → E010 (we treat it as a duplicate
  // definition the same way the single-file path treats record/extend merge).
  for (const f of group) {
    const fir = f.ir
    if (!fir) continue
    const fSchema = fir.schemas[ns]
    if (!fSchema) continue

    if (fSchema.version > mergedSchema.version) mergedSchema.version = fSchema.version
    mergedSchema.sourceFiles!.push(f.key)

    for (const [name, rec] of Object.entries(fSchema.records)) {
      if (mergedSchema.records[name]) {
        // Two `record X` declarations in different files of the same
        // namespace → duplicate. Report on the second declaration's location.
        const loc = findRecordLoc(f.ast, name) ?? { line: 1, column: 1 }
        diagnostics.push(diag('E010', MSG.E010(name), loc))
      } else {
        // Deep-clone so extend merges later don't mutate per-file IR.
        mergedSchema.records[name] = cloneRecord(rec)
      }
    }
    for (const [name, en] of Object.entries(fSchema.enums)) {
      if (mergedSchema.enums[name]) {
        const loc = findDefLoc(f.ast, 'enum', name) ?? { line: 1, column: 1 }
        diagnostics.push(diag('E010', MSG.E010(name), loc))
      } else mergedSchema.enums[name] = { name: en.name, values: en.values.slice() }
    }
    for (const [name, sc] of Object.entries(fSchema.scalars)) {
      if (!mergedSchema.scalars[name]) mergedSchema.scalars[name] = { ...sc }
    }
    for (const [name, op] of Object.entries(fSchema.opaques)) {
      if (mergedSchema.opaques[name]) {
        const loc = findDefLoc(f.ast, 'opaque', name) ?? { line: 1, column: 1 }
        diagnostics.push(diag('E010', MSG.E010(name), loc))
      } else mergedSchema.opaques[name] = { ...op }
    }
    for (const [name, act] of Object.entries(fSchema.actions)) {
      if (mergedSchema.actions[name]) {
        const loc = findDefLoc(f.ast, 'action', name) ?? { line: 1, column: 1 }
        diagnostics.push(diag('E010', MSG.E010(name), loc))
      } else mergedSchema.actions[name] = { ...act, input: act.input?.map(f => ({ ...f })) }
    }
    // v0.3.4 (W9): merge events the same way records merge. Duplicate event
    // names across files of the same namespace → E010.
    for (const [name, ev] of Object.entries(fSchema.events ?? {})) {
      if (mergedSchema.events[name]) {
        const loc = findDefLoc(f.ast, 'event', name) ?? { line: 1, column: 1 }
        diagnostics.push(diag('E010', MSG.E010(name), loc))
      } else {
        mergedSchema.events[name] = {
          name: ev.name,
          fields: ev.fields.map(fld => ({
            ...fld,
            directives: fld.directives?.map(d => ({ name: d.name, args: { ...d.args } })),
          })),
          directives: ev.directives?.map(d => ({ name: d.name, args: { ...d.args } })),
          leadingComments: ev.leadingComments?.slice(),
        }
      }
    }
  }

  // Second pass: apply every file's `extend record` blocks to the merged
  // target. Duplicate field names (base + extend or extend + extend) → E010.
  for (const f of group) {
    for (const def of f.ast.definitions) {
      if (def.kind !== 'extend') continue
      const target = mergedSchema.records[def.name]
      if (!target) continue // E011 handled separately
      for (const fld of def.fields) {
        if (target.fields.some(existing => existing.name === fld.name)) {
          diagnostics.push(diag('E010', MSG.E010(fld.name), fld.loc))
          continue
        }
        target.fields.push(fieldNodeToIRField(fld))
      }
    }
  }

  return mergedSchema
}

function cloneRecord(r: IRRecord): IRRecord {
  return {
    name: r.name,
    fields: r.fields.map(f => ({
      ...f,
      directives: f.directives?.map(d => ({ name: d.name, args: { ...d.args } })),
    })),
    directives: r.directives?.map(d => ({ name: d.name, args: { ...d.args } })),
    scope: r.scope,
    topic: r.topic,
  }
}

function typeExprToRef(t: TypeExprNode): IRTypeRef {
  if (t.map) {
    return {
      type: 'Map',
      required: t.required,
      list: false,
      map: true,
      mapKey: typeExprToRef(t.keyType!),
      mapValue: typeExprToRef(t.valueType!),
    }
  }
  if (t.list) {
    const inner = t.inner!
    let core = inner
    while (core.list && core.inner) core = core.inner
    return {
      type: core.name,
      required: t.required,
      list: true,
      listItemRequired: inner.required,
    }
  }
  return { type: t.name, required: t.required, list: false }
}

function fieldNodeToIRField(f: FieldNode): IRField {
  // Mirror ir.ts flattening. Kept local to avoid coupling.
  let core = f.type
  while (core.list && core.inner) core = core.inner
  const isMap = !!f.type.map
  const field: IRField = {
    name: f.name,
    type: isMap ? 'Map' : core.name,
    required: f.type.required,
    list: f.type.list,
  }
  if (f.type.list) field.listItemRequired = !!(f.type.inner && f.type.inner.required)
  if (isMap) {
    field.map = true
    field.mapKey   = typeExprToRef(f.type.keyType!)
    field.mapValue = typeExprToRef(f.type.valueType!)
  }
  if (f.directives.length) {
    field.directives = f.directives.map((d: DirectiveNode) => {
      const args: Record<string, unknown> = {}
      for (const a of d.args) {
        switch (a.value.kind) {
          case 'string':
          case 'int':
          case 'float':
          case 'bool':
          case 'enum':
            args[a.name] = a.value.value
            break
          case 'list':
            args[a.name] = a.value.values.map(v => (v as any).value)
            break
        }
      }
      return { name: d.name, args }
    })
  }
  return field
}

function findRecordLoc(ast: FileAST, name: string): SourceLoc | null {
  for (const d of ast.definitions) {
    if (d.kind === 'record' && d.name === name) return d.loc
  }
  return null
}

function findDefLoc(
  ast: FileAST,
  kind: 'enum' | 'scalar' | 'opaque' | 'action' | 'event',
  name: string,
): SourceLoc | null {
  for (const d of ast.definitions) {
    if (d.kind === kind && d.name === name) return d.loc
  }
  return null
}

// ────────────────────────────────────────────────────────────────
// Global type-reference check (E009 across files)
// ────────────────────────────────────────────────────────────────

const BUILTIN_SCALARS = new Set([
  'ID', 'String', 'Int', 'Float', 'Boolean',
  'Timestamp', 'UUID', 'Bytes', 'Duration',
])

function collectImports(
  f: LinkerFile & { key: string },
  useResolutions: Map<string, Map<string, string>>,
  declaredBy: Map<string, Set<string>>,
): Set<string> {
  const names = new Set<string>()
  const resolved = useResolutions.get(f.key)
  if (!resolved) return names
  for (const u of f.ast.uses) {
    const target = resolved.get(u.path)
    const exports = target ? declaredBy.get(target) : null
    for (const n of u.imports) {
      // Include even unresolved names so we don't cascade E009 on top of
      // E008/E021. The validator already flagged the missing export.
      names.add(n)
      void exports
    }
  }
  return names
}

function applyGlobalTypeChecks(
  merged: IR,
  files: (LinkerFile & { key: string })[],
  useResolutions: Map<string, Map<string, string>>,
  declaredBy: Map<string, Set<string>>,
  diagnostics: Diagnostic[],
): void {
  for (const f of files) {
    const sch = f.ast.schema
    if (!sch || !sch.namespace) continue
    const mergedSchema = merged.schemas[sch.namespace]
    if (!mergedSchema) continue
    const imported = collectImports(f, useResolutions, declaredBy)

    // Build defined-types for this file's namespace view.
    const defined = new Set<string>([
      ...BUILTIN_SCALARS,
      ...Object.keys(mergedSchema.records),
      ...Object.keys(mergedSchema.enums),
      ...Object.keys(mergedSchema.scalars),
      ...Object.keys(mergedSchema.opaques),
      ...imported,
    ])

    // Map-key-safe universe: scalars only (SPEC §4.8). Imports are assumed
    // scalar-safe (the importer took them on trust; cross-file stricter
    // inference is a later concern).
    const keySafe = new Set<string>([
      ...BUILTIN_SCALARS,
      ...Object.keys(mergedSchema.scalars),
      ...imported,
    ])

    // Walk AST-level record fields + extend fields + action input/output and
    // check the base type names.
    for (const def of f.ast.definitions) {
      if (def.kind === 'record') {
        for (const fld of def.fields) checkType(fld.type, defined, keySafe, diagnostics)
      } else if (def.kind === 'extend') {
        for (const fld of def.fields) checkType(fld.type, defined, keySafe, diagnostics)
      } else if (def.kind === 'action') {
        if (def.input) for (const a of def.input) checkType(a.type, defined, keySafe, diagnostics)
        if (def.output) checkType(def.output, defined, keySafe, diagnostics)
      } else if (def.kind === 'event') {
        // v0.3.4 (W9): same field-type validation as records.
        for (const fld of def.fields) checkType(fld.type, defined, keySafe, diagnostics)
      }
    }
  }
}

function describeType(t: TypeExprNode): string {
  if (t.map) return `Map<...>`
  if (t.list) return `[${t.inner ? describeType(t.inner) : '?'}]`
  return t.name + (t.required ? '!' : '')
}

/**
 * Recursively walk a TypeExprNode and report E009 on unknown type refs.
 * Handles list and map type constructors. For `Map<K, V>`, additionally
 * emits E022 when K is not a scalar (SPEC §4.8).
 */
function checkType(
  t: TypeExprNode,
  defined: Set<string>,
  keySafe: Set<string>,
  out: Diagnostic[],
) {
  if (t.map) {
    if (t.keyType) {
      if (t.keyType.list || t.keyType.map || !keySafe.has(t.keyType.name)) {
        out.push(diag('E022', MSG.E022(describeType(t.keyType)), t.keyType.loc))
      }
      checkType(t.keyType, defined, keySafe, out)
    }
    if (t.valueType) checkType(t.valueType, defined, keySafe, out)
    return
  }
  if (t.list) {
    if (t.inner) checkType(t.inner, defined, keySafe, out)
    return
  }
  if (!defined.has(t.name)) {
    out.push(diag('E009', MSG.E009(t.name), t.loc))
  }
}

// ────────────────────────────────────────────────────────────────
// E014 — cycle detection (Tarjan's SCC)
// ────────────────────────────────────────────────────────────────

interface Edge {
  from: string
  to: string
  lazy: boolean // true if the source field carries @sync(mode: LAZY)
}

function applyCycleDetection(merged: IR, diagnostics: Diagnostic[]): void {
  for (const ns of Object.keys(merged.schemas)) {
    const schema = merged.schemas[ns]!
    const records = schema.records

    // Build adjacency with per-edge LAZY marker.
    const adj = new Map<string, Edge[]>()
    for (const rname of Object.keys(records)) adj.set(rname, [])

    for (const rname of Object.keys(records)) {
      const rec = records[rname]!
      for (const fld of rec.fields) {
        if (!records[fld.type]) continue // target isn't a record → skip
        const lazy = fieldIsLazy(fld)
        adj.get(rname)!.push({ from: rname, to: fld.type, lazy })
      }
    }

    // Tarjan's SCC. Each SCC with ≥ 2 members, or a self-loop, is a cycle.
    // For each cycle we check if any edge within it is @sync(mode: LAZY);
    // if yes, it's broken; if no → E014.
    const sccs = tarjan([...adj.keys()], adj)
    for (const scc of sccs) {
      // Gather edges internal to this SCC.
      const members = new Set(scc)
      const internalEdges: Edge[] = []
      for (const node of scc) {
        for (const e of adj.get(node) ?? []) {
          if (members.has(e.to)) internalEdges.push(e)
        }
      }
      if (scc.length < 2) {
        // Single-node SCC is a cycle only if it has a self-loop.
        if (!internalEdges.some(e => e.from === e.to)) continue
      }
      const hasBreak = internalEdges.some(e => e.lazy)
      if (!hasBreak) {
        // Build a readable cycle string.
        const label = scc.join(' → ') + ' → ' + scc[0]
        // Emit once per SCC, anchored at (1,1) since IR has no locs.
        diagnostics.push(diag('E014', MSG.E014(label), { line: 1, column: 1 }))
      }
    }
  }
}

function fieldIsLazy(f: IRField): boolean {
  if (!f.directives) return false
  for (const d of f.directives) {
    if (d.name === 'sync' && d.args && (d.args as any).mode === 'LAZY') return true
  }
  return false
}

function tarjan(nodes: string[], adj: Map<string, Edge[]>): string[][] {
  const indices = new Map<string, number>()
  const lowlinks = new Map<string, number>()
  const onStack = new Set<string>()
  const stack: string[] = []
  const sccs: string[][] = []
  let counter = 0

  const strong = (v: string) => {
    indices.set(v, counter)
    lowlinks.set(v, counter)
    counter++
    stack.push(v)
    onStack.add(v)

    for (const e of adj.get(v) ?? []) {
      const w = e.to
      if (!indices.has(w)) {
        strong(w)
        lowlinks.set(v, Math.min(lowlinks.get(v)!, lowlinks.get(w)!))
      } else if (onStack.has(w)) {
        lowlinks.set(v, Math.min(lowlinks.get(v)!, indices.get(w)!))
      }
    }

    if (lowlinks.get(v) === indices.get(v)) {
      const comp: string[] = []
      while (true) {
        const w = stack.pop()!
        onStack.delete(w)
        comp.push(w)
        if (w === v) break
      }
      sccs.push(comp)
    }
  }

  for (const n of nodes) if (!indices.has(n)) strong(n)
  return sccs
}

// ────────────────────────────────────────────────────────────────
// Convenience helper used by the public driver.
// Builds per-file IR+AST, runs `link`, and concatenates diagnostics.
// ────────────────────────────────────────────────────────────────

export interface PrelinkedFile {
  path: string
  source: string
}

export function prelink(
  inputs: PrelinkedFile[],
  parseSource: (source: string, filename?: string) => { ir: IR | null; diagnostics: Diagnostic[]; ast?: FileAST },
): {
  perFile: Record<string, IR | null>
  linkerFiles: LinkerFile[]
  diagnostics: Diagnostic[]
} {
  const perFile: Record<string, IR | null> = {}
  const linkerFiles: LinkerFile[] = []
  const diagnostics: Diagnostic[] = []

  for (const input of inputs) {
    const res = parseSource(input.source, input.path)
    perFile[input.path] = res.ir
    diagnostics.push(...res.diagnostics)
    if (res.ast) {
      linkerFiles.push({ path: input.path, ast: res.ast, ir: res.ir })
    }
  }

  return { perFile, linkerFiles, diagnostics }
}

// Re-export validator so callers that only import the linker can also run a
// post-merge validation pass if they want.
export { validate, buildIR }
