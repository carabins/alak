// @alaq/graph — FileAST → IR per §10.
//
// Merges `extend record X` into their base records. Directives are flattened
// to {name, args} objects with argument names mapped by directive signature
// (see SIGS below). Unknown directives still produce an IR entry so the
// validator can report E001 without losing the declaration.

import type {
  DirectiveNode,
  FileAST,
  FieldNode,
  IR,
  IRAction,
  IRDirective,
  IREnum,
  IREvent,
  IRField,
  IRLiteralKind,
  IROpaque,
  IRRecord,
  IRScalar,
  IRSchema,
  IRTypeRef,
  TypeExprNode,
  Value,
} from './types'

/** Directive signatures — used for IR flattening and validation.
 *  `undefined` type means "accept anything" (handled by validator). */
export type DirectiveArgType = 'string' | 'int' | 'float' | 'bool' | 'enum' | 'any' | 'list'
export interface DirectiveSignature {
  args: Record<string, DirectiveArgType>
  /** Required argument names — enforced by validator via E023. Args declared
   *  with `!` in SPEC §7 go here. Everything else is optional (may or may not
   *  have a default at generator level, but the compiler does not require it
   *  to appear in source). */
  required?: string[]
  // Enum values are validated when argType is 'enum' or 'enum-or-string'
  enumValues?: Record<string, string[]>
}

// Required-arg lists are derived from SPEC §7:
//   §7.5  @scope(name: String!)
//   §7.8  @default(value: Any)            — value is implicitly required
//                                            (the directive has no meaning
//                                            without a value)
//   §7.9  @liveness(source: String!, timeout: Duration!, on_lost: ... = ...)
//   §7.10 @range(min: Number, max: Number) — both required (R181 presumes
//                                            both bounds; neither has a
//                                            meaningful default)
//   §7.11 @deprecated(since: String!, reason: String)
//   §7.12 @added(in: String!)
//   §7.13 @topic(pattern: String!)
// @sync, @crdt, @auth, @atomic, @this, @store have no required args per SPEC:
//   - @sync: all three args have defaults
//   - @crdt: `key` is required only for LWW_* (enforced by E004, not E023)
//   - @auth: both args default to "public"
//   - @atomic/@this/@store: no args
export const DIRECTIVE_SIGS: Record<string, DirectiveSignature> = {
  sync: {
    args: { qos: 'enum', mode: 'enum', atomic: 'bool' },
    enumValues: {
      qos: ['RELIABLE', 'REALTIME', 'ORDERED_RELIABLE'],
      mode: ['EAGER', 'LAZY'],
    },
  },
  crdt: {
    args: { type: 'enum', key: 'string' },
    enumValues: {
      type: ['LWW_REGISTER', 'LWW_MAP', 'OR_SET', 'G_COUNTER', 'PN_COUNTER', 'RGA'],
    },
  },
  atomic: { args: {} },
  auth: { args: { read: 'string', write: 'string' } },
  scope: { args: { name: 'string' }, required: ['name'] },
  this: { args: {} },
  store: { args: {} },
  default: { args: { value: 'any' }, required: ['value'] },
  liveness: {
    args: { source: 'string', timeout: 'int', on_lost: 'enum' },
    required: ['source', 'timeout'],
    enumValues: {
      on_lost: ['MARK_ABSENT', 'REMOVE', 'EMIT_EVENT'],
    },
  },
  range: { args: { min: 'any', max: 'any' }, required: ['min', 'max'] }, // Number — Int or Float
  deprecated: { args: { since: 'string', reason: 'string' }, required: ['since'] },
  added: { args: { in: 'string' }, required: ['in'] },
  topic: { args: { pattern: 'string' }, required: ['pattern'] },
  // v0.3.4 (W8) — §7.14. Schema-level marker directive. `kind` is a string
  // from a closed set; validator enforces membership in `{tauri, http, zenoh,
  // any}` via `enumValues`. `kind` is typed `'string'` (not `'enum'`) so
  // authors write `@transport(kind: "tauri")`, matching `@auth(read:
  // "public")` style (string literal, closed value set).
  transport: {
    args: { kind: 'string' },
    required: ['kind'],
    enumValues: { kind: ['tauri', 'http', 'zenoh', 'any'] },
  },
}

/** Map AST Value.kind to the IR-level literal-kind tag. See §10. */
function valueKindToLiteralKind(v: Value): IRLiteralKind {
  switch (v.kind) {
    case 'enum': return 'enum_ref'
    default:     return v.kind
  }
}

// Unwrap a Value into its raw JS value (for IR storage).
export function valueToRaw(v: Value): unknown {
  switch (v.kind) {
    case 'string': return v.value
    case 'int':    return v.value
    case 'float':  return v.value
    case 'bool':   return v.value
    case 'enum':   return v.value // stored as bare identifier string
    case 'list':   return v.values.map(valueToRaw)
  }
}

function directiveToIR(d: DirectiveNode): IRDirective {
  const args: Record<string, unknown> = {}
  const argTypes: Record<string, IRLiteralKind> = {}
  for (const a of d.args) {
    args[a.name] = valueToRaw(a.value)
    argTypes[a.name] = valueKindToLiteralKind(a.value)
  }
  const ir: IRDirective = { name: d.name, args }
  // v0.3.3 additive: only emit `argTypes` when there is at least one arg, so
  // arg-less directives keep the pre-0.3.3 on-disk shape exactly. Consumers
  // that ignore `argTypes` continue to work unchanged.
  if (d.args.length > 0) ir.argTypes = argTypes
  return ir
}

function flattenType(t: TypeExprNode): {
  base: string
  required: boolean
  list: boolean
  listItemRequired?: boolean
  map?: boolean
  mapKey?: IRTypeRef
  mapValue?: IRTypeRef
} {
  if (t.map) {
    // Map at outer level. `base` is the string "Map" — kept stable so that
    // IR consumers which inspect .type can special-case it, while the real
    // element types live under mapKey / mapValue.
    return {
      base: 'Map',
      required: t.required,
      list: false,
      map: true,
      mapKey: typeExprToRef(t.keyType!),
      mapValue: typeExprToRef(t.valueType!),
    }
  }
  if (!t.list) {
    return { base: t.name, required: t.required, list: false }
  }
  // List at outer level. The base type is the element type's identifier.
  // For nested lists we still surface the innermost base name; generators
  // that care about nesting should inspect the raw AST if needed. For the
  // v0.2 IR this matches the schema: `type` string + `list` boolean +
  // `listItemRequired` boolean.
  const inner = t.inner!
  // Drill through nested lists for a sensible `base` name.
  let core = inner
  while (core.list && core.inner) core = core.inner
  return {
    base: core.name,
    required: t.required,
    list: true,
    listItemRequired: inner.required,
  }
}

/**
 * Convert an AST TypeExprNode into the IR's stable, JSON-clean IRTypeRef
 * form. Used for map key/value children. Recursively handles nested
 * Map<K, Map<K2, V2>> and List-of-Map compositions.
 */
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

function fieldToIR(f: FieldNode): IRField {
  const flat = flattenType(f.type)
  const ir: IRField = {
    name: f.name,
    type: flat.base,
    required: flat.required,
    list: flat.list,
  }
  if (flat.list) ir.listItemRequired = !!flat.listItemRequired
  if (flat.map) {
    ir.map = true
    ir.mapKey = flat.mapKey
    ir.mapValue = flat.mapValue
  }
  if (f.directives.length) ir.directives = f.directives.map(directiveToIR)
  return ir
}

export function buildIR(ast: FileAST): IR {
  const ir: IR = { schemas: {} }
  if (!ast.schema || !ast.schema.namespace) return ir

  const schemaName = ast.schema.name
  const schema: IRSchema = {
    name: schemaName,
    namespace: ast.schema.namespace,
    version: ast.schema.version ?? 0,
    records: {},
    actions: {},
    enums: {},
    scalars: {},
    opaques: {},
    // v0.3.4 (W9): events live in their own bucket alongside records/actions.
    events: {},
  }
  ir.schemas[ast.schema.namespace] = schema

  // v0.3.4 (W8): schema-level directives. Project `@transport(kind: "...")`
  // into the dedicated `IRSchema.transport` slot and preserve the full
  // directive list on `IRSchema.directives` for generators that want to
  // enumerate uniformly. Directives are additive: parser already only attaches
  // `directives` when at least one exists; we mirror that in IR (absent, not
  // `[]`, when none were written).
  const schemaDirs = ast.schema.directives ?? []
  if (schemaDirs.length > 0) {
    schema.directives = schemaDirs.map(directiveToIR)
    const transportDir = schemaDirs.find(d => d.name === 'transport')
    if (transportDir) {
      const kindArg = transportDir.args.find(a => a.name === 'kind')
      if (kindArg && kindArg.value.kind === 'string') {
        schema.transport = kindArg.value.value
      }
    }
  }

  for (const def of ast.definitions) {
    if (def.kind === 'record') {
      const rec: IRRecord = {
        name: def.name,
        fields: def.fields.map(fieldToIR),
      }
      if (def.directives.length) rec.directives = def.directives.map(directiveToIR)

      // Derive `scope` if @scope is present
      const scopeDir = def.directives.find(d => d.name === 'scope')
      if (scopeDir) {
        const nameArg = scopeDir.args.find(a => a.name === 'name')
        if (nameArg && nameArg.value.kind === 'string') rec.scope = nameArg.value.value
      }
      // Derive `topic` if @topic is present
      const topicDir = def.directives.find(d => d.name === 'topic')
      if (topicDir) {
        const patArg = topicDir.args.find(a => a.name === 'pattern')
        if (patArg && patArg.value.kind === 'string') rec.topic = patArg.value.value
      }
      // v0.3.2 additive: pass through leading `#`-comments for generators.
      if (def.leadingComments && def.leadingComments.length > 0) {
        rec.leadingComments = def.leadingComments.slice()
      }

      if (schema.records[def.name]) {
        // Collision with an earlier record — leave validator to surface a
        // diagnostic via duplicate-field path; for IR we keep the first.
      } else {
        schema.records[def.name] = rec
      }
    } else if (def.kind === 'enum') {
      const existing: IREnum = { name: def.name, values: def.values.slice() }
      if (def.leadingComments && def.leadingComments.length > 0) {
        existing.leadingComments = def.leadingComments.slice()
      }
      schema.enums[def.name] = existing
    } else if (def.kind === 'scalar') {
      const sc: IRScalar = { name: def.name }
      if (def.leadingComments && def.leadingComments.length > 0) {
        sc.leadingComments = def.leadingComments.slice()
      }
      schema.scalars[def.name] = sc
    } else if (def.kind === 'opaque') {
      const op: IROpaque = { name: def.name, qos: def.qos }
      if (def.maxSize !== null) op.maxSize = def.maxSize
      if (def.leadingComments && def.leadingComments.length > 0) {
        op.leadingComments = def.leadingComments.slice()
      }
      schema.opaques[def.name] = op
    } else if (def.kind === 'action') {
      const act: IRAction = { name: def.name }
      if (def.scope !== null) act.scope = def.scope
      if (def.input !== null) act.input = def.input.map(fieldToIR)
      if (def.output !== null) {
        const flat = flattenType(def.output)
        act.output = flat.base
        act.outputRequired = flat.required
        // v0.3.1 additive: preserve list-ness of action output so that
        // generators targeting typed languages (graph-axum, graph-tauri,
        // graph-tauri-rs) can emit `Vec<T>` / `T[]` correctly. Pre-0.3.1 IR
        // consumers ignore the new fields — `output` still carries the
        // element's base type name as before. See §10 Action schema and the
        // stress-journal Arsenal/C.0 finding.
        if (flat.list) {
          act.outputList = true
          act.outputListItemRequired = !!flat.listItemRequired
        }
      }
      if (def.leadingComments && def.leadingComments.length > 0) {
        act.leadingComments = def.leadingComments.slice()
      }
      schema.actions[def.name] = act
    } else if (def.kind === 'extend') {
      // Merge into existing record if present. If not, leave it: validator
      // will emit E011.
      // Note: leadingComments on `extend record` blocks are currently dropped
      // — `extend` only contributes fields into an existing record and the
      // IRRecord already owns its own leadingComments from the base decl.
      // Generators that want comments on extends should consume the AST.
      const target = schema.records[def.name]
      if (!target) continue
      for (const f of def.fields) target.fields.push(fieldToIR(f))
    } else if (def.kind === 'event') {
      // v0.3.4 (W9): first-class broadcast-event payload declaration. Shape
      // mirrors IRRecord exactly — same fields, same directives, same
      // leadingComments passthrough — but stored under `schema.events` so
      // generators fan out pub/sub emitters separately from state records.
      const ev: IREvent = {
        name: def.name,
        fields: def.fields.map(fieldToIR),
      }
      if (def.directives.length) ev.directives = def.directives.map(directiveToIR)
      if (def.leadingComments && def.leadingComments.length > 0) {
        ev.leadingComments = def.leadingComments.slice()
      }
      if (!schema.events[def.name]) {
        schema.events[def.name] = ev
      }
    }
  }

  return ir
}
