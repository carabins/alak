// @alaq/graph — types: AST, IR, Token, Diagnostic
// Stable interface consumed by generators. Do not break across minor spec versions.

// ────────────────────────────────────────────────────────────────
// Tokens (lexer output)
// ────────────────────────────────────────────────────────────────

export type TokenKind =
  | 'KEYWORD'
  | 'IDENTIFIER'
  | 'STRING_LIT'
  | 'INT_LIT'
  | 'FLOAT_LIT'
  | 'BOOL_LIT'
  | 'LBRACE'
  | 'RBRACE'
  | 'LBRACKET'
  | 'RBRACKET'
  | 'LPAREN'
  | 'RPAREN'
  | 'LT'
  | 'GT'
  | 'COLON'
  | 'COMMA'
  | 'BANG'
  | 'EQ'
  | 'AT'
  /** v0.3.2 (additive): `# ...` line comment. Payload is the comment text with
   *  leading `#` and one optional leading space stripped. Pre-0.3.2 consumers
   *  filtered comments out in the lexer; the parser now skips them but may
   *  harvest them as `leadingComments` on top-level definitions. */
  | 'COMMENT'
  | 'EOF'

export interface Token {
  kind: TokenKind
  value: string
  line: number
  column: number
}

export const KEYWORDS = new Set([
  'schema',
  'record',
  'extend',
  'action',
  'enum',
  'scalar',
  'opaque',
  'stream',
  'use',
  'input',
  'output',
  'scope',
  'version',
  'namespace',
  'qos',
  'max_size',
  // v0.3.4 (W9): `event` as a top-level, strict keyword. Mirrors `record` /
  // `action` in its role — drives structure at file top level and therefore
  // cannot double as a field name. If a user needs a field literally called
  // `event`, they must rename it (same shape as `record` / `action` today).
  'event',
  'true',
  'false',
])

// ────────────────────────────────────────────────────────────────
// AST — shape emitted by parser, consumed by IR builder
// ────────────────────────────────────────────────────────────────

export interface SourceLoc {
  file?: string
  line: number
  column: number
}

export type Value =
  | { kind: 'string'; value: string; loc: SourceLoc }
  | { kind: 'int'; value: number; loc: SourceLoc }
  | { kind: 'float'; value: number; loc: SourceLoc }
  | { kind: 'bool'; value: boolean; loc: SourceLoc }
  | { kind: 'enum'; value: string; loc: SourceLoc }
  | { kind: 'list'; values: Value[]; loc: SourceLoc }

export interface DirectiveArg {
  name: string
  value: Value
  loc: SourceLoc
}

export interface DirectiveNode {
  name: string
  args: DirectiveArg[]
  loc: SourceLoc
}

export interface TypeExprNode {
  /** Base identifier name (for scalar types). For lists this is "List",
   *  for maps this is "Map". */
  name: string
  /** true if outer type ends with `!` */
  required: boolean
  /** true if this is a list `[T]` */
  list: boolean
  /** true if this is a map `Map<K, V>` (v0.3) */
  map?: boolean
  /** For lists: the inner element type */
  inner?: TypeExprNode
  /** For maps: the key type (v0.3) */
  keyType?: TypeExprNode
  /** For maps: the value type (v0.3) */
  valueType?: TypeExprNode
  loc: SourceLoc
}

export interface FieldNode {
  name: string
  type: TypeExprNode
  directives: DirectiveNode[]
  loc: SourceLoc
}

export interface RecordNode {
  kind: 'record'
  name: string
  directives: DirectiveNode[]
  fields: FieldNode[]
  loc: SourceLoc
  /** v0.3.2 (additive): `#`-comments on consecutive lines directly before the
   *  `record` keyword, in source order. Absent (not `[]`) when no leading
   *  comments were attached. A blank line between comment block and keyword
   *  detaches — such comments are dropped per R001. */
  leadingComments?: string[]
}

export interface ExtendRecordNode {
  kind: 'extend'
  name: string
  fields: FieldNode[]
  loc: SourceLoc
  /** v0.3.2 (additive): see RecordNode.leadingComments. */
  leadingComments?: string[]
}

export interface ActionNode {
  kind: 'action'
  name: string
  scope: string | null
  input: FieldNode[] | null
  output: TypeExprNode | null
  loc: SourceLoc
  /** v0.3.2 (additive): see RecordNode.leadingComments. */
  leadingComments?: string[]
}

export interface EnumNode {
  kind: 'enum'
  name: string
  values: string[]
  loc: SourceLoc
  /** v0.3.2 (additive): see RecordNode.leadingComments. */
  leadingComments?: string[]
}

export interface ScalarNode {
  kind: 'scalar'
  name: string
  loc: SourceLoc
  /** v0.3.2 (additive): see RecordNode.leadingComments. */
  leadingComments?: string[]
}

export interface OpaqueNode {
  kind: 'opaque'
  name: string
  qos: string
  maxSize: number | null
  loc: SourceLoc
  /** v0.3.2 (additive): see RecordNode.leadingComments. */
  leadingComments?: string[]
}

/**
 * v0.3.4 (W9): first-class `event Name { … }` declaration.
 *
 * Shape is identical to RecordNode — same field syntax, same directive
 * support — but the keyword is different and the semantics are
 * broadcast/pub-sub, not state. Generators that care about events pick
 * them up from FileAST (or `IRSchema.events`) by kind; generators that
 * don't (e.g. pure state sync) can ignore the category entirely.
 */
export interface EventNode {
  kind: 'event'
  name: string
  directives: DirectiveNode[]
  fields: FieldNode[]
  loc: SourceLoc
  /** v0.3.2 (additive): see RecordNode.leadingComments. */
  leadingComments?: string[]
}

export type Definition =
  | RecordNode
  | ExtendRecordNode
  | ActionNode
  | EnumNode
  | ScalarNode
  | OpaqueNode
  | EventNode

export interface UseDeclNode {
  path: string
  imports: string[]
  loc: SourceLoc
}

export interface SchemaDeclNode {
  name: string
  version: number | null
  namespace: string | null
  loc: SourceLoc
  /** true if `version` key appeared in source */
  hasVersion: boolean
  /** true if `namespace` key appeared in source */
  hasNamespace: boolean
  /** v0.3.4 (additive): directives attached to the schema block itself (e.g.
   *  `@transport(kind: "tauri")` before the `{`). See SPEC §7.14. Absent
   *  (not `[]`) when no schema-level directives are present. */
  directives?: DirectiveNode[]
}

export interface FileAST {
  schema: SchemaDeclNode | null
  uses: UseDeclNode[]
  definitions: Definition[]
}

// ────────────────────────────────────────────────────────────────
// IR — output shape, per §10 JSON Schema
// ────────────────────────────────────────────────────────────────

/**
 * v0.3.3 (additive): literal-kind tag for values in `IRDirective.args`. One of
 * the AST Value discriminators, preserved into IR so generators can tell
 * enum-literals (bare identifiers, per R041) from string-literals without
 * re-resolving the enclosing field's type. Mirrors `Value.kind` exactly, with
 * `enum` renamed to `enum_ref` for IR-level clarity (the IR speaks about
 * references; the AST speaks about literals).
 */
export type IRLiteralKind = 'string' | 'int' | 'float' | 'bool' | 'enum_ref' | 'list'

export interface IRDirective {
  name: string
  args: Record<string, unknown>
  /** v0.3.3 (additive): per-argument literal kind. Present iff the directive
   *  had at least one argument. Keys mirror `args` exactly. Pre-0.3.3 consumers
   *  ignore and recover types by reverse-looking the field. See SPEC §10 and
   *  stress-journal О18. */
  argTypes?: Record<string, IRLiteralKind>
}

/**
 * Nested type reference — used inside map key/value slots in IR. Mirrors
 * the AST's `TypeExprNode` shape but flattened to an IR-safe, JSON-clean
 * structure. Kept intentionally separate from `IRField` so that map
 * children never carry field-only concepts like `name` or `directives`.
 *
 * v0.3: added as part of the Map<K, V> feature. Pre-0.3 IR consumers that
 * ignore `map`/`mapKey`/`mapValue` keep working unchanged.
 */
export interface IRTypeRef {
  /** Base identifier (scalar / record / enum / user scalar / "List" / "Map"). */
  type: string
  required: boolean
  list: boolean
  listItemRequired?: boolean
  /** true when this ref itself is a map. */
  map?: boolean
  mapKey?: IRTypeRef
  mapValue?: IRTypeRef
}

export interface IRField {
  name: string
  type: string
  required: boolean
  list: boolean
  listItemRequired?: boolean
  /** v0.3: true when this field is a Map<K, V>. */
  map?: boolean
  /** v0.3: map key type reference. Present iff `map === true`. */
  mapKey?: IRTypeRef
  /** v0.3: map value type reference. Present iff `map === true`. */
  mapValue?: IRTypeRef
  directives?: IRDirective[]
}

export interface IRRecord {
  name: string
  fields: IRField[]
  directives?: IRDirective[]
  scope?: string | null
  topic?: string | null
  /** v0.3.2 (additive): `#`-comments immediately preceding the declaration in
   *  source, in order. Each entry is one `# ...` line, with the leading `#`
   *  and one optional space stripped; otherwise verbatim (trailing whitespace
   *  trimmed). Absent (not `[]`) when no leading comments were attached.
   *  A blank line between the comment block and the declaration detaches
   *  the comments — they are not emitted. Pre-0.3.2 consumers ignore.
   *
   *  Used as an extension point for generator-defined markers (e.g. Tauri
   *  event/stream hints) without breaking the stable IR shape. The field
   *  itself carries no semantics — it is raw source text. */
  leadingComments?: string[]
}

export interface IRAction {
  name: string
  scope?: string | null
  input?: IRField[]
  output?: string | null
  outputRequired?: boolean
  /** v0.3.1 (additive): true when `output` is a list type `[T]` / `[T!]` /
   *  `[T]!` / `[T!]!`. Absent (or `false`) means scalar output. Generators
   *  needing to emit `Vec<T>` / `T[]` for action results MUST consult this
   *  flag — `output` alone is just the element's base type. */
  outputList?: boolean
  /** v0.3.1 (additive): true when `output` is a list AND the list's element
   *  type carries `!` (i.e. `[T!]` or `[T!]!`). Meaningful only when
   *  `outputList === true`. */
  outputListItemRequired?: boolean
  directives?: IRDirective[]
  /** v0.3.2 (additive): see IRRecord.leadingComments. */
  leadingComments?: string[]
}

export interface IREnum {
  name: string
  values: string[]
  /** v0.3.2 (additive): see IRRecord.leadingComments. */
  leadingComments?: string[]
}

export interface IRScalar {
  name: string
  /** v0.3.2 (additive): see IRRecord.leadingComments. */
  leadingComments?: string[]
}

export interface IROpaque {
  name: string
  qos: string
  maxSize?: number
  /** v0.3.2 (additive): see IRRecord.leadingComments. */
  leadingComments?: string[]
}

/**
 * v0.3.4 (W9): IR shape for `event Name { … }`. Mirrors IRRecord — same
 * fields, same directives, same leadingComments passthrough — but lives on
 * `IRSchema.events` so generators can fan out broadcast emitters without
 * having to re-classify records.
 *
 * Not scoped: events are always broadcast. A future `@scope` on events may
 * be introduced, but v0.3.4 rejects scope directives on events at the
 * validator layer.
 */
export interface IREvent {
  name: string
  fields: IRField[]
  directives?: IRDirective[]
  /** v0.3.2 (additive): see IRRecord.leadingComments. */
  leadingComments?: string[]
}

export interface IRSchema {
  name: string
  namespace: string
  version: number
  records: Record<string, IRRecord>
  actions: Record<string, IRAction>
  enums: Record<string, IREnum>
  scalars: Record<string, IRScalar>
  opaques: Record<string, IROpaque>
  /** v0.3.4 (W9, additive): first-class broadcast-event payloads.
   *
   *  Each entry is a record-shaped payload intended for pub/sub emission:
   *  Tauri `app.emit("snake_name", payload)` / `listen("snake_name", …)`,
   *  Zenoh `ns/events/snake_name` topic. Generators that do not support
   *  broadcast (e.g. HTTP targets) should emit a warning per event and
   *  skip — see SPEC §5.5. Pre-0.3.4 IR consumers ignore the field. */
  events: Record<string, IREvent>
  /** Optional: list of source files that contributed definitions into this
   *  namespace. Populated by the linker; single-file parseSource leaves it
   *  undefined. Purely informational. */
  sourceFiles?: string[]
  /** v0.3.4 (additive, W8): value of `kind` from the schema-level
   *  `@transport(kind: "...")` directive (SPEC §7.14). One of the closed set
   *  `"tauri" | "http" | "zenoh" | "any"`; absent when no `@transport` is
   *  declared (treated as `"any"` for back-compat). Carries no runtime
   *  behavior at the parser level — the parser neither rewires wire mapping
   *  nor rejects generators. Generators consult this to emit W005 when the
   *  schema's intended transport does not match their supported set. */
  transport?: string
  /** v0.3.4 (additive, W8): schema-level directives in source order, mirror
   *  of `IRRecord.directives`. `@transport` is already projected into
   *  `IRSchema.transport` for convenience, but the raw list is preserved so
   *  generators / tooling can walk every schema-level directive uniformly. */
  directives?: IRDirective[]
}

export interface IR {
  schemas: Record<string, IRSchema>
}

// ────────────────────────────────────────────────────────────────
// Diagnostic
// ────────────────────────────────────────────────────────────────

export type DiagnosticCode =
  | 'E001'
  | 'E002'
  | 'E003'
  | 'E004'
  | 'E005'
  | 'E006'
  | 'E007'
  | 'E008'
  | 'E009'
  | 'E010'
  | 'E011'
  | 'E012'
  | 'E013'
  | 'E014'
  | 'E015'
  | 'E016'
  | 'E017'
  | 'E018'
  | 'E019'
  | 'E020'
  | 'E021'
  | 'E022'
  | 'E023'
  /** v0.3.4 (W9): `event` declaration with a disallowed directive (currently
   *  just `@scope` — events are broadcast and not lifecycle-bound). */
  | 'E024'
  /** v0.3.5 (C7): generator-emitted @transport mismatch. Supersedes W005.
   *  On E025 the generator returns `files: []` and a single error
   *  diagnostic. See SPEC §7.14 R221/R224 and §12. */
  | 'E025'
  | 'W001'
  | 'W002'
  | 'W003'
  | 'W004'
  /** v0.3.4 (W8), retired v0.3.5 (C7): superseded by E025. Code retained in
   *  the union so legacy callers that persist historical diagnostics still
   *  type-check; no live code path emits W005 as of v0.3.5. */
  | 'W005'
  // Reserved for generic structural parse errors (lexical / syntactic). Not in §12
  // but needed so the pipeline can report malformed source without crashing.
  | 'E000'

export interface Diagnostic {
  code: DiagnosticCode
  severity: 'error' | 'warning'
  message: string
  file?: string
  line: number
  column: number
}
