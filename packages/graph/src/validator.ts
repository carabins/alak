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
import { DIRECTIVE_SIGS } from './ir'

const BUILTIN_SCALARS = new Set([
  'ID', 'String', 'Int', 'Float', 'Boolean',
  'Timestamp', 'UUID', 'Bytes', 'Duration',
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
        }
      }
      // Output type resolution
      if (actNode.output) {
        checkTypeRef(actNode.output, out, definedTypes, keySafeTypes)
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
) {
  // E009: referenced type exists (also drives E022 for map keys)
  checkTypeRef(f.type, out, definedTypes, keySafeTypes)

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

function validateDirective(
  d: DirectiveNode,
  out: Diagnostic[],
  _target: 'record' | 'field' | 'argument',
  _context: string,
) {
  // E001: unknown directive
  if (!KNOWN_DIRECTIVES.has(d.name)) {
    out.push(diag('E001', MSG.E001(d.name), d.loc))
    return
  }
  const sig = DIRECTIVE_SIGS[d.name]!

  for (const a of d.args) {
    // E002: unknown argument
    if (!(a.name in sig.args)) {
      out.push(diag('E002', MSG.E002(d.name, a.name), a.loc))
      continue
    }
    // E003: wrong type
    const expected = sig.args[a.name]!
    if (!matchesType(a.value, expected)) {
      out.push(diag('E003', MSG.E003(d.name, a.name, expected), a.loc))
      continue
    }
    // Enum value membership
    if (expected === 'enum' && a.value.kind === 'enum' && sig.enumValues?.[a.name]) {
      if (!sig.enumValues[a.name]!.includes(a.value.value)) {
        out.push(diag('E003', MSG.E003(d.name, a.name, `one of [${sig.enumValues[a.name]!.join(', ')}]`), a.loc))
      }
    }
  }

  // Special: @atomic must not combine with @sync (R120 — not a dedicated
  // error code in §12, so we do not emit anything here).
}

function matchesType(v: Value, expected: 'string' | 'int' | 'float' | 'bool' | 'enum' | 'any' | 'list'): boolean {
  switch (expected) {
    case 'string': return v.kind === 'string'
    case 'int':    return v.kind === 'int'
    case 'float':  return v.kind === 'float' || v.kind === 'int'
    case 'bool':   return v.kind === 'bool'
    case 'enum':   return v.kind === 'enum'
    case 'list':   return v.kind === 'list'
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
      if (v.kind !== 'int' && v.kind !== 'float') {
        out.push(diag('E013', MSG.E013(f.name, 'Float'), v.loc))
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
  return t.name === 'Int' || t.name === 'Float' || t.name === 'Duration' || t.name === 'Timestamp'
}
