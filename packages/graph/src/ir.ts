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
 *
 *  Two forms accepted in `args`:
 *    1. legacy `DirectiveArgType` — bare type tag (`'string'`, `'int'`, …).
 *       Closed-set membership and conditional-required still live in
 *       sibling fields (`enumValues`, `required`) on the signature.
 *    2. rich `ArgSpec` object — `{ type, enumValues?, requiredIf? }`. Lets a
 *       single argument carry its own enum-set or conditional-required
 *       predicate without lifting them onto the signature. Validator reads
 *       both forms and merges (signature-level fields still apply when
 *       both are set).
 *
 *  `'any'` means "accept anything" — runtime-shaped value, handled by the
 *  validator's per-context checks (e.g. `@default` matches the field type).
 */
export type DirectiveArgType = 'string' | 'int' | 'float' | 'number' | 'bool' | 'enum' | 'any' | 'list' | 'object'
export type ArgSpec =
  | { type: 'string', enumValues?: string[], requiredIf?: (otherArgs: Record<string, unknown>) => boolean }
  | { type: 'int',    requiredIf?: (otherArgs: Record<string, unknown>) => boolean }
  | { type: 'float',  requiredIf?: (otherArgs: Record<string, unknown>) => boolean }
  | { type: 'number', requiredIf?: (otherArgs: Record<string, unknown>) => boolean }
  | { type: 'bool',   requiredIf?: (otherArgs: Record<string, unknown>) => boolean }
  | { type: 'enum',   enumValues?: string[], requiredIf?: (otherArgs: Record<string, unknown>) => boolean }
  | { type: 'any',    requiredIf?: (otherArgs: Record<string, unknown>) => boolean }
  | { type: 'list',   requiredIf?: (otherArgs: Record<string, unknown>) => boolean }
  | { type: 'object', requiredIf?: (otherArgs: Record<string, unknown>) => boolean }

/** Where a directive may appear. Validator runs a single `checkSite()` pass
 *  per directive node; the existing context-specific diagnostics (E028, E024)
 *  remain for nicer messages. Declared in SPEC §7.x header tables (Sites
 *  row); the directive signature is the single source of truth for code. */
export type Site =
  | 'SCHEMA'
  | 'RECORD'
  | 'FIELD'
  | 'ENUM'
  | 'ENUM_VALUE'
  | 'ARGUMENT'
  | 'EVENT'
  | 'ACTION'
  | 'OPAQUE'

export interface DirectiveSignature {
  /** Per-arg type. Either a bare type tag or a richer `ArgSpec`. Mixed shapes
   *  in the same signature are allowed. */
  args: Record<string, DirectiveArgType | ArgSpec>
  /** Required argument names — enforced by validator via E023. Args declared
   *  with `!` in SPEC §7 go here. Everything else is optional (may or may not
   *  have a default at generator level, but the compiler does not require it
   *  to appear in source). For conditional-required arguments use
   *  `requiredIf` on the per-arg `ArgSpec` instead (`@crdt.key` style). */
  required?: string[]
  /** Closed-set enum values for selected args. Mirrors `ArgSpec.enumValues`
   *  but at the signature level — kept for back-compat with pre-0.3.9
   *  signatures. New code should put the set into the per-arg `ArgSpec`. */
  enumValues?: Record<string, string[]>
  /** Where this directive may appear. Single source of truth for site
   *  validation. Empty / unset is treated as "any site" (transitional —
   *  every directive in 0.3.9+ declares this field). */
  sites?: Site[]
}

/** Resolve a signature arg to its bare type tag, regardless of whether it
 *  was declared in legacy or rich form. */
export function argType(spec: DirectiveArgType | ArgSpec): DirectiveArgType {
  return typeof spec === 'string' ? spec : spec.type
}

/** Resolve a signature arg's closed-set values (signature-level wins iff
 *  defined; per-arg `ArgSpec.enumValues` is the fallback). */
export function argEnumValues(
  sig: DirectiveSignature,
  argName: string,
): string[] | undefined {
  if (sig.enumValues?.[argName]) return sig.enumValues[argName]
  const spec = sig.args[argName]
  if (typeof spec === 'object' && (spec.type === 'string' || spec.type === 'enum')) {
    return spec.enumValues
  }
  return undefined
}

/** Resolve a signature arg's `requiredIf` predicate, if any. */
export function argRequiredIf(
  sig: DirectiveSignature,
  argName: string,
): ((otherArgs: Record<string, unknown>) => boolean) | undefined {
  const spec = sig.args[argName]
  if (typeof spec === 'object') return spec.requiredIf
  return undefined
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
// @sync, @crdt, @auth, @atomic, @this, @store have no signature-level
// required args:
//   - @sync: all three args have defaults
//   - @crdt: `key` is required only for LWW_* — encoded as a per-arg
//            `requiredIf` predicate (closes DRIFT-3 from Wave 2). Validator
//            still emits E004 with its tailored message; E023 is a fallback
//            when the predicate fires for any future LWW_* variant.
//   - @auth: both args default to "public"; closed-set `Access` values
//            `{public, owner, scope, server}` enforced via per-arg
//            `enumValues` (closes DRIFT-1 from Wave 2).
//   - @atomic/@this/@store: no args
export const DIRECTIVE_SIGS: Record<string, DirectiveSignature> = {
  sync: {
    args: { qos: 'enum', mode: 'enum', atomic: 'bool' },
    enumValues: {
      qos: ['RELIABLE', 'REALTIME', 'ORDERED_RELIABLE'],
      mode: ['EAGER', 'LAZY'],
    },
    sites: ['FIELD', 'RECORD'],
  },
  crdt: {
    args: {
      type: 'enum',
      // DRIFT-3: `key` is required iff `type` starts with `LWW_`.
      // Predicate keeps the rule next to the arg; validator surfaces E004
      // with the dedicated "@crdt(type: LWW_*) requires key" message and
      // skips the generic E023 to avoid double-reporting (see validator
      // `validateDirective`).
      key: { type: 'string', requiredIf: (a) => typeof a.type === 'string' && /^LWW_/.test(a.type) },
    },
    enumValues: {
      type: ['LWW_REGISTER', 'LWW_MAP', 'OR_SET', 'G_COUNTER', 'PN_COUNTER', 'RGA'],
    },
    sites: ['FIELD', 'RECORD'],
  },
  atomic: { args: {}, sites: ['FIELD', 'RECORD'] },
  // DRIFT-1: closed-set `Access` for `@auth.read/write`. Mismatch → E003 via
  // the same string-membership path used by `@transport(kind: ...)`.
  auth: {
    args: {
      read:  { type: 'string', enumValues: ['public', 'owner', 'scope', 'server'] },
      write: { type: 'string', enumValues: ['public', 'owner', 'scope', 'server'] },
    },
    sites: ['FIELD', 'RECORD'],
  },
  scope: { args: { name: 'string' }, required: ['name'], sites: ['RECORD'] },
  this: { args: {}, sites: ['ARGUMENT'] },
  store: { args: {}, sites: ['FIELD', 'RECORD'] },
  default: { args: { value: 'any' }, required: ['value'], sites: ['FIELD', 'ARGUMENT'] },
  liveness: {
    args: { source: 'string', timeout: 'int', on_lost: 'enum' },
    required: ['source', 'timeout'],
    enumValues: {
      on_lost: ['MARK_ABSENT', 'REMOVE', 'EMIT_EVENT'],
    },
    sites: ['FIELD', 'RECORD'],
  },
  // DRIFT-4: `@range(min, max)` are explicitly numeric (Int or Float).
  // `'number'` matches either (E003 message says "number"); per-field type
  // compatibility (R180) still emits E015 separately. Sites widened to
  // ARGUMENT — action input arguments accept `@range` for input validation
  // (real-world usage in `pharos/Belladonna/schema/reader.aql`); SPEC §7.10
  // header now reflects this.
  range: { args: { min: 'number', max: 'number' }, required: ['min', 'max'], sites: ['FIELD', 'ARGUMENT'] },
  // SPEC R068 explicitly allows `@deprecated` / `@added` on events; sites
  // widened to EVENT to match. Argument placement (action input field) is
  // also accepted in real-world schemas.
  deprecated: { args: { since: 'string', reason: 'string' }, required: ['since'], sites: ['FIELD', 'RECORD', 'ACTION', 'EVENT', 'ARGUMENT'] },
  added: { args: { in: 'string' }, required: ['in'], sites: ['FIELD', 'RECORD', 'ACTION', 'EVENT', 'ARGUMENT'] },
  // `@topic` on events is allowed by R068 (event payload may carry @topic to
  // override the default snake_case derivation). Sites widened to EVENT.
  topic: { args: { pattern: 'string' }, required: ['pattern'], sites: ['RECORD', 'ACTION', 'OPAQUE', 'EVENT'] },
  // v0.3.4 (W8) — §7.14. Schema-level marker directive. `kind` is a string
  // from a closed set; validator enforces membership in `{tauri, http, zenoh,
  // any}` via `enumValues`. `kind` is typed `'string'` (not `'enum'`) so
  // authors write `@transport(kind: "tauri")`, matching `@auth(read:
  // "public")` style (string literal, closed value set).
  transport: {
    args: { kind: 'string' },
    required: ['kind'],
    enumValues: { kind: ['tauri', 'http', 'zenoh', 'any'] },
    sites: ['SCHEMA'],
  },
  // v0.3.6 — §7.15. Record-level directive opting a record into a composite
  // CRDT Automerge document. `doc` names the document; `map` is the root-key
  // inside that document under which the record's entries are stored. Both
  // required. v0.3.7 adds `lww_field` (optional — override / fallback for
  // @crdt(key:)) and `soft_delete` (optional — tombstone-by-flag). Shape
  // consistency (field types, soft_delete object shape) lives in the
  // validator (E027), not in the signature.
  // v0.3.9 — R236: hard-delete is forbidden for composite-document members.
  // `soft_delete: { flag, ts_field }` MUST be present; missing → E030
  // (validator-emitted, with a tailored message). The signature keeps
  // `required: ['doc', 'map']` so that the generic E023 path stays focused
  // on directives whose `!`-required args are actually optional in
  // pre-0.3.9 schemas; E030 is the upgrade signal for the corpus.
  crdt_doc_member: {
    args: {
      doc: 'string',
      map: 'string',
      lww_field: 'string',
      soft_delete: 'object',
    },
    required: ['doc', 'map'],
    sites: ['RECORD'],
  },
  // v0.3.6 — §7.16. Schema-level directive declaring the Zenoh wire topic
  // for a composite CRDT document. Placement is the same as @transport —
  // between the schema name and the opening `{`. A schema may carry multiple
  // @crdt_doc_topic directives, one per distinct `doc:`.
  crdt_doc_topic: {
    args: { doc: 'string', pattern: 'string' },
    required: ['doc', 'pattern'],
    sites: ['SCHEMA'],
  },
  // v0.3.6 — §7.17. Schema-level directive pinning an integer schema_version
  // into a composite CRDT document. On load-time mismatch the document is
  // dropped and re-initialised (R251: destructive, MUST be logged).
  schema_version: {
    args: { doc: 'string', value: 'int' },
    required: ['doc', 'value'],
    sites: ['SCHEMA'],
  },
  // v0.3.7 — §7.18. ENUM | RECORD. Emits `#[serde(rename_all = "<kind>")]`
  // on the generated Rust type. Closed-set `kind:` matches the Rust serde
  // `rename_all` vocabulary. Validator (E028) rejects `@rename_case` on
  // anything other than enum or record.
  rename_case: {
    args: { kind: 'enum' },
    required: ['kind'],
    enumValues: {
      kind: ['PASCAL', 'CAMEL', 'SNAKE', 'SCREAMING_SNAKE', 'KEBAB', 'LOWER', 'UPPER'],
    },
    sites: ['ENUM', 'RECORD'],
  },
  // v0.3.9 — §7.19. Single source of truth for QoS/ordering/retention/CRDT
  // mode for a record / event / action. Closed-set `kind:`. Each preset
  // expands at codegen-time into a default tuple (priority, congestion,
  // ordering, retention, crdt_mode) — see SPEC §7.19 Defaults table. Author
  // overrides with sibling directives still apply; W008 fires on incoherent
  // combinations (e.g. `@envelope(stream)` + `@congestion(block_first)`).
  envelope: {
    args: { kind: 'enum' },
    required: ['kind'],
    enumValues: {
      kind: ['snapshot', 'stream', 'event', 'patch', 'ask'],
    },
    sites: ['RECORD', 'EVENT', 'ACTION'],
  },
  // v0.3.9 — §7.20. CRDT merge strategy. Closed-set `strategy:`. Default
  // `lww` matches existing @crdt(LWW_*) behaviour; `operator_review` routes
  // conflicts through a side-channel surfaced to UI Кладенец. Validator
  // E027 will reject `@conflict` on records that lack `@crdt_doc_member`.
  conflict: {
    args: { strategy: 'enum' },
    required: ['strategy'],
    enumValues: {
      strategy: ['lww', 'operator_review'],
    },
    sites: ['RECORD'],
  },
  // v0.3.9 — §7.21. Composite-document handshake mode. Closed-set `mode:`.
  // Default `crdt_sync` triggers Automerge sync handshake on (re)connect —
  // closes the offline-resurrection bug where `full_snapshot` would replay
  // local-only edits as if remote. `full_snapshot` is opt-in for clients
  // that genuinely need a fresh document load. Schema-level (placed beside
  // `@crdt_doc_topic`).
  bootstrap: {
    args: { mode: 'enum' },
    required: ['mode'],
    enumValues: {
      mode: ['crdt_sync', 'full_snapshot'],
    },
    sites: ['SCHEMA'],
  },
  // v0.3.9 — §7.22. Field-level large-blob splitting. The annotated field
  // MUST be `Bytes` or `Bytes!`; codegen emits a sub-topic
  // `<topic>/blob/{blob_id}` for the binary payload and replaces the
  // value in the main message with a `blob_id` reference. `threshold_kb`
  // is the inline-vs-blob cutoff (below it, the field rides inline).
  large: {
    args: { threshold_kb: 'number' },
    required: ['threshold_kb'],
    sites: ['FIELD'],
  },
  // v0.3.9 — §7.23. Soft-deprecation marker on a field. Field stays in the
  // generated code; codegen emits warning W009 on use. Optional
  // `replaced_by:` names the successor field so docs/codegen can render a
  // pointer. Distinct from the legacy `@deprecated(since, reason)`: this
  // one is field-scoped and links to a replacement, not a removal.
  deprecated_field: {
    args: { replaced_by: 'string' },
    sites: ['FIELD'],
  },
  // v0.3.9 — §7.24. Marker on a `@crdt_doc_topic` declaration permitting
  // its removal under the backward-compat baseline checker (B7). Without
  // this marker, removing a previously-declared topic fires E032.
  retired_topic: {
    args: {},
    sites: ['SCHEMA'],
  },
  // v0.3.9 — §7.25. Opt-in for a wire-incompatible change. `reason:` is
  // required so the diff produced by the baseline checker self-documents
  // what justified the break. Without `@breaking_change`, structural
  // changes that would invalidate live consumers fire E031 / E034.
  breaking_change: {
    args: { reason: 'string' },
    required: ['reason'],
    sites: ['SCHEMA', 'RECORD', 'FIELD', 'EVENT', 'ACTION', 'ENUM'],
  },
  // v0.3.10 — §7.26. Record-level presence-token declaration on top of the
  // Zenoh `liveliness` API. `pattern:` is a Zenoh key-expression with
  // `{field}` placeholders that MUST resolve to fields of the annotated
  // record. Codegen-zenoh emits `<Record>::declare_token(session, ctx)` and
  // `<Record>::subscribe_alive(session, callback)` — peers receive a `PUT`
  // SampleKind on appearance, `DELETE` on session-keepalive loss. Missing
  // placeholder field → E035; wide presence record (>3 fields) → W010
  // advisory. Orthogonal to `@envelope` (envelope is payload QoS, liveliness
  // is session-tracking).
  liveliness_token: {
    args: { pattern: 'string' },
    required: ['pattern'],
    sites: ['RECORD'],
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
    // v0.3.7 — object-literal value: flatten to a plain JS record for IR.
    // Duplicate keys inside the same object are left as-is (last-wins);
    // generators that care can re-inspect argTypes to detect collisions.
    case 'object': {
      const out: Record<string, unknown> = {}
      for (const f of v.fields) out[f.name] = valueToRaw(f.value)
      return out
    }
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
      // v0.3.7 — project enum-level directives into IR.
      if (def.directives && def.directives.length > 0) {
        existing.directives = def.directives.map(directiveToIR)
      }
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
