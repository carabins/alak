// @alaq/graph — validator. Produces diagnostics E001–E020 and W001–W004.
//
// The validator works on the AST (richer than IR — has source locations,
// directive arg types, and extend blocks intact) but cross-checks against
// the IR when it's more convenient (e.g., record-level field merge).
//
// Not implemented (by design, see task brief):
//   - E007 (cross-file namespace collision) — single-file only here
//   - E008 (use path resolution) — filesystem resolution deferred
//
// Everything else is implemented.

import type {
  Diagnostic,
  DirectiveNode,
  FileAST,
  FieldNode,
  IR,
  SourceLoc,
  TypeExprNode,
  Value,
} from './types'
import { diag, MSG } from './errors'
import { DIRECTIVE_SIGS, argType, argEnumValues, argRequiredIf } from './ir'
import type { Site } from './ir'

const BUILTIN_SCALARS = new Set([
  'ID', 'String', 'Int', 'Float', 'Float32', 'Boolean',
  'Timestamp', 'UUID', 'Bytes', 'Duration',
  // v0.3.6 — `Any` is a runtime-typed opaque CBOR value. E009 treats it as a
  // valid type; E026 (below) enforces positional constraints (permitted only
  // as a record field type or a Map<K, Any> value; forbidden in action
  // input/output, event fields, list elements, and map keys).
  'Any',
])

const KNOWN_DIRECTIVES = new Set(Object.keys(DIRECTIVE_SIGS))

export interface ValidateOptions {
  /** Original AST — required for source locations on most diagnostics. */
  ast?: FileAST
  /** Imported type names (from `use` statements). */
  importedTypes?: Set<string>
  /** Skip filesystem-dependent checks (E008). */
  skipUseResolution?: boolean
}

export function validate(ir: IR, opts: ValidateOptions = {}): Diagnostic[] {
  const out: Diagnostic[] = []
  const ast = opts.ast
  const importedTypes = opts.importedTypes ?? new Set<string>()

  // Shared across all records in the schema: "which names in scope are
  // map-key-safe, i.e. scalar types?" Computed once per schema below.
  let keySafeTypes: Set<string> = new Set()

  // Helper: a location at (1,1) when we have no token to blame.
  const anchor: SourceLoc = { line: 1, column: 1 }

  for (const nsKey of Object.keys(ir.schemas)) {
    const schema = ir.schemas[nsKey]!

    // ── E018: required schema fields present.
    // The AST-level decl knows whether version/namespace keys appeared.
    if (ast && ast.schema) {
      if (!ast.schema.hasVersion) {
        out.push(diag('E018', MSG.E018('version'), ast.schema.loc))
      }
      if (!ast.schema.hasNamespace) {
        out.push(diag('E018', MSG.E018('namespace'), ast.schema.loc))
      }
      // v0.3.4 (W8): schema-level directives participate in the same
      // closed-set / arg-shape / required-arg validation path as record-level
      // directives. Unknown directives emit E001, wrong arg types E003,
      // missing required args E023. The only schema-level directive defined
      // in v0.3.4 is `@transport`; closed value set for `kind` is enforced
      // through DIRECTIVE_SIGS.transport.enumValues (yields E003 on mismatch).
      if (ast.schema.directives) {
        for (const d of ast.schema.directives) {
          // Site override: schema-level directives are at SCHEMA. Without
          // the override the centralised site check would treat them as
          // RECORD-level (the validator's `_target` enum still says
          // `'record'` for legacy reasons) and erroneously fire E029 for
          // `@transport`, `@crdt_doc_topic`, `@schema_version`.
          validateDirective(d, out, 'record', ast.schema.name, 'SCHEMA')
        }
      }
    }

    // Type name universe: all schema members + imported + builtin scalars.
    const definedTypes = new Set<string>([
      ...BUILTIN_SCALARS,
      ...Object.keys(schema.records),
      ...Object.keys(schema.enums),
      ...Object.keys(schema.scalars),
      ...Object.keys(schema.opaques),
      ...importedTypes,
    ])

    // Map-key-safe = scalar types. Per SPEC §4.8 (v0.3): only built-in
    // scalars and user-declared `scalar`s may appear as Map<K, V> keys.
    // Records, enums, opaques, and lists are rejected with E022.
    // Imported types are assumed scalar-safe (the importer took them on
    // trust; cross-file stricter inference is a later concern).
    keySafeTypes = new Set<string>([
      ...BUILTIN_SCALARS,
      ...Object.keys(schema.scalars),
      ...importedTypes,
    ])

    // ── Walk records
    for (const recName of Object.keys(schema.records)) {
      const rec = schema.records[recName]!
      const recNode = ast?.definitions.find(
        d => d.kind === 'record' && d.name === recName,
      )
      const recLoc: SourceLoc = recNode ? recNode.loc : anchor

      // Record-level directives
      if (recNode && recNode.kind === 'record') {
        for (const d of recNode.directives) {
          validateDirective(d, out, 'record', rec.name)
        }

        // v0.3.9 (Wave 3B — W008): @envelope override-coherence. The preset
        // expansion happens at codegen time (see SPEC §7.19); when an author
        // also writes a sibling directive that contradicts the preset's
        // implicit choices, warn. Today the only contradiction we can detect
        // structurally is `@envelope(stream)` paired with `@crdt(...)` — the
        // `stream` preset implies `crdt_mode: none` while `@crdt` adds CRDT
        // semantics. Other override-coherence cases (priority/congestion)
        // need their own sibling directives, deferred to v0.4.
        const envelopeDir = recNode.directives.find(d => d.name === 'envelope')
        if (envelopeDir) {
          const kindArg = envelopeDir.args.find(a => a.name === 'kind')
          const kindVal = kindArg && kindArg.value.kind === 'enum' ? kindArg.value.value : null
          const hasCrdt = recNode.directives.some(d => d.name === 'crdt')
            || recNode.directives.some(d => d.name === 'crdt_doc_member')
          if (kindVal === 'stream' && hasCrdt) {
            out.push(diag('W008', MSG.W008('stream', 'crdt'), envelopeDir.loc))
          }
          if (kindVal === 'event' && hasCrdt) {
            out.push(diag('W008', MSG.W008('event', 'crdt'), envelopeDir.loc))
          }
        }

        // E010: duplicate field detection across `record` + `extend record`.
        // Use AST-level data since extend blocks live there.
        const allFieldNames = new Map<string, SourceLoc>()
        for (const f of recNode.fields) {
          if (allFieldNames.has(f.name)) {
            out.push(diag('E010', MSG.E010(f.name), f.loc))
          } else {
            allFieldNames.set(f.name, f.loc)
          }
        }
        // Merge in extend-record fields
        if (ast) {
          for (const ext of ast.definitions) {
            if (ext.kind !== 'extend' || ext.name !== recName) continue
            for (const f of ext.fields) {
              if (allFieldNames.has(f.name)) {
                out.push(diag('E010', MSG.E010(f.name), f.loc))
              } else {
                allFieldNames.set(f.name, f.loc)
              }
            }
          }
        }

        // W003: @crdt without `updated_at: Timestamp!`
        const crdt = recNode.directives.find(d => d.name === 'crdt')
        if (crdt) {
          const hasUpdatedAt = recNode.fields.some(
            f => f.name === 'updated_at'
              && f.type.name === 'Timestamp'
              && f.type.required
              && !f.type.list,
          )
          // Also check fields from extends
          let hasUpdatedAtExt = false
          if (ast) {
            for (const ext of ast.definitions) {
              if (ext.kind !== 'extend' || ext.name !== recName) continue
              if (ext.fields.some(
                f => f.name === 'updated_at'
                  && f.type.name === 'Timestamp'
                  && f.type.required
                  && !f.type.list,
              )) { hasUpdatedAtExt = true; break }
            }
          }
          if (!hasUpdatedAt && !hasUpdatedAtExt) {
            out.push(diag('W003', MSG.W003(recName), recLoc))
          }

          // E004 / E005 on @crdt — done in validateDirective but needs the
          // record's field map to validate the `key` target.
          const typeArg = crdt.args.find(a => a.name === 'type')
          const keyArg = crdt.args.find(a => a.name === 'key')
          const typeVal = typeArg && typeArg.value.kind === 'enum' ? typeArg.value.value : null
          if (typeVal && typeVal.startsWith('LWW_')) {
            if (!keyArg) {
              out.push(diag('E004', MSG.E004(), crdt.loc))
            } else if (keyArg.value.kind === 'string') {
              // Validate the referenced field exists and is Timestamp!/Int!
              const fname = keyArg.value.value
              const findField = (name: string): FieldNode | null => {
                const f = recNode.fields.find(f => f.name === name)
                if (f) return f
                if (ast) {
                  for (const ext of ast.definitions) {
                    if (ext.kind !== 'extend' || ext.name !== recName) continue
                    const ef = ext.fields.find(f => f.name === name)
                    if (ef) return ef
                  }
                }
                return null
              }
              const target = findField(fname)
              if (!target) {
                out.push(diag('E005', MSG.E005(fname), keyArg.loc))
              } else {
                const t = target.type
                const isTimestampInt =
                  !t.list && t.required && (t.name === 'Timestamp' || t.name === 'Int')
                if (!isTimestampInt) out.push(diag('E005', MSG.E005(fname), keyArg.loc))
              }
            }
          }
        }

        // Validate all fields
        for (const f of recNode.fields) {
          validateField(f, recName, out, definedTypes, schema.enums, keySafeTypes)
        }
        // Also validate fields introduced via extend blocks
        if (ast) {
          for (const ext of ast.definitions) {
            if (ext.kind !== 'extend' || ext.name !== recName) continue
            for (const f of ext.fields) {
              validateField(f, recName, out, definedTypes, schema.enums, keySafeTypes)
            }
          }
        }
      }
    }

    // ── E011: extend record where X is not in scope
    if (ast) {
      for (const ext of ast.definitions) {
        if (ext.kind !== 'extend') continue
        if (!schema.records[ext.name] && !importedTypes.has(ext.name)) {
          out.push(diag('E011', MSG.E011(ext.name), ext.loc))
        }
      }
    }

    // ── v0.3.7: Enum-level directives. Currently only `@rename_case`
    // is valid at this placement; other directives fall through to
    // E001 / E003 / E023 via validateDirective.
    if (ast) {
      for (const def of ast.definitions) {
        if (def.kind !== 'enum') continue
        if (!def.directives) continue
        for (const d of def.directives) {
          validateDirective(d, out, 'enum', def.name)
        }
      }
    }

    // ── Events (v0.3.4 / W9)
    //
    // Events share IRRecord's shape but live at `schema.events`. We run the
    // same field-level validation pass (E009/E022/W001/etc.) and reject
    // event-level directives that don't make sense for broadcast payloads:
    // events are never scoped, never @store, never @crdt — emit an advisory
    // via the ordinary unknown-directive path. E024 reserves the rejection
    // of `@scope` on events (no lifecycle container for a broadcast).
    for (const evName of Object.keys(schema.events)) {
      const evNode = ast?.definitions.find(
        d => d.kind === 'event' && d.name === evName,
      )
      if (!evNode || evNode.kind !== 'event') continue

      // Event-level directives — allow @topic / @deprecated / @added; reject
      // @scope explicitly via E024 since events are broadcast and not scoped.
      // v0.3.7: target='event' so `@rename_case` on an event fires E028.
      for (const d of evNode.directives) {
        if (d.name === 'scope') {
          out.push(diag('E024', MSG.E024(evName), d.loc))
          continue
        }
        validateDirective(d, out, 'event', evName)
      }

      // E010-style: duplicate field names inside the event body.
      const seenNames = new Map<string, SourceLoc>()
      for (const f of evNode.fields) {
        if (seenNames.has(f.name)) {
          out.push(diag('E010', MSG.E010(f.name), f.loc))
        } else {
          seenNames.set(f.name, f.loc)
        }
      }

      // Field-level validation — reuse the record pass; events ride the same
      // type system (SPEC §5.5). v0.3.6: `Any` is forbidden in event fields
      // (SPEC §4.1), so topLevelAnyAllowed=false here — a bare `Any` at field
      // position fires E026.
      for (const f of evNode.fields) {
        validateField(
          f, evName, out, definedTypes, schema.enums, keySafeTypes, false,
        )
      }
    }

    // ── Actions
    for (const actName of Object.keys(schema.actions)) {
      const actNode = ast?.definitions.find(
        d => d.kind === 'action' && d.name === actName,
      )
      if (!actNode || actNode.kind !== 'action') continue

      // E006: @this on an argument, but action has no scope
      if (actNode.input) {
        for (const arg of actNode.input) {
          for (const d of arg.directives) {
            if (d.name === 'this' && actNode.scope === null) {
              out.push(diag('E006', MSG.E006(), d.loc))
            }
          }
          // Argument-level directives — validate
          for (const d of arg.directives) {
            validateDirective(d, out, 'argument', `${actName}.${arg.name}`)
          }
          // Argument type resolution
          checkTypeRef(arg.type, out, definedTypes, keySafeTypes)
          // E026 (v0.3.6): `Any` forbidden in action input — action contracts
          // must stay typed. topLevel=false flags a bare `Any` at argument
          // position; the helper recurses for list/map cases.
          checkAnyPlacement(
            arg.type,
            `an action input argument (${actName}.${arg.name})`,
            false,
            out,
          )
        }
      }
      // Output type resolution
      if (actNode.output) {
        checkTypeRef(actNode.output, out, definedTypes, keySafeTypes)
        // E026 (v0.3.6): `Any` forbidden as action output.
        checkAnyPlacement(
          actNode.output,
          `an action output type (${actName})`,
          false,
          out,
        )
      }

      // E019: scope declared but no scoped records of that scope.
      // Suppressed when the file imports symbols — the scope's host record
      // may live in an imported file. Cross-file E019 is a link-time check
      // that a multi-file driver (generator / CLI) will re-run.
      if (actNode.scope && importedTypes.size === 0) {
        const anyScopedRec = Object.values(schema.records).some(
          r => r.scope === actNode.scope,
        )
        if (!anyScopedRec) {
          out.push(diag('E019', MSG.E019(actNode.scope), actNode.loc))
        }
      }
    }

    // ── v0.3.6: composite CRDT document consistency (E027).
    // Covers SPEC §7.15 / §7.16 / §7.17. Collects all `@crdt_doc_topic` and
    // `@schema_version` at the schema level, all `@crdt_doc_member` on
    // records, then cross-checks: every member needs a matching topic, every
    // topic needs ≥1 member, members sharing a `doc:` cannot collide on the
    // `map:` slot or carry `@scope`, every `@schema_version` needs a matching
    // topic.
    if (ast) validateCompositeDocs(ast, schema, out)

    // ── Opaques
    for (const opName of Object.keys(schema.opaques)) {
      const op = schema.opaques[opName]!
      const opNode = ast?.definitions.find(
        d => d.kind === 'opaque' && d.name === opName,
      )
      // E020: max_size ≤ 0
      if (op.maxSize !== undefined && op.maxSize <= 0) {
        out.push(diag('E020', MSG.E020(), opNode ? opNode.loc : anchor))
      }
    }
  }

  // ── One-off file-level: E017 (two schemas) already handled in the parser.
  // We replay it here only if AST carries both `schema` + a known duplicate
  // marker (parser already pushed an E017 diagnostic). So nothing to do.

  return out
}

function validateField(
  f: FieldNode,
  recordName: string,
  out: Diagnostic[],
  definedTypes: Set<string>,
  enums: Record<string, { values: string[] }>,
  keySafeTypes: Set<string>,
  // v0.3.6 (E026): record and event fields are permitted hosts for `Any` at
  // their outermost position. `topLevelAnyAllowed: false` is used when the
  // same validator is driven from a forbidden host (action input/output,
  // currently handled inline at the call site — kept as a parameter so that
  // future forbidden hosts route through here cleanly).
  topLevelAnyAllowed: boolean = true,
) {
  // E009: referenced type exists (also drives E022 for map keys)
  checkTypeRef(f.type, out, definedTypes, keySafeTypes)
  // E026 (v0.3.6): `Any` placement. The outermost type is a permitted host
  // (record field / event field); recursion still fires for list elements
  // and map keys.
  checkAnyPlacement(f.type, `field "${recordName}.${f.name}"`, topLevelAnyAllowed, out)

  // Per-field directives
  let hasSync = false
  let hasAtomic = false
  let hasStore = false
  let realtimeSync = false
  let syncDir: DirectiveNode | null = null
  for (const d of f.directives) {
    validateDirective(d, out, 'field', `${recordName}.${f.name}`)
    if (d.name === 'sync') {
      hasSync = true
      syncDir = d
      const qosArg = d.args.find(a => a.name === 'qos')
      if (qosArg && qosArg.value.kind === 'enum' && qosArg.value.value === 'REALTIME') {
        realtimeSync = true
      }
    }
    if (d.name === 'atomic') hasAtomic = true
    if (d.name === 'store') hasStore = true
    if (d.name === 'default') {
      // E013 / E012
      const valArg = d.args.find(a => a.name === 'value')
      if (valArg) checkDefaultValue(f, valArg.value, out, enums)
    }
    if (d.name === 'range') {
      // E015: non-numeric field
      if (!isNumeric(f.type)) {
        out.push(diag('E015', MSG.E015(f.name), d.loc))
      }
      // E016: min > max
      const minArg = d.args.find(a => a.name === 'min')
      const maxArg = d.args.find(a => a.name === 'max')
      const mn = minArg && (minArg.value.kind === 'int' || minArg.value.kind === 'float')
        ? minArg.value.value : null
      const mx = maxArg && (maxArg.value.kind === 'int' || maxArg.value.kind === 'float')
        ? maxArg.value.value : null
      if (mn !== null && mx !== null && mn > mx) {
        out.push(diag('E016', MSG.E016(), d.loc))
      }
    }
  }

  // W001: REALTIME on composite (non-scalar, non-enum) field without @atomic
  if (realtimeSync && !hasAtomic) {
    const baseName = typeBaseName(f.type)
    const isScalar = BUILTIN_SCALARS.has(baseName) || baseName in enums
    // Check: the base is a record or imported user type (composite)
    const isEnumType = !!enums[baseName]
    if (!isScalar && !isEnumType) {
      out.push(diag('W001', MSG.W001(f.name), syncDir?.loc ?? f.loc))
    }
  }

  // W002: @store without explicit @sync
  if (hasStore && !hasSync) {
    out.push(diag('W002', MSG.W002(f.name), f.loc))
  }
}

/** Map the validator's per-call `target` enum to the canonical `Site` enum
 *  declared on every directive signature. The mapping is intentionally lossy
 *  for `RECORD` (the validator currently passes `'record'` for both real
 *  records and schema-level directive checks); callers that need a finer
 *  site discrimination — e.g. `'SCHEMA'` for schema-level placements —
 *  pass it via `siteOverride`. */
function targetToSite(t: 'record' | 'field' | 'argument' | 'enum' | 'event'): Site {
  switch (t) {
    case 'record':   return 'RECORD'
    case 'field':    return 'FIELD'
    case 'argument': return 'ARGUMENT'
    case 'enum':     return 'ENUM'
    case 'event':    return 'EVENT'
  }
}

function siteLabel(s: Site): string {
  switch (s) {
    case 'SCHEMA':     return 'a schema'
    case 'RECORD':     return 'a record'
    case 'FIELD':      return 'a field'
    case 'ENUM':       return 'an enum'
    case 'ENUM_VALUE': return 'an enum value'
    case 'ARGUMENT':   return 'an action argument'
    case 'EVENT':      return 'an event'
    case 'ACTION':     return 'an action'
    case 'OPAQUE':     return 'an opaque stream'
  }
}

function validateDirective(
  d: DirectiveNode,
  out: Diagnostic[],
  _target: 'record' | 'field' | 'argument' | 'enum' | 'event',
  _context: string,
  siteOverride?: Site,
) {
  // E001: unknown directive
  if (!KNOWN_DIRECTIVES.has(d.name)) {
    out.push(diag('E001', MSG.E001(d.name), d.loc))
    return
  }
  const sig = DIRECTIVE_SIGS[d.name]!

  // v0.3.7 — E028: `@rename_case` is only valid on RECORD | ENUM. Other
  // placements (field, argument, event) fire E028 at the directive site.
  // Event-level `@rename_case` is reserved for a future spec bump.
  // The centralised site check below would also catch this case, but E028
  // keeps a tailored message ("a field" vs the generic "@X not valid on …")
  // and is referenced by the SPEC §12 catalog, so it stays.
  if (d.name === 'rename_case' && _target !== 'record' && _target !== 'enum') {
    const where = _target === 'argument' ? 'an action argument'
                : _target === 'event'    ? 'an event'
                                         : `a ${_target}`
    out.push(diag('E028', MSG.E028(where), d.loc))
    // Still run arg-shape checks below so E003/E023 surface alongside E028.
  }

  // DRIFT-2 (Wave 3A): centralised site check. Each directive declares its
  // permitted Sites in `DIRECTIVE_SIGS.<name>.sites`. When a directive turns
  // up at an unsupported site, emit E029 — generic "directive not valid
  // here". E028 / E006 / E024 keep their tailored messages and fire
  // alongside (catalog-referenced); the central check is a fall-back so that
  // every new directive added to DIRECTIVE_SIGS automatically gets site
  // validation without bespoke validator code.
  if (sig.sites && sig.sites.length > 0) {
    const site: Site = siteOverride ?? targetToSite(_target)
    if (!sig.sites.includes(site)) {
      // Skip the redundant E029 when one of the legacy bespoke errors
      // (E028 / E006 / E024) has already fired at this site for this
      // directive — those carry a more specific message.
      const suppressed =
        (d.name === 'rename_case' && site !== 'RECORD' && site !== 'ENUM') ||
        (d.name === 'this' && site !== 'ARGUMENT') /* E006 path (separate
          check at action-input level) */
      if (!suppressed) {
        out.push(diag('E029', MSG.E029(d.name, site, sig.sites), d.loc))
      }
    }
  }

  // E023: required arguments missing. Two sources: signature-level `required`
  // (§7 args declared with `!`) and per-arg `requiredIf` predicates (e.g.
  // `@crdt.key` is required iff `@crdt.type` is `LWW_*` — DRIFT-3). The
  // `@crdt(key)`-for-LWW_* case keeps its tailored E004 message; the
  // centralised E023 from `requiredIf` is suppressed for that exact case
  // to avoid double-reporting. Future LWW_* additions would trip the
  // generic predicate path automatically.
  const present = new Set(d.args.map(a => a.name))
  if (sig.required) {
    for (const req of sig.required) {
      if (!present.has(req)) {
        out.push(diag('E023', MSG.E023(d.name, req), d.loc))
      }
    }
  }
  // Materialise the args as a plain record once for `requiredIf` predicates.
  const argMap: Record<string, unknown> = {}
  for (const a of d.args) {
    if (a.value.kind === 'string') argMap[a.name] = a.value.value
    else if (a.value.kind === 'int') argMap[a.name] = a.value.value
    else if (a.value.kind === 'float') argMap[a.name] = a.value.value
    else if (a.value.kind === 'bool') argMap[a.name] = a.value.value
    else if (a.value.kind === 'enum') argMap[a.name] = a.value.value
    else argMap[a.name] = undefined
  }
  for (const argName of Object.keys(sig.args)) {
    const pred = argRequiredIf(sig, argName)
    if (!pred) continue
    if (present.has(argName)) continue
    if (!pred(argMap)) continue
    // DRIFT-3: `@crdt(key)`-for-LWW_* keeps its tailored E004 message.
    if (d.name === 'crdt' && argName === 'key') continue
    out.push(diag('E023', MSG.E023(d.name, argName), d.loc))
  }

  for (const a of d.args) {
    // E002: unknown argument
    if (!(a.name in sig.args)) {
      out.push(diag('E002', MSG.E002(d.name, a.name), a.loc))
      continue
    }
    // E003: wrong type
    const expected = argType(sig.args[a.name]!)
    if (!matchesType(a.value, expected)) {
      out.push(diag('E003', MSG.E003(d.name, a.name, expected), a.loc))
      continue
    }
    // Enum value membership — checks the canonical closed set whether it
    // was declared at signature level (legacy `enumValues`) or per-arg
    // (`ArgSpec.enumValues`). Source of truth: `argEnumValues()`.
    const closedSet = argEnumValues(sig, a.name)
    if (expected === 'enum' && a.value.kind === 'enum' && closedSet) {
      if (!closedSet.includes(a.value.value)) {
        out.push(diag('E003', MSG.E003(d.name, a.name, `one of [${closedSet.join(', ')}]`), a.loc))
      }
    }
    // DRIFT-1: closed-set string membership. For `@transport(kind: "...")`,
    // `@auth(read: "...")`, `@auth(write: "...")`, and any future directive
    // that declares a string-typed arg with a closed set, enforce membership
    // on the string value. Mirrors the `'enum'`-typed variant above but for
    // string literals.
    if (expected === 'string' && a.value.kind === 'string' && closedSet) {
      if (!closedSet.includes(a.value.value)) {
        out.push(diag('E003', MSG.E003(d.name, a.name, `one of [${closedSet.map(s => `"${s}"`).join(', ')}]`), a.loc))
      }
    }
  }

  // Special: @atomic must not combine with @sync (R120 — not a dedicated
  // error code in §12, so we do not emit anything here).
}

function matchesType(
  v: Value,
  expected: 'string' | 'int' | 'float' | 'number' | 'bool' | 'enum' | 'any' | 'list' | 'object',
): boolean {
  switch (expected) {
    case 'string': return v.kind === 'string'
    case 'int':    return v.kind === 'int'
    case 'float':  return v.kind === 'float' || v.kind === 'int'
    // DRIFT-4 (Wave 3A): explicit numeric tag for `@range.min/max`. Accepts
    // either int or float literals; per-field type compatibility (R180)
    // remains a separate E015 check.
    case 'number': return v.kind === 'int' || v.kind === 'float'
    case 'bool':   return v.kind === 'bool'
    case 'enum':   return v.kind === 'enum'
    case 'list':   return v.kind === 'list'
    // v0.3.7 — object-literal arg (e.g. `soft_delete: { ... }`).
    case 'object': return v.kind === 'object'
    case 'any':    return true
  }
}

function checkDefaultValue(
  f: FieldNode,
  v: Value,
  out: Diagnostic[],
  enums: Record<string, { values: string[] }>,
) {
  const baseName = typeBaseName(f.type)
  // Maps — no object-literal form in SDL, so any @default on a map is a
  // type mismatch. Emit E013 unless the value is an empty list (tolerated
  // as "empty map" shorthand for future compat).
  if (f.type.map) {
    if (!(v.kind === 'list' && v.values.length === 0)) {
      out.push(diag('E013', MSG.E013(f.name, 'Map<...> (no default literal supported)'), v.loc))
    }
    return
  }
  // Lists
  if (f.type.list) {
    if (v.kind !== 'list') {
      out.push(diag('E013', MSG.E013(f.name, 'a list literal'), v.loc))
    }
    return
  }
  // Enums
  if (enums[baseName]) {
    if (v.kind !== 'enum') {
      out.push(diag('E013', MSG.E013(f.name, `enum ${baseName}`), v.loc))
      return
    }
    if (!enums[baseName]!.values.includes(v.value)) {
      out.push(diag('E012', MSG.E012(baseName, v.value), v.loc))
    }
    return
  }
  // Scalars
  switch (baseName) {
    case 'Int':
    case 'Timestamp':
    case 'Duration':
      if (v.kind !== 'int') out.push(diag('E013', MSG.E013(f.name, baseName), v.loc))
      break
    case 'Float':
    case 'Float32':
      if (v.kind !== 'int' && v.kind !== 'float') {
        out.push(diag('E013', MSG.E013(f.name, baseName), v.loc))
      }
      break
    case 'Boolean':
      if (v.kind !== 'bool') out.push(diag('E013', MSG.E013(f.name, 'Boolean'), v.loc))
      break
    case 'String':
    case 'ID':
    case 'UUID':
      if (v.kind !== 'string') out.push(diag('E013', MSG.E013(f.name, baseName), v.loc))
      break
    default:
      // Custom scalars — runtime-defined; accept any literal.
      break
  }
}

function checkTypeRef(
  t: TypeExprNode,
  out: Diagnostic[],
  defined: Set<string>,
  keySafe?: Set<string>,
) {
  // Map<K, V>: recurse into key + value. Also surface E022 when K is not a
  // scalar (only scalar keys are wire-safe; generators encode the map as
  // a CBOR map / LWW-Map keyed by the scalar).
  if (t.map) {
    if (t.keyType) {
      if (keySafe && !isScalarTypeRef(t.keyType, keySafe)) {
        out.push(diag('E022', MSG.E022(describeType(t.keyType)), t.keyType.loc))
      }
      // Still recurse so E009 reports unknown key types too.
      checkTypeRef(t.keyType, out, defined, keySafe)
    }
    if (t.valueType) checkTypeRef(t.valueType, out, defined, keySafe)
    return
  }
  const base = typeBaseName(t)
  if (!defined.has(base)) {
    out.push(diag('E009', MSG.E009(base), t.loc))
  }
  if (t.inner) checkTypeRef(t.inner, out, defined, keySafe)
}

function typeBaseName(t: TypeExprNode): string {
  let cur = t
  while (cur.list && cur.inner) cur = cur.inner
  // Map has no flat "base" — callers that need one get "Map".
  if (cur.map) return 'Map'
  return cur.name
}

/**
 * A type is scalar iff it's a non-list, non-map type whose name is in the
 * `keySafe` universe: built-in scalars, user-declared `scalar`s, and
 * imported types (assumed safe). Per SPEC §4.8, records and enums are NOT
 * valid map keys — keys must be wire-encodable as a primitive.
 */
function isScalarTypeRef(
  t: TypeExprNode,
  keySafe: Set<string>,
): boolean {
  if (t.list || t.map) return false
  return keySafe.has(t.name)
}

function describeType(t: TypeExprNode): string {
  if (t.map) return `Map<...>`
  if (t.list) return `[${t.inner ? describeType(t.inner) : '?'}]`
  return t.name + (t.required ? '!' : '')
}

function isNumeric(t: TypeExprNode): boolean {
  if (t.list) return false
  return t.name === 'Int' || t.name === 'Float' || t.name === 'Float32' || t.name === 'Duration' || t.name === 'Timestamp'
}

// ─────────────────────────────────────────────────────────────────────────────
// v0.3.6 — composite CRDT document consistency (E027)
// ─────────────────────────────────────────────────────────────────────────────
//
// Covers SPEC §7.15 `@crdt_doc_member`, §7.16 `@crdt_doc_topic`, §7.17
// `@schema_version`. Single-file scope (cross-file checks are a follow-up,
// same boundary as E007/E008).

function stringArg(d: DirectiveNode, name: string): string | null {
  const a = d.args.find(aa => aa.name === name)
  if (!a || a.value.kind !== 'string') return null
  return a.value.value
}

function validateCompositeDocs(
  ast: FileAST,
  _schema: IR['schemas'][string],
  out: Diagnostic[],
): void {
  type MemberRef = { doc: string; map: string; recName: string; dirLoc: SourceLoc }
  const members: MemberRef[] = []
  const memberScopeConflict: { doc: string; recName: string; dirLoc: SourceLoc }[] = []
  const topics = new Map<string, { pattern: string; dirLoc: SourceLoc }>()
  const duplicateTopics: { doc: string; dirLoc: SourceLoc }[] = []
  const schemaVersions = new Map<string, { value: number; dirLoc: SourceLoc }>()

  // ── Schema-level directives: collect @crdt_doc_topic and @schema_version.
  const schemaDirs = ast.schema?.directives ?? []
  for (const d of schemaDirs) {
    if (d.name === 'crdt_doc_topic') {
      const doc = stringArg(d, 'doc')
      const pattern = stringArg(d, 'pattern')
      if (doc === null || pattern === null) continue // arg validation emits its own diagnostic
      if (topics.has(doc)) {
        duplicateTopics.push({ doc, dirLoc: d.loc })
      } else {
        topics.set(doc, { pattern, dirLoc: d.loc })
      }
    } else if (d.name === 'schema_version') {
      const doc = stringArg(d, 'doc')
      const valArg = d.args.find(a => a.name === 'value')
      const value = valArg && valArg.value.kind === 'int' ? valArg.value.value : null
      if (doc === null || value === null) continue
      // Duplicate @schema_version for same doc — report as an inconsistency.
      if (schemaVersions.has(doc)) {
        out.push(diag('E027', MSG.E027(doc, 'multiple @schema_version directives for the same document'), d.loc))
      } else {
        schemaVersions.set(doc, { value, dirLoc: d.loc })
      }
    }
  }

  // ── Record-level @crdt_doc_member — and co-occurrence checks.
  for (const def of ast.definitions) {
    if (def.kind !== 'record') continue
    const memberDir = def.directives.find(d => d.name === 'crdt_doc_member')
    if (!memberDir) continue
    const doc = stringArg(memberDir, 'doc')
    const map = stringArg(memberDir, 'map')
    if (doc === null || map === null) continue // missing required args → E023 elsewhere
    members.push({ doc, map, recName: def.name, dirLoc: memberDir.loc })

    // R233: @crdt_doc_member and @scope are mutually exclusive.
    const scopeDir = def.directives.find(d => d.name === 'scope')
    if (scopeDir) {
      memberScopeConflict.push({ doc, recName: def.name, dirLoc: scopeDir.loc })
    }

    // R230: @crdt_doc_member requires @crdt (the directive itself; LWW-vs-key
    // consistency is already E004's job). A member without @crdt has no
    // per-entry merge rule — flag it.
    const crdtDir = def.directives.find(d => d.name === 'crdt')
    if (!crdtDir) {
      out.push(diag('E027', MSG.E027(
        doc,
        `record "${def.name}" carries @crdt_doc_member but no @crdt(type: LWW_MAP, key: ...)`,
      ), memberDir.loc))
    }

    // v0.3.7 — R234: `lww_field` must name an existing record field of
    // type `Timestamp!` or `Int!`. When both `lww_field` and `@crdt(key:)`
    // are present they MUST name the same field.
    const lwwFieldArg = memberDir.args.find(a => a.name === 'lww_field')
    const lwwFieldName = lwwFieldArg && lwwFieldArg.value.kind === 'string'
      ? lwwFieldArg.value.value : null
    if (lwwFieldName !== null) {
      const target = def.fields.find(f => f.name === lwwFieldName)
      if (!target) {
        out.push(diag('E027', MSG.E027(
          doc,
          `lww_field "${lwwFieldName}" does not exist on record "${def.name}"`,
        ), lwwFieldArg!.loc))
      } else {
        const t = target.type
        const isTimestampInt = !t.list && t.required && (t.name === 'Timestamp' || t.name === 'Int')
        if (!isTimestampInt) {
          out.push(diag('E027', MSG.E027(
            doc,
            `lww_field "${lwwFieldName}" on record "${def.name}" must be Timestamp! or Int!`,
          ), lwwFieldArg!.loc))
        }
      }
      if (crdtDir) {
        const crdtKeyArg = crdtDir.args.find(a => a.name === 'key')
        const crdtKeyName = crdtKeyArg && crdtKeyArg.value.kind === 'string'
          ? crdtKeyArg.value.value : null
        if (crdtKeyName !== null && crdtKeyName !== lwwFieldName) {
          out.push(diag('E027', MSG.E027(
            doc,
            `lww_field "${lwwFieldName}" disagrees with @crdt(key: "${crdtKeyName}") on record "${def.name}"`,
          ), lwwFieldArg!.loc))
        }
      }
    }

    // v0.3.9 — R236: hard-delete forbidden. `soft_delete: { flag, ts_field }`
    // is required for `@crdt_doc_member`. Records that genuinely need hard
    // delete must opt out with `@breaking_change(reason: "...")`. The
    // existing R235 shape checks below only run when soft_delete IS
    // supplied — they remain unchanged.
    const softDeleteArg = memberDir.args.find(a => a.name === 'soft_delete')
    const hasBreakingChange = def.directives.some(d => d.name === 'breaking_change')
    if (!softDeleteArg && !hasBreakingChange) {
      out.push(diag('E030', MSG.E030(def.name), memberDir.loc))
    }
    // v0.3.7 — R235: `soft_delete` object shape. `flag` must name a
    // `Boolean!` field; `ts_field` must name a `Timestamp!`/`Int!`
    // field. Both required inside the object.
    if (softDeleteArg && softDeleteArg.value.kind === 'object') {
      const obj = softDeleteArg.value
      const flagField = obj.fields.find(f => f.name === 'flag')
      const tsField = obj.fields.find(f => f.name === 'ts_field')
      const flagName = flagField && flagField.value.kind === 'string'
        ? flagField.value.value : null
      const tsName = tsField && tsField.value.kind === 'string'
        ? tsField.value.value : null
      if (flagName === null) {
        out.push(diag('E027', MSG.E027(
          doc,
          `soft_delete object on record "${def.name}" is missing the "flag" key (expected string)`,
        ), softDeleteArg.loc))
      } else {
        const target = def.fields.find(f => f.name === flagName)
        if (!target) {
          out.push(diag('E027', MSG.E027(
            doc,
            `soft_delete.flag "${flagName}" does not exist on record "${def.name}"`,
          ), flagField!.loc))
        } else if (target.type.name !== 'Boolean' || !target.type.required || target.type.list) {
          out.push(diag('E027', MSG.E027(
            doc,
            `soft_delete.flag "${flagName}" on record "${def.name}" must be Boolean!`,
          ), flagField!.loc))
        }
      }
      if (tsName === null) {
        out.push(diag('E027', MSG.E027(
          doc,
          `soft_delete object on record "${def.name}" is missing the "ts_field" key (expected string)`,
        ), softDeleteArg.loc))
      } else {
        const target = def.fields.find(f => f.name === tsName)
        if (!target) {
          out.push(diag('E027', MSG.E027(
            doc,
            `soft_delete.ts_field "${tsName}" does not exist on record "${def.name}"`,
          ), tsField!.loc))
        } else {
          const t = target.type
          const isTimestampInt = !t.list && t.required && (t.name === 'Timestamp' || t.name === 'Int')
          if (!isTimestampInt) {
            out.push(diag('E027', MSG.E027(
              doc,
              `soft_delete.ts_field "${tsName}" on record "${def.name}" must be Timestamp! or Int!`,
            ), tsField!.loc))
          }
        }
      }
    }
  }

  // ── (a) Every member needs a topic.
  for (const m of members) {
    if (!topics.has(m.doc)) {
      out.push(diag('E027', MSG.E027(
        m.doc,
        `record "${m.recName}" declares @crdt_doc_member but no @crdt_doc_topic(doc: "${m.doc}", ...) exists on the schema`,
      ), m.dirLoc))
    }
  }

  // ── (b) Every topic needs ≥1 member.
  for (const [doc, info] of topics) {
    const hasMember = members.some(m => m.doc === doc)
    if (!hasMember) {
      out.push(diag('E027', MSG.E027(
        doc,
        `@crdt_doc_topic declared but no record carries @crdt_doc_member(doc: "${doc}", ...)`,
      ), info.dirLoc))
    }
  }

  // ── (c) Members sharing a `doc:` cannot collide on `map:` slot.
  const byDoc = new Map<string, MemberRef[]>()
  for (const m of members) {
    if (!byDoc.has(m.doc)) byDoc.set(m.doc, [])
    byDoc.get(m.doc)!.push(m)
  }
  for (const [doc, group] of byDoc) {
    const seenMap = new Map<string, MemberRef>()
    for (const m of group) {
      const prior = seenMap.get(m.map)
      if (prior) {
        out.push(diag('E027', MSG.E027(
          doc,
          `records "${prior.recName}" and "${m.recName}" both claim root map "${m.map}"`,
        ), m.dirLoc))
      } else {
        seenMap.set(m.map, m)
      }
    }
  }

  // ── (c, continued) @crdt_doc_member + @scope is forbidden per R233.
  for (const conflict of memberScopeConflict) {
    out.push(diag('E027', MSG.E027(
      conflict.doc,
      `record "${conflict.recName}" carries both @crdt_doc_member and @scope (R233)`,
    ), conflict.dirLoc))
  }

  // ── (d) Every @schema_version needs a matching topic.
  for (const [doc, info] of schemaVersions) {
    if (!topics.has(doc)) {
      out.push(diag('E027', MSG.E027(
        doc,
        `@schema_version declared but no @crdt_doc_topic(doc: "${doc}", ...) exists`,
      ), info.dirLoc))
    }
  }

  // ── Duplicate @crdt_doc_topic for the same doc — report as an
  // inconsistency.
  for (const dup of duplicateTopics) {
    out.push(diag('E027', MSG.E027(
      dup.doc,
      'multiple @crdt_doc_topic directives for the same document',
    ), dup.dirLoc))
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// v0.3.6 — `Any` placement (E026)
// ─────────────────────────────────────────────────────────────────────────────
//
// `Any` is the SDL's runtime-typed opaque CBOR value (SPEC §4.1). It is
// permitted only in two positions:
//   - as the declared type of a `record` field (caller passes `topLevel:
//     true`);
//   - as the value type of a `Map<K, Any>` (caller recurses into `valueType`
//     with `topLevel: true`).
// Every other position is E026:
//   - list elements (`[Any]`, `[Any!]`, nested lists of Any)
//   - map keys (`Map<Any, V>`)
//   - action input argument types
//   - action output types
//   - event field types

function isAnyTypeRef(t: TypeExprNode): boolean {
  if (t.map) return false
  if (t.list) return isAnyTypeRef(t.inner!)
  return t.name === 'Any'
}

/**
 * Walk a type expression and emit E026 for any `Any` occurrence in a
 * forbidden position. `topLevel` indicates whether the outer type is a
 * permitted host (record field type, Map value type); `where` names the
 * enclosing site for the diagnostic message.
 */
function checkAnyPlacement(
  t: TypeExprNode,
  where: string,
  topLevel: boolean,
  out: Diagnostic[],
): void {
  if (t.map) {
    // Map key: Any forbidden regardless of topLevel.
    if (t.keyType) {
      if (isAnyTypeRef(t.keyType)) {
        out.push(diag('E026', MSG.E026('a Map key'), t.keyType.loc))
      }
      checkAnyPlacement(t.keyType, where, false, out)
    }
    // Map value: Any permitted (this is the canonical allowed position).
    if (t.valueType) {
      // Descend with topLevel=true to allow direct `Map<K, Any>`, but also
      // recurse to catch `Map<K, [Any]>` (list element inside the value).
      checkAnyPlacement(t.valueType, where, true, out)
    }
    return
  }
  if (t.list) {
    // List element: Any forbidden regardless of topLevel (`[Any]`, `[Any!]`,
    // and any deeper nested list of Any all fire E026).
    if (t.inner) {
      if (isAnyTypeRef(t.inner)) {
        out.push(diag('E026', MSG.E026(`a list element in ${where}`), t.inner.loc))
      }
      checkAnyPlacement(t.inner, where, false, out)
    }
    return
  }
  // Bare type.
  if (t.name === 'Any' && !topLevel) {
    out.push(diag('E026', MSG.E026(where), t.loc))
  }
}
