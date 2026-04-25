# @alaq/graph — SDL Specification

**Version:** 0.3.8
**Format:** `.aql`
**Status:** normative
**Audience:** compilers, generators, AI agents writing SDL

This document is the single source of truth. Anything not defined here does not exist. Anything ambiguous here is a defect — file an issue.

Companion files (single source of truth for the topic named):

- `./CHANGELOG.md` — SPEC version history (every prior §15 entry).
- `./docs/cookbook.md` — pattern-recipes + intent→syntax index (former §8/§9).
- `./schema/ir.schema.json` — JSON Schema of the IR (former §10).
- `../graph-zenoh/WIRE.md` — wire mapping for the default Tier-2 generator (former §11).

---

## 1. Scope

- **In**: type system, directives, module system, wire contract derivation, IR schema, validation rules.
- **Out**: deployment configuration, identity derivation algorithms, discovery raw bytes, UI contracts, runtime internals.

One `.aql` file declares one `schema` block. One `schema` block owns one namespace. Multiple files may extend the same namespace.

---

## 2. Grammar (EBNF)

```ebnf
File           = SchemaDecl , { UseDecl } , { Definition } ;
SchemaDecl     = "schema" , Identifier , { Directive } , "{" , SchemaField , { SchemaField } , "}" ;
SchemaField    = ( "version" , ":" , IntLit )
               | ( "namespace" , ":" , StringLit ) ;
UseDecl        = "use" , StringLit , "{" , Identifier , { "," , Identifier } , "}" ;

Definition     = RecordDecl | ExtendDecl | ActionDecl | EnumDecl
               | ScalarDecl | OpaqueDecl | EventDecl ;

RecordDecl     = "record" , Identifier , { Directive } , "{" , { Field } , "}" ;
ExtendDecl     = "extend" , "record" , Identifier , "{" , { Field } , "}" ;
Field          = Identifier , ":" , TypeExpr , { Directive } ;

ActionDecl     = "action" , Identifier , "{" , ActionBody , "}" ;
ActionBody     = { ActionField } ;
ActionField    = ( "scope"  , ":" , StringLit )
               | ( "input"  , ":" , "{" , { Field } , "}" )
               | ( "output" , ":" , TypeExpr ) ;

EnumDecl       = "enum" , Identifier , "{" , Identifier , { "," , Identifier } , "}" ;
ScalarDecl     = "scalar" , Identifier ;
OpaqueDecl     = "opaque" , "stream" , Identifier , "{" , OpaqueField , { OpaqueField } , "}" ;
OpaqueField    = ( "qos"      , ":" , QoSValue )
               | ( "max_size" , ":" , IntLit ) ;

EventDecl      = "event" , Identifier , { Directive } , "{" , { Field } , "}" ;

TypeExpr       = ( Identifier | ListType | MapType ) , [ "!" ] ;
ListType       = "[" , TypeExpr , "]" ;
MapType        = "Map" , "<" , TypeExpr , "," , TypeExpr , ">" ;

Directive      = "@" , Identifier , [ "(" , ArgList , ")" ] ;
ArgList        = Arg , { "," , Arg } ;
Arg            = Identifier , ":" , Value ;
Value          = StringLit | IntLit | FloatLit | BoolLit | EnumLit | ListLit | ObjectLit ;
EnumLit        = Identifier ;
ListLit        = "[" , [ Value , { "," , Value } ] , "]" ;
ObjectLit      = "{" , [ Arg , { "," , Arg } ] , "}" ;

QoSValue       = "RELIABLE" | "REALTIME" | "ORDERED_RELIABLE"
               | "best_effort_push" | "reliable_push" | "fire_forget" | "query_response" ;

Identifier     = ( letter | "_" ) , { letter | digit | "_" } ;
StringLit      = '"' , { character } , '"' ;
IntLit         = [ "-" ] , digit , { digit } ;
FloatLit       = [ "-" ] , digit , { digit } , "." , digit , { digit } ;
BoolLit        = "true" | "false" ;

Comment        = "#" , { any-char-except-newline } , newline ;
```

**R001** Comments start with `#` and run to end of line. They are not part of the parse tree. Lexer additionally surfaces comment lines immediately preceding a top-level declaration as `leadingComments: string[]` on the IR node — opaque generator extension point, no built-in semantics.
**R002** Whitespace between tokens is insignificant. Newlines are whitespace.
**R003** Field bodies, action input bodies, and **enum member lists** accept comma-less or comma-separated entries; both are valid. Trailing commas are allowed. One file should use one style.
**R004** `Identifier` pattern: `/^[A-Za-z_][A-Za-z0-9_]*$/`.

### 2.1 Reserved names and contextual keywords

The lexer recognises a fixed set of reserved words. They split into two classes by how the parser treats them.

**Strict keywords** drive top-level structure. They may never appear as a field name, argument name, enum member, or type name. Using one of these as an identifier is a parse error (E000).

| Token | Position |
|-------|----------|
| `schema`, `use`, `record`, `extend`, `action`, `enum`, `scalar`, `opaque`, `stream`, `event`, `true`, `false` | top-level / structural |

**Contextual keywords** are keywords **only inside specific block bodies**. Anywhere else — including field names, argument names, enum members, and the element-type slot of `[T]` / `Map<K, V>` — the parser treats them as ordinary identifiers (R004 pattern).

| Token | Keyword when… |
|-------|--------------|
| `version`   | inside `schema { … }` block — `version: IntLit` |
| `namespace` | inside `schema { … }` block — `namespace: StringLit` |
| `scope`     | inside `action { … }` block — `scope: StringLit` |
| `input`     | inside `action { … }` block — `input: { Field … }` |
| `output`    | inside `action { … }` block — `output: TypeExpr` |
| `qos`       | inside `opaque stream { … }` block — `qos: QoSValue` |
| `max_size`  | inside `opaque stream { … }` block — `max_size: IntLit` |

**R005** Contextual keywords are lexed as `KEYWORD` tokens, but the parser accepts them as identifiers wherever R004 applies — field names, directive argument names, enum members, and type-expression element names. Structural positions (inside `schema`, `action`, `opaque stream` bodies) recognise them as keywords without ambiguity.

**R006** Type names (the identifier after `record`, `action`, `enum`, `scalar`, `opaque stream`) are strict identifiers. A declaration like `record scope { … }` is rejected.

**Examples.**

```
# OK — `version` is contextual; valid here as a field name.
record VersionRef {
  version: String!
  channel: Channel!
}

# OK — contextual keywords as enum members.
enum AdminAction { version, scope, input, namespace }

# OK — contextual keyword as an action-input field name.
action Upload {
  input: { version: String!, platform: Platform! }
  output: UploadTicket!
}

# ERROR — strict keywords cannot be identifiers.
record schema { x: Int! }          # parse error: unexpected keyword "schema"
record R { record: String! }       # parse error: expected identifier, got "record"
```

---

## 3. Literals

| Kind | Form | Example |
|------|------|---------|
| String | Double-quoted | `"room"` |
| Integer | Decimal | `42`, `-7` |
| Float | Decimal with `.` | `3.14` |
| Boolean | Keyword | `true`, `false` |
| Enum value | Bare identifier | `LOBBY` |
| List | Square brackets | `[1, 2, 3]` |
| Object | Brace pairs (directive args only) | `{ flag: "is_deleted", ts_field: "updated_at" }` |

**R010** Enum values are bare identifiers, never quoted.
**R011** String literals use double quotes only. No single quotes, no backticks.
**R012** There is no null literal. Optionality is expressed by absence of `!` on the type.

---

## 4. Types

### 4.1 Built-in scalars

`ID`, `String`, `Int`, `Float`, `Float32`, `Boolean`, `Timestamp`, `UUID`, `Bytes`, `Duration`, `Any`.

- `Float32` — IEEE 754 binary32 (Rust `f32`, JS `Number` with 32-bit precision conversion). Distinct from `Float` (binary64).
- `Timestamp` — integer, Unix milliseconds (i64).
- `Duration` — integer, milliseconds. May be written as `Duration` type with int values.
- `UUID` — canonical 36-character form on wire.
- `Bytes` — opaque byte array.
- `Any` — runtime-typed opaque CBOR value. Intentional escape hatch for payloads whose shape is not known at SDL authoring time. Wire mapping is always CBOR (any CBOR value), regardless of the transport format chosen for the enclosing message; generators emit it as `serde_cbor::Value` in Rust and `unknown` / opaque in TypeScript. `Any` is permitted **only** in these positions: (a) as the value type of a `Map<K, Any>`, (b) as the declared type of a `record` field. `Any` is not permitted in `action` `input`/`output`, in event fields, as a list element, or as a `Map` key — see **E026**. Authors using it take responsibility for out-of-band schema discipline on the CBOR payload.

### 4.2 User-defined scalars

```
scalar DeviceID
```

**R020** A scalar declaration creates an opaque nominal type. Runtime defines derivation, encoding, and validation. The SDL does not describe them.

### 4.3 Type expression

- `T` — optional, nullable on wire
- `T!` — required, not nullable
- `[T]` — optional list of optional `T`
- `[T!]` — optional list of required `T`
- `[T!]!` — required list of required `T`

**R021** Lists may be nested: `[[Float!]!]!`. Parsing is unambiguous by bracket matching.

### 4.4 `record`

A record is a composite type with named fields. Records participate in wire, storage, and UI.

```
record Player {
  id: ID!
  name: String!
  avatar: String
}
```

### 4.5 `extend record`

Adds fields to an existing record. The original record must be in scope (declared in the same file or imported via `use`).

```
extend record GameRoom {
  currentRound: RoundState
}
```

**R030** Multiple `extend record X` blocks may target the same record. Fields are merged. Duplicate field names across `record` and `extend record` declarations are an error (E010).

### 4.6 `enum`

```
enum RoomStatus { LOBBY, GAME_ACTIVE, FINISHED }
```

**R040** Enum members are written without quotes and without prefixes.
**R041** Enum defaults (in `@default`) use bare identifiers: `@default(value: LOBBY)`.

### 4.7 `opaque stream`

A byte-transparent channel. The SDL declares only the envelope; payload format is not described.

```
opaque stream MediaFrames {
  qos: best_effort_push
  max_size: 65536
}
```

**R050** An `opaque stream` has no fields. Generators emit send/receive handlers bound to the topic.

### 4.8 `Map<K, V>`

A built-in type constructor for key-value collections. Mirrors the shape of `Record<K, V>` in TypeScript / `dict[K, V]` in Python / `map<K, V>` in Protobuf.

```
record GameRoom {
  roundVotes:     Map<ID, Map<ID, VoteDir>>!
  wordCountVotes: Map<ID, Int>!
  exclusions:     Map<ID, PlayerExclusion>!
}
```

- `K` — **scalar key** only (built-ins per §4.1, or any user-declared `scalar`). Records, enums, opaques, lists, and maps are not valid keys — see **E022**.
- `V` — any type expression (scalar, record, enum, user scalar, list, or another `Map<...>`).
- Nesting is allowed: `Map<ID, Map<ID, T>>` compiles to nested dictionaries.
- The outer `!` makes the map itself required; the value type's own `!` is respected recursively.
- `Map` is **not** a reserved keyword. The parser recognises it by the literal identifier `Map` followed by `<`.

**R022** The `Map<K, V>` constructor replaces the legacy workaround of flattening maps into list-of-tuple records.

**R023 — inner quantifiers: key is always required, value follows `!`.**

A `Map<K, V>` has two inner type slots, and the `!` quantifier has a fixed reading in each:

- **Key (`K`) — always required.** A map key can never be null in any target (JSON, CBOR, Rust `HashMap`, Python `dict`). The SDL pins this normatively: the key of a `Map<K, V>` is `K!` semantically, whether or not the author typed the `!`. The parser normalises both `Map<String, V>` and `Map<String!, V>` to the same IR (`mapKey.required === true`). Writing `!` on the key is redundant but not an error.
- **Value (`V`) — follows `!`.** `Map<K, V>` means *optional value* (the map may store nulls at a key). `Map<K, V!>` means *required value* — the map never stores nulls. Mirrors the standalone `T` vs `T!` distinction (§4.3).
- **Outer `!`** is unchanged and independent: `Map<K, V>!` is a required map of optional values; `Map<K, V!>!` is required-of-required.

---

## 5. Actions

Actions express side-effectful operations. They are never state.

```
action CreateRoom {
  input: { settings: GameSettings }
  output: ID!
}

action JoinRoom {
  scope: "room"
  input: { name: String! }
  output: Player!
}

action StartGame {
  scope: "room"
}
```

**R060** `input` is a brace-enclosed list of fields. When omitted, the action takes no input.
**R061** `output` is a type expression. When omitted, the action returns nothing (fire-forget).
**R062** `scope` binds the action to a scope (§6). When omitted, the action is global.
**R063** Action names use PascalCase. The generator derives camelCase call-site names (`CreateRoom` → `createRoom`).

---

## 5.5 Events

An **event** is a named, typed broadcast payload. It is declared in parallel with `record` and `action` at the top level of a schema:

```
event DownloadProgress {
  handle: String!
  bytes: Int!
  total: Int!
}

event DownloadFailed {
  handle: String!
  message: String!
}
```

Identical to `RecordDecl` in shape, but the keyword is different and the semantics are broadcast/pub-sub, not state.

**R065** An `event` is a payload declaration for a one-way broadcast. It is not state. It is not a record. It never participates in `extend record` merging.

**R066** The wire name of an event is `snake_case(EventName)`. `DownloadProgress` → `download_progress`.

**R066a** A generator that does not support broadcast events MUST emit a warning per declared event and skip code generation for that event, rather than failing the build.

**R067** Events MUST NOT carry `@scope`. Attempting to do so is **E024**.

**R068** Events MAY carry `@deprecated`, `@added`, `@topic`. They MAY NOT carry `@sync`, `@crdt`, `@atomic`, `@store` — these describe state semantics that do not apply to a one-shot broadcast. Unknown directives emit **E001**.

**R069** The payload fields obey the usual type system (§4). Referenced record / enum / user-scalar types resolve via the same type universe (E009 on missing types).

### Wire mapping (default generators)

| SDL | Wire | Generator |
|-----|------|-----------|
| `event E { … }` (Tauri target) | `app.emit("<snake_name>", payload)` / `listen("<snake_name>", …)` | `@alaq/graph-tauri-rs` / `@alaq/graph-tauri` |
| `event E { … }` (Zenoh target) | Topic `ns/events/<snake_name>`, fire-and-forget put. **[NOT IMPLEMENTED in `@alaq/graph-zenoh` as of v0.3.8 — events-gen is an issue-tracker placeholder, no `events-gen.rs/.ts` exists. R066a applies: the generator emits a warning per event and skips it.]** | `@alaq/graph-zenoh` |
| `event E { … }` (HTTP target)  | *Skipped* with a per-event warning. HTTP is request/response; broadcast events are out-of-surface. | `@alaq/graph-axum` |

### IR

`IRSchema.events: Record<string, IREvent>`. The shape mirrors `IRRecord` — `name`, `fields: IRField[]`, optional `directives`, optional `leadingComments`. Schema for `Event`: `./schema/ir.schema.json`.

---

## 6. Scopes

A scope is a named lifecycle container. Records and actions opt into a scope by name.

```
record GameRoom @scope(name: "room") {
  id: ID!
  status: RoomStatus!
}

action JoinRoom {
  scope: "room"
  input: { name: String! }
  output: Player!
}
```

**R070** A scope is identified by a string name. Scope names are conventions, not types.
**R071** A scope-bound record has an implicit `id: ID!` field used as the scope instance key. If declared explicitly, types must match.
**R072** Scope-bound actions receive the scope instance identifier implicitly at call site. The generator provides a bound call surface (`room.joinRoom(name)` calls the action with `room.id` bound).
**R073** `@alaq/link-state` tracks scoped records with reference counting. Teardown occurs when the last subscriber releases.

Standard scope names (convention, not spec-enforced): `"global"`, `"session"`, `"room"`, `"user"`. Custom scopes are allowed.

---

## 7. Directives

Closed set. Adding a directive requires a spec version bump.

### 7.1 `@sync`

```
@sync(qos: QoS = RELIABLE, mode: SyncMode = EAGER, atomic: Boolean = false) on FIELD | RECORD
```

| Arg | Values | Default |
|-----|--------|---------|
| `qos` | `RELIABLE`, `REALTIME`, `ORDERED_RELIABLE` | `RELIABLE` |
| `mode` | `EAGER`, `LAZY` | `EAGER` |
| `atomic` | `true`, `false` | `false` |

**R100** `@sync` on a field overrides `@sync` on the enclosing record for that field only.
**R101** `@sync(mode: LAZY)` produces a Ghost Proxy in `@alaq/link-state`: access triggers fetch.
**R102** `@sync(atomic: true)` disables deep-diff. The value is serialized and replicated as one unit.

### 7.2 `@crdt`

```
@crdt(type: CrdtType = LWW_REGISTER, key: String) on FIELD | RECORD
```

| Arg | Values |
|-----|--------|
| `type` | `LWW_REGISTER`, `LWW_MAP`, `OR_SET`, `G_COUNTER`, `PN_COUNTER`, `RGA` |
| `key` | Field name used as LWW resolution key (required for `LWW_*`) |

**R110** `@crdt` on a record adds implicit meta-fields if not present: `updated_at: Timestamp!`, `is_deleted: Boolean!`. Generators write them into the record shape.
**R111** `@crdt(type: LWW_*, key: "fieldname")` requires `fieldname` to exist in the record as `Timestamp!` or `Int!`.
**R112** `@crdt` on a field applies to that field's value specifically (use for nested CRDT fields inside non-CRDT records).

### 7.3 `@atomic`

```
@atomic on FIELD | RECORD
```

**R120** `@atomic` is exactly equivalent to `@sync(atomic: true)`. Use `@atomic` for brevity; do not combine with `@sync`. (Single source of truth for the equivalence; do not duplicate elsewhere.)

### 7.4 `@auth`

```
@auth(read: Access = "public", write: Access = "public") on FIELD | RECORD
```

`Access` values (string literals): `"public"`, `"owner"`, `"scope"`, `"server"`.

**R130** `@auth` on a record applies to all fields unless overridden per field.
**R131** `"owner"` means the subject who created the record (determined by runtime).
**R132** `"scope"` means members of the scope (e.g. players in a room).
**R133** `"server"` means only the authoritative runtime, never propagated to clients.

### 7.5 `@scope`

```
@scope(name: String!) on RECORD
```

See §6 for semantics, §17 for what `@scope` deliberately does **not** cover.

**R135** `@scope` is single-axis. Multi-axis → input fields. (See §17.)
**R136** `@scope` is not auth. (See §17.)
**R137** `@scope` is not transport. See §7.14, §17.

### 7.6 `@this`

```
@this on ARGUMENT
```

**R140** `@this` marks an action argument as auto-filled from the current scope identifier. Invalid when the action has no `scope`.

### 7.7 `@store`

```
@store on FIELD | RECORD
```

**R150** Without `@store`, data is ephemeral. With `@store`, the runtime persists it. The persistence mechanism is not described here.

### 7.8 `@default`

```
@default(value: Any) on FIELD | ARGUMENT
```

**R160** `value` must match the declared type:
  - Scalar literal for scalar fields.
  - Bare identifier for enum fields.
  - List literal for list fields.
  - Record/object literals are not supported; use a factory pattern via generator instead.

### 7.9 `@liveness`

```
@liveness(source: String!, timeout: Duration!, on_lost: LivenessAction = MARK_ABSENT) on FIELD | RECORD
```

`LivenessAction` values: `MARK_ABSENT`, `REMOVE`, `EMIT_EVENT`.

**R170** `source` is a runtime-defined heartbeat channel identifier. SDL does not constrain its format.
**R171** `timeout` is a `Duration` (integer ms). Integer literal is accepted: `timeout: 3000`.
**R172** Liveness is observable across the wire and is therefore part of the contract. Generators must emit the presence loop.

### 7.10 `@range`

```
@range(min: Number, max: Number) on FIELD
```

**R180** `@range` applies to `Int` and `Float` fields only.
**R181** Inclusive on both ends.

### 7.11 `@deprecated`

```
@deprecated(since: String!, reason: String) on FIELD | RECORD | ACTION
```

**R190** `since` is a spec or schema version string (e.g. `"2"`, `"1.3"`).
**R191** Deprecated fields remain in generated code. Generators emit warnings on use.

### 7.12 `@added`

```
@added(in: String!) on FIELD | RECORD | ACTION
```

**R200** Documents the schema version when the element first appeared. Used by migration tooling.

### 7.13 `@topic`

```
@topic(pattern: String!) on RECORD | ACTION | OPAQUE
```

**R210** `@topic` overrides the default topic pattern derived from namespace and type name.
**R211** Pattern may contain placeholders `{name}` which are resolved at runtime from scope identifiers and record fields.

### 7.14 `@transport`

```
@transport(kind: String!) on SCHEMA
```

Marks the **intended** transport for the schema. Closed set: `"tauri"`, `"http"`, `"zenoh"`, `"any"`. Default when omitted ≡ `"any"`.

```
schema BelladonnaReader @transport(kind: "tauri") {
  version: 1
  namespace: "belladonna.reader"
}
```

| Rule | Statement |
|------|-----------|
| **R220** | `@transport` appears between the schema name and its opening `{`. The parser projects `kind` into `IRSchema.transport`; the raw directive is also preserved on `IRSchema.directives`. |
| **R221** | `@transport` is **enforced at generation time**. A generator MUST refuse code emission when `IRSchema.transport` is outside its `supportedTransports` list — diagnostic **E025**. The generator returns `files: []` and a single error diagnostic; no partial artifacts. |
| **R222** | A schema without `@transport` behaves as if it declared `@transport(kind: "any")`. Generators MUST treat missing `transport` and explicit `"any"` identically — both suppress E025. |
| **R223** | Adding a value to the closed `kind` set is a spec version bump. Generators implementing a new target declare it in `supportedTransports`. |
| **R224** | E025 refusal contract: `GenerateResult` MUST contain (a) an empty `files` array, (b) exactly one `GenerateDiagnostic` with `severity: "error"` and a message naming schema namespace, declared `kind`, generator, and supported list. |

### 7.15 `@crdt_doc_member`

```
@crdt_doc_member(
  doc: String!,
  map: String!,
  lww_field: String,
  soft_delete: { flag: String!, ts_field: String! }
) on RECORD
```

Opts a record into a **composite CRDT document** — a single Automerge document carrying several named maps at its root. Two or more records sharing the same `doc:` value land in the same wire document, each under its own root key named by `map:`. `@crdt_doc_member` coexists with `@crdt(type: LWW_MAP, key: ...)` on the same record: `@crdt` decides per-entry merge rule, `@crdt_doc_member` decides the *container*.

| Arg | Required | Description |
|-----|----------|-------------|
| `doc` | yes | Document identifier. Records sharing this value compose into one wire Automerge document. |
| `map` | yes | Root-key name inside the Automerge document. Each member record MUST use a distinct `map:` within a given `doc:`. |
| `lww_field` | no | Name of the field (`Timestamp!` or `Int!`) used as LWW resolution key. Falls back to `@crdt(key: ...)`, then `updated_at`. |
| `soft_delete` | no | Object literal `{ flag: String!, ts_field: String! }`. When present, `delete_<map>(id, ts)` writes `flag: true` + `ts_field: ts` into the entry instead of removing the cell. |

**R230** Records that carry `@crdt_doc_member` MUST also carry `@crdt(type: LWW_MAP, key: ...)`. `key` names the timestamp field (`Timestamp!` or `Int!`). Map-on-wire shape: `{<record_id>: <serialised record>}`, where `<record_id>` is the required `ID!`-typed first field.

**R231** All `@crdt_doc_member(doc: X, ...)` records within a schema MUST agree on the wire-topic pattern for document `X`, declared once via `@crdt_doc_topic(doc: X, pattern: ...)` (§7.16). Disagreement → **E027**.

**R232** Values inside the Automerge document are serialised as JSON strings (each map value is `serde_json::to_string(&entry)` rendered into an Automerge string value). Generators MUST NOT change this encoding without a spec version bump.

**R233** A record MAY NOT carry both `@crdt_doc_member` and `@scope`. Composite document is its own lifecycle container. Violation → **E027**.

**R234** When `lww_field` is supplied it MUST name a record field of type `Timestamp!` or `Int!`. When both `lww_field` and `@crdt(key: ...)` are present they MUST refer to the same field; disagreement → **E027**.

**R235** When `soft_delete` is supplied, `flag` must name a `Boolean!` field and `ts_field` must name a `Timestamp!`/`Int!` field. Violations → **E027**. Soft-delete writes `<flag>: true` + `<ts_field>: tombstone_ts` and bumps the LWW key to `tombstone_ts`. When `soft_delete` is absent the delete is a hard delete (`automerge::Map::delete`).

### 7.16 `@crdt_doc_topic`

```
@crdt_doc_topic(doc: String!, pattern: String!) on SCHEMA
```

Declares the Zenoh wire topic for a composite CRDT document (§7.15). Schema-level directive (alongside `@transport`).

```
schema Busynca @transport(kind: "zenoh")
               @crdt_doc_topic(doc: "GroupSync", pattern: "valkyrie/{group}/sync/patch") {
  version: 1
  namespace: "valkyrie"
}
```

**R240** `pattern` follows the placeholder grammar (`{name}`) — placeholders are resolved at runtime.

**R241** For every `@crdt_doc_topic(doc: X, ...)` the schema MUST contain at least one `record` with `@crdt_doc_member(doc: X, ...)`; otherwise **E027** (orphaned topic). Conversely, `@crdt_doc_member(doc: Y, ...)` without a matching `@crdt_doc_topic(doc: Y, ...)` → **E027** (missing topic).

### 7.17 `@schema_version`

```
@schema_version(doc: String!, value: Int!) on SCHEMA
```

Pins an integer `schema_version` into a composite CRDT document (§7.15). The generator emits a root-level `schema_version: Int` field and a load-time guard: on mismatch the document is dropped and re-initialised.

**R250** `@schema_version(doc: X, ...)` is meaningful only when the schema also declares `@crdt_doc_topic(doc: X, ...)`. Otherwise → **E027**.

**R251** Drop-and-rebuild on mismatch is **destructive**. Generators MUST log this at WARN level or equivalent; silent rebuild is non-conformant.

### 7.18 `@rename_case`

```
@rename_case(kind: CaseStyle) on ENUM | RECORD
```

| Arg | Values |
|-----|--------|
| `kind` | `PASCAL`, `CAMEL`, `SNAKE`, `SCREAMING_SNAKE`, `KEBAB`, `LOWER`, `UPPER` |

Selects the wire-name casing for all members of the target. Maps to `#[serde(rename_all = "<X>")]` on the generated Rust enum/struct.

**R260** Default casing **when `@rename_case` is absent** (single source of truth, generator-determined per `@alaq/graph-zenoh`):
- **enum**: `SCREAMING_SNAKE_CASE` (preserves pre-0.3.7 behaviour).
- **record**: no `rename_all` — fields emitted in SDL `snake_case`, with per-field `@rename` overrides where needed.

**R261** The `kind:` argument is validated as a closed set. Values outside the set fire **E003**. Adding a new case style is a spec bump.

| Wire-case `kind` | Generated `#[serde(rename_all = ...)]` |
|------------------|----------------------------------------|
| `PASCAL`            | `"PascalCase"` |
| `CAMEL`             | `"camelCase"` |
| `SNAKE`             | `"snake_case"` |
| `SCREAMING_SNAKE`   | `"SCREAMING_SNAKE_CASE"` |
| `KEBAB`             | `"kebab-case"` |
| `LOWER`             | `"lowercase"` |
| `UPPER`             | `"UPPERCASE"` |

---

## 8. Cookbook

See: `./docs/cookbook.md` — pattern recipes (former §8) and intent→syntax index (former §9).

---

## 10. IR

Generators read IR. The parser emits IR conforming to the JSON Schema in `./schema/ir.schema.json`.

**R300** IR is the sole interface between the parser and generators. Generators never re-parse `.aql`.
**R301** IR field names are stable across minor spec versions. Additive changes may append new optional fields.

### 10.1 Generator metadata (deferred to v0.4)

The historical R500/R501 (`specVersion` stamping in generated code; runtime SPEC compatibility check on connect) are **not implemented** as of 0.3.8. Tracked for v0.4. No generator currently emits `specVersion` and no runtime currently verifies it.

---

## 11. Wire mapping

See: `../graph-zenoh/WIRE.md` — wire contract for the default Tier-2 generator (`@alaq/graph-zenoh`). Wire-mapping is per-generator (per-runtime), not part of the SDL core; this section moves out of SPEC.md to keep the SDL definition transport-neutral.

**R400** (deferred to v0.4) — *Two deployments that use the same generator version against the same `.aql` produce byte-identical wire traffic.* No conformance test currently asserts this; tracked in CHANGELOG `## Deferred`.

**R401** When a field has both record-level and field-level `@sync`, field-level wins (see R100).

---

## 12. Validation rules

Errors halt compilation. Warnings do not.

### Errors

- **E001** Unknown directive name.
- **E002** Directive argument name not in signature.
- **E003** Directive argument value wrong type.
- **E004** `@crdt` type is `LWW_*` but `key` argument missing.
- **E005** `@crdt` `key` references a field that does not exist or is not `Timestamp!`/`Int!`.
- **E006** `@this` on argument of an action without `scope`.
- **E007** Namespace collision: two files declare the same `namespace`.
- **E008** `use` path cannot be resolved.
- **E009** Field type references undefined type.
- **E010** Duplicate field across `record` and/or `extend record`.
- **E011** `extend record X` where `X` is not in scope.
- **E012** Enum default value not a member of the enum.
- **E013** `@default(value: V)` V type does not match field type.
- **E014** Cyclic type dependency without `@sync(mode: LAZY)` break.
- **E015** `@range` on non-numeric field.
- **E016** `@range(min, max)` where `min > max`.
- **E017** Two schemas in one file.
- **E018** Missing required schema field (`namespace` or `version`).
- **E019** Action `scope` declared but no scoped records of that scope exist in the schema graph.
- **E020** Opaque stream declares `max_size` ≤ 0.
- **E021** `use` imports an undeclared name from a module. Triggered when the imported identifier is not declared in the resolved source file. Source of truth: `src/linker.ts:148-164` and `MSG.E021` in `src/errors.ts`.
- **E022** `Map<K, V>` key type is not scalar. Valid keys: built-in scalars (§4.1) and user-declared `scalar`s. Records, enums, opaques, lists, and maps are rejected.
- **E023** Directive is missing a required argument. Required arguments are the ones declared with `!` in §7. The `@crdt(key)`-for-LWW_* case is reported as E004 instead.
- **E024** `event` declaration carries `@scope`. Events are broadcast payloads and are not lifecycle-bound (§5.5 R067).
- **E025** Schema `@transport(kind: ...)` does not match the consuming generator's `supportedTransports` list. Emitted by generators, not the parser/validator. Generation halts: `files: []` + single error diagnostic (§7.14 R221/R224). Set `@transport(kind: "any")` or omit the directive to opt out.
- **E026** `Any` appears in a forbidden position. Valid positions (§4.1): value of a `Map<K, Any>`, or a `record` field.
- **E027** Composite CRDT document (§7.15/§7.16/§7.17) has an inconsistent or incomplete declaration. Triggers (a)–(h) are enumerated in `MSG.E027` body via the `detail` argument.
- **E028** `@rename_case` applied to a declaration that is neither a `record` nor an `enum`.

### Warnings

- **W001** `@sync(qos: REALTIME)` on composite (record-typed) field without `@atomic`.
- **W002** `@store` without explicit `@sync`; defaults to `RELIABLE`.
- **W003** Record has `@crdt` but no `Timestamp!` field named `updated_at`.
- **W004** Directive declared but target does not use it (detected by generator context; advisory only).

(The historical W005 was retired in 0.3.5 and replaced by E025. See `./CHANGELOG.md`.)

---

## 13. Conformance

Conformance suite: see `packages/graph/test/` (parser/linker/validator tests, 40+ cases) and `packages/graph-zenoh/test/` (generator + wire-parity tests including legacy sokol/v1 fixtures).

---

## 14. Full example

Full multi-file example: see `packages/graph/test/__fixtures__/` and `packages/graph-zenoh/test/__fixtures__/` (Kotelok, Busynca, sokol-legacy).

---

## 15. Versioning

Current SPEC version: **0.3.8**.

- **Minor bump** (0.2 → 0.3): new directives, new scalars, new type constructors, new enum values in existing spec enums, new validation codes. Backwards-compatible for existing `.aql`.
- **Major bump** (0.x → 1.0): grammar changes, directive removals, IR breaking changes. Requires migration document.

Full changelog (every prior minor): see `./CHANGELOG.md`.

---

## 16. Definitions

- **Schema** — top-level declaration block introducing a namespace.
- **Namespace** — string prefix owned by a schema, used as topic root.
- **Record** — composite type with named fields.
- **Action** — side-effectful operation; RPC or fire-forget.
- **Scope** — named multi-instance lifecycle container.
- **Directive** — named annotation on a declaration or field.
- **IR** — Intermediate Representation; JSON output of the parser.
- **Wire** — bytes on the network produced by a generator.
- **Generator** — plugin that consumes IR and emits target code.
- **Runtime** — library that executes generated code (`@alaq/link`, `@alaq/link-state`, etc.).
- **Tier** — transport capability level; see `AGENTS.md` and `architecture.yaml`.

---

## 17. Out of scope (SDL limitations)

Normative, single source of truth for "the SDL deliberately does not describe this." Consumers asking "how do I express X in `.aql`?" for any item in this list should expect the answer "you don't — it lives at a different layer."

These are **not** oversights. They are load-bearing boundaries that keep the SDL small.

| Concern | Where it lives instead |
|---------|------------------------|
| **Authentication / authorization** | Transport layer. HTTP middleware for `graph-axum`, Tauri capabilities / command-level checks for `graph-tauri-rs`, per-topic ACL for `graph-zenoh`. Action without `scope` is the correct shape for admin mutations. `@auth` (§7.4) describes **field visibility**, not auth — read/write filter hint, not an identity system. |
| **Transport selection (local vs remote)** | Generator choice. The schema does not *pick* Tauri vs HTTP vs Zenoh; the build pipeline picks the generator. `@transport(kind: ...)` (§7.14) **marks intended transport** so tooling can refuse on mismatch (E025) — it does not rewire wire mapping. Authors pick whichever expression of intent fits: `@transport` for a single surface, split-file (`arsenal.http.aql` + `arsenal.tauri.aql`) when the SDL itself diverges. |
| **UI commands** (window close / minimize / focus / clipboard) | Out of SDL. Not data operations. Handle natively in the host (Tauri window API, DOM, OS). Do not model `CloseWindow` as an `action`. |
| **Byte streams / file uploads / large blobs** | Out-of-band HTTP endpoints or `opaque stream` (§4.7) for byte-transparent channels. Regular `record`-typed actions are not for multi-megabyte payloads. |
| **Event broadcasts** (one-shot, typed payloads) | **In scope.** First-class `event Name { … }` (§5.5). Pub/sub semantics, not state. Supported by `@alaq/graph-tauri-rs` / `@alaq/graph-tauri`; placeholder (no events-gen) in `@alaq/graph-zenoh`; explicitly skipped in `@alaq/graph-axum`. |
| **Streams** (many typed payloads per session) | Out-of-scope. Events cover the one-shot broadcast case; long-running chunked streams continue to live behind `opaque stream` (§4.7). Promoting streams to first-class is a separate spec decision. |
| **Multi-axis scope** (e.g. `channel × admin × region`) | By design. `@scope` is single-axis (§7.5 R135). Additional axes travel as `input` fields with server-side filtering. |
| **Query vs mutation distinction** | Unified under `action`. SDL is codegen+sync, not query. Generators targeting REST pick HTTP verbs by convention or by a future target-specific `@http` directive. |
| **Deployment, observability, logging, tracing** | Separate layers (`@alaq/plugin-logi` for observability; deployment is out of the stack entirely). The SDL has no `@trace`, `@metric`, or `@log` directives. |
| **Persistence backend / storage schema** | `@store` (§7.7) declares *that* persistence happens, not *how*. Runtime picks the backend. SDL does not describe SQL tables, indexes, migrations, or key-value layouts. |
| **Identity derivation** (what is a "user", how is owner computed) | Runtime. `@auth(read: "owner")` references the concept; the algorithm is not in SDL (§1, "Out"). |

**R700** Adding any of these as first-class requires cross-consumer justification + spec bump.
