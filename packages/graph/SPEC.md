# @alaq/graph — SDL Specification

**Version:** 0.3.12
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

> Each directive section starts with a header table. Field **Code** points to the canonical machine declaration in `packages/graph/src/ir.ts → DIRECTIVE_SIGS` — single source of truth. If the table and code disagree, the code wins; file an issue.

### 7.1 `@sync`

| Field   | Value |
|---------|-------|
| Args    | `qos: enum = RELIABLE`, `mode: enum = EAGER`, `atomic: bool = false` |
| Sites   | FIELD \| RECORD |
| Rules   | R100, R101, R102, R401 |
| Errors  | E001, E002, E003 |
| Wire    | `../graph-zenoh/WIRE.md` (rows: `record R @sync(qos: …)`, `field f @sync(qos: REALTIME)`) |
| IR      | `IRRecord.directives[]` / `IRField.directives[]` |
| Code    | `packages/graph/src/ir.ts → DIRECTIVE_SIGS.sync` |
| Since   | v0.1 |

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

| Field   | Value |
|---------|-------|
| Args    | `type: enum = LWW_REGISTER`, `key: string` (required iff `type` is `LWW_*` — E004) |
| Sites   | FIELD \| RECORD |
| Rules   | R110, R111, R112 |
| Errors  | E001, E002, E003, E004, E005, W003 |
| Wire    | `../graph-zenoh/WIRE.md` (rows: `record R @crdt(type: LWW_MAP, …)`, composite-doc rows) |
| IR      | `IRRecord.directives[]` / `IRField.directives[]` |
| Code    | `packages/graph/src/ir.ts → DIRECTIVE_SIGS.crdt` |
| Since   | v0.1 |

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

| Field   | Value |
|---------|-------|
| Args    | (none) |
| Sites   | FIELD \| RECORD |
| Rules   | R120 (single source of truth for `@atomic ≡ @sync(atomic: true)`) |
| Errors  | E001 |
| Wire    | `../graph-zenoh/WIRE.md` (row: `record R @atomic`) |
| IR      | `IRRecord.directives[]` / `IRField.directives[]` |
| Code    | `packages/graph/src/ir.ts → DIRECTIVE_SIGS.atomic` |
| Since   | v0.1 |

```
@atomic on FIELD | RECORD
```

**R120** `@atomic` is exactly equivalent to `@sync(atomic: true)`. Use `@atomic` for brevity; do not combine with `@sync`. (Single source of truth for the equivalence; do not duplicate elsewhere.)

### 7.4 `@auth`

| Field   | Value |
|---------|-------|
| Args    | `read: Access = "public"` (closed set), `write: Access = "public"` (closed set) |
| Sites   | FIELD \| RECORD |
| Rules   | R130, R131, R132, R133 |
| Errors  | E001, E002, E003, E029 |
| Wire    | `../graph-zenoh/WIRE.md` (row: `@auth(read: "owner")`) |
| IR      | `IRRecord.directives[]` / `IRField.directives[]` |
| Code    | `packages/graph/src/ir.ts → DIRECTIVE_SIGS.auth` |
| Since   | v0.1; closed-set enforcement v0.3.9 (DRIFT-1) |

```
@auth(read: Access = "public", write: Access = "public") on FIELD | RECORD
```

`Access` values (string literals): `"public"`, `"owner"`, `"scope"`, `"server"`.

**R130** `@auth` on a record applies to all fields unless overridden per field.
**R131** `"owner"` means the subject who created the record (determined by runtime).
**R132** `"scope"` means members of the scope (e.g. players in a room).
**R133** `"server"` means only the authoritative runtime, never propagated to clients.

### 7.5 `@scope`

| Field   | Value |
|---------|-------|
| Args    | `name: string` (req) |
| Sites   | RECORD |
| Rules   | R135, R136, R137 |
| Errors  | E001, E002, E003, E023 |
| Wire    | `../graph-zenoh/WIRE.md` (row: `record R @scope(name: "room")`) |
| IR      | `IRRecord.directives[]`; projected to `IRRecord.scope` |
| Code    | `packages/graph/src/ir.ts → DIRECTIVE_SIGS.scope` |
| Since   | v0.1 |

```
@scope(name: String!) on RECORD
```

See §6 for semantics, §17 for what `@scope` deliberately does **not** cover.

**R135** `@scope` is single-axis. Multi-axis → input fields. (See §17.)
**R136** `@scope` is not auth. (See §17.)
**R137** `@scope` is not transport. See §7.14, §17.

### 7.6 `@this`

| Field   | Value |
|---------|-------|
| Args    | (none) |
| Sites   | ARGUMENT (action input field) |
| Rules   | R140 |
| Errors  | E001, E006 |
| Wire    | (no direct wire row — argument-binding hint for codegen) |
| IR      | `IRField.directives[]` (on action input fields) |
| Code    | `packages/graph/src/ir.ts → DIRECTIVE_SIGS.this` |
| Since   | v0.1 |

```
@this on ARGUMENT
```

**R140** `@this` marks an action argument as auto-filled from the current scope identifier. Invalid when the action has no `scope`.

### 7.7 `@store`

| Field   | Value |
|---------|-------|
| Args    | (none) |
| Sites   | FIELD \| RECORD |
| Rules   | R150 |
| Errors  | E001, W002 |
| Wire    | `../graph-zenoh/WIRE.md` (row: `@store`) |
| IR      | `IRRecord.directives[]` / `IRField.directives[]` |
| Code    | `packages/graph/src/ir.ts → DIRECTIVE_SIGS.store` |
| Since   | v0.1 |

```
@store on FIELD | RECORD
```

**R150** Without `@store`, data is ephemeral. With `@store`, the runtime persists it. The persistence mechanism is not described here.

### 7.8 `@default`

| Field   | Value |
|---------|-------|
| Args    | `value: any` (req) |
| Sites   | FIELD \| ARGUMENT |
| Rules   | R160 |
| Errors  | E001, E002, E003, E012, E013, E023 |
| Wire    | (no wire row — value is materialised by the runtime, not on wire) |
| IR      | `IRField.directives[]` |
| Code    | `packages/graph/src/ir.ts → DIRECTIVE_SIGS.default` |
| Since   | v0.1 |

```
@default(value: Any) on FIELD | ARGUMENT
```

**R160** `value` must match the declared type:
  - Scalar literal for scalar fields.
  - Bare identifier for enum fields.
  - List literal for list fields.
  - Record/object literals are not supported; use a factory pattern via generator instead.

### 7.9 `@liveness`

| Field   | Value |
|---------|-------|
| Args    | `source: string` (req), `timeout: int` (req), `on_lost: enum = MARK_ABSENT` (`{MARK_ABSENT, REMOVE, EMIT_EVENT}`) |
| Sites   | FIELD \| RECORD |
| Rules   | R170, R171, R172 |
| Errors  | E001, E002, E003, E023 |
| Wire    | `../graph-zenoh/WIRE.md` (row: `@liveness(source, timeout)`) |
| IR      | `IRRecord.directives[]` / `IRField.directives[]` |
| Code    | `packages/graph/src/ir.ts → DIRECTIVE_SIGS.liveness` |
| Since   | v0.1 |

```
@liveness(source: String!, timeout: Duration!, on_lost: LivenessAction = MARK_ABSENT) on FIELD | RECORD
```

`LivenessAction` values: `MARK_ABSENT`, `REMOVE`, `EMIT_EVENT`.

**R170** `source` is a runtime-defined heartbeat channel identifier. SDL does not constrain its format.
**R171** `timeout` is a `Duration` (integer ms). Integer literal is accepted: `timeout: 3000`.
**R172** Liveness is observable across the wire and is therefore part of the contract. Generators must emit the presence loop.

### 7.10 `@range`

| Field   | Value |
|---------|-------|
| Args    | `min: number` (req), `max: number` (req) — Int or Float literal |
| Sites   | FIELD \| ARGUMENT |
| Rules   | R180, R181 |
| Errors  | E001, E002, E003, E015, E016, E023, E029 |
| Wire    | (no wire row — validation hint, runtime-enforced) |
| IR      | `IRField.directives[]` |
| Code    | `packages/graph/src/ir.ts → DIRECTIVE_SIGS.range` |
| Since   | v0.1; explicit `number` arg type + ARGUMENT site v0.3.9 (DRIFT-4) |

```
@range(min: Number, max: Number) on FIELD
```

**R180** `@range` applies to `Int` and `Float` fields only.
**R181** Inclusive on both ends.

### 7.11 `@deprecated`

| Field   | Value |
|---------|-------|
| Args    | `since: string` (req), `reason: string` |
| Sites   | FIELD \| RECORD \| ACTION \| EVENT \| ARGUMENT |
| Rules   | R190, R191 |
| Errors  | E001, E002, E003, E023, E029 |
| Wire    | (no wire row — codegen-time advisory) |
| IR      | `IRRecord.directives[]` / `IRField.directives[]` / `IRAction.directives[]` |
| Code    | `packages/graph/src/ir.ts → DIRECTIVE_SIGS.deprecated` |
| Since   | v0.1; EVENT/ARGUMENT sites added v0.3.9 (Wave 3A site widening) |

```
@deprecated(since: String!, reason: String) on FIELD | RECORD | ACTION
```

**R190** `since` is a spec or schema version string (e.g. `"2"`, `"1.3"`).
**R191** Deprecated fields remain in generated code. Generators emit warnings on use.

### 7.12 `@added`

| Field   | Value |
|---------|-------|
| Args    | `in: string` (req) |
| Sites   | FIELD \| RECORD \| ACTION \| EVENT \| ARGUMENT |
| Rules   | R200 |
| Errors  | E001, E002, E003, E023, E029 |
| Wire    | (no wire row — migration tooling metadata) |
| IR      | `IRRecord.directives[]` / `IRField.directives[]` / `IRAction.directives[]` |
| Code    | `packages/graph/src/ir.ts → DIRECTIVE_SIGS.added` |
| Since   | v0.1; EVENT/ARGUMENT sites added v0.3.9 (Wave 3A site widening) |

```
@added(in: String!) on FIELD | RECORD | ACTION
```

**R200** Documents the schema version when the element first appeared. Used by migration tooling.

### 7.13 `@topic`

| Field   | Value |
|---------|-------|
| Args    | `pattern: string` (req) |
| Sites   | RECORD \| ACTION \| OPAQUE \| EVENT |
| Rules   | R210, R211 |
| Errors  | E001, E002, E003, E023, E029 |
| Wire    | overrides default topic pattern in `../graph-zenoh/WIRE.md` |
| IR      | `IRRecord.directives[]`; projected to `IRRecord.topic` |
| Code    | `packages/graph/src/ir.ts → DIRECTIVE_SIGS.topic` |
| Since   | v0.1; EVENT site added v0.3.9 per R068 (Wave 3A site widening) |

```
@topic(pattern: String!) on RECORD | ACTION | OPAQUE
```

**R210** `@topic` overrides the default topic pattern derived from namespace and type name.
**R211** Pattern may contain placeholders `{name}` which are resolved at runtime from scope identifiers and record fields.

### 7.14 `@transport`

| Field   | Value |
|---------|-------|
| Args    | `kind: string` (req) — closed set `{tauri, http, zenoh, any}` |
| Sites   | SCHEMA (between schema name and opening `{`) |
| Rules   | R220, R221, R222, R223, R224 |
| Errors  | E001, E002, E003, E023, E025 |
| Wire    | governs generator refusal; not a wire-mapping row |
| IR      | `IRSchema.directives[]`; projected to `IRSchema.transport` |
| Code    | `packages/graph/src/ir.ts → DIRECTIVE_SIGS.transport` |
| Since   | v0.3.4 |

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

| Field   | Value |
|---------|-------|
| Args    | `doc: string` (req), `map: string` (req), `soft_delete: object` (req per R236, `{flag: String!, ts_field: String!}`), `lww_field: string` |
| Sites   | RECORD |
| Rules   | R230, R231, R232, R233, R234, R235, R236 |
| Errors  | E001, E002, E003, E023, E027 (a)–(h), E029, E030 |
| Wire    | `../graph-zenoh/WIRE.md` (rows: `@crdt_doc_member`, soft-delete variant) |
| IR      | `IRRecord.directives[]` |
| Code    | `packages/graph/src/ir.ts → DIRECTIVE_SIGS.crdt_doc_member` |
| Since   | v0.3.6; `lww_field` + `soft_delete` added v0.3.7; `soft_delete` becomes required v0.3.9 (R236, opt-out via `@breaking_change`) |

```
@crdt_doc_member(
  doc: String!,
  map: String!,
  soft_delete: { flag: String!, ts_field: String! },  # required (R236)
  lww_field: String
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

**R236 (v0.3.9)** Hard delete is forbidden for `@crdt_doc_member` records. `soft_delete` is **required** by default. Records that genuinely need hard delete (legacy wire contracts, e.g. Busynca `DeviceEntry`) MUST opt out explicitly with `@breaking_change(reason: "...")` (§7.25). Without the opt-out, missing `soft_delete` fires **E030**. Reason: hard delete on a CRDT map is not deterministic across rejoining peers — a peer that missed the delete will re-introduce the entry on next sync. Soft-delete + LWW timestamp is the deterministic floor.

### 7.16 `@crdt_doc_topic`

| Field   | Value |
|---------|-------|
| Args    | `doc: string` (req), `pattern: string` (req) |
| Sites   | SCHEMA (between schema name and opening `{`); may repeat per distinct `doc` |
| Rules   | R240, R241 |
| Errors  | E001, E002, E003, E023, E027 |
| Wire    | declares the Zenoh topic for a composite document; see `../graph-zenoh/WIRE.md` `@crdt_doc_member` row |
| IR      | `IRSchema.directives[]` |
| Code    | `packages/graph/src/ir.ts → DIRECTIVE_SIGS.crdt_doc_topic` |
| Since   | v0.3.6 |

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

| Field   | Value |
|---------|-------|
| Args    | `doc: string` (req), `value: int` (req) |
| Sites   | SCHEMA (between schema name and opening `{`) |
| Rules   | R250, R251 |
| Errors  | E001, E002, E003, E023, E027 |
| Wire    | `../graph-zenoh/WIRE.md` (row: `schema S @schema_version(...)`) |
| IR      | `IRSchema.directives[]` |
| Code    | `packages/graph/src/ir.ts → DIRECTIVE_SIGS.schema_version` |
| Since   | v0.3.6 |

```
@schema_version(doc: String!, value: Int!) on SCHEMA
```

Pins an integer `schema_version` into a composite CRDT document (§7.15). The generator emits a root-level `schema_version: Int` field and a load-time guard: on mismatch the document is dropped and re-initialised.

**R250** `@schema_version(doc: X, ...)` is meaningful only when the schema also declares `@crdt_doc_topic(doc: X, ...)`. Otherwise → **E027**.

**R251** Drop-and-rebuild on mismatch is **destructive**. Generators MUST log this at WARN level or equivalent; silent rebuild is non-conformant.

### 7.18 `@rename_case`

| Field   | Value |
|---------|-------|
| Args    | `kind: enum` (req) — closed set `{PASCAL, CAMEL, SNAKE, SCREAMING_SNAKE, KEBAB, LOWER, UPPER}` |
| Sites   | ENUM \| RECORD |
| Rules   | R260, R261 |
| Errors  | E001, E002, E003, E023, E028 |
| Wire    | `../graph-zenoh/WIRE.md` (rows: `enum E @rename_case`, `record R @rename_case`) |
| IR      | `IREnum.directives[]` / `IRRecord.directives[]` |
| Code    | `packages/graph/src/ir.ts → DIRECTIVE_SIGS.rename_case` |
| Since   | v0.3.7 |

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

### 7.19 `@envelope`

| Field   | Value |
|---------|-------|
| Args    | `kind: enum` (req) — closed set `{snapshot, stream, event, patch, ask}` |
| Sites   | RECORD \| EVENT \| ACTION |
| Rules   | R270, R271, R272 |
| Errors  | E001, E002, E003, E023, E029 |
| Warnings| W008 (override-coherence) |
| Wire    | drives codegen-time defaults (priority, congestion, ordering, retention, crdt_mode) — see Defaults table below |
| IR      | `IRRecord.directives[]` / `IREvent.directives[]` / `IRAction.directives[]` |
| Code    | `packages/graph/src/ir.ts → DIRECTIVE_SIGS.envelope` |
| Since   | v0.3.9 |

```
@envelope(kind: EnvelopeKind!) on RECORD | EVENT | ACTION
```

Single source of truth for QoS, ordering, retention, and CRDT mode. The closed-set `kind` value expands at codegen time into a default tuple of sibling concerns; authors override individual axes with companion directives where needed (W008 fires on incoherent overrides — e.g. `@envelope(stream)` paired with `@crdt(LWW_*)` since `stream` presumes `crdt_mode: none`).

| `kind`    | priority         | congestion  | ordering         | retention             | crdt_mode      |
|-----------|------------------|-------------|------------------|-----------------------|----------------|
| `snapshot`| Data             | BlockFirst  | unordered        | persistent (sled)     | none           |
| `stream`  | RealTime         | Drop        | unordered        | none                  | none           |
| `event`   | Data             | Drop        | unordered        | none                  | none           |
| `patch`   | InteractiveHigh  | BlockFirst  | causal           | append-only           | automerge_doc  |
| `ask`     | InteractiveHigh  | BlockFirst  | request-reply    | none                  | none           |

**R270** Defaults from the table apply at codegen time, not runtime. Generators that do not implement an axis (e.g. an HTTP target with no congestion control) skip silently — the default is advisory unless the author also writes a sibling override.

**R271** Sibling-directive overrides apply per-axis. The author writes the directive that contradicts the preset, generators emit code matching the override; W008 fires when the combination is structurally incoherent (today: `@envelope(stream|event)` paired with `@crdt`/`@crdt_doc_member` — stream/event presets imply `crdt_mode: none`).

**R272** `kind` value identifiers are SNAKE_CASE bare identifiers (R040). Adding a new envelope kind is a spec version bump (closed set).

### 7.20 `@conflict`

| Field   | Value |
|---------|-------|
| Args    | `strategy: enum` (req) — closed set `{lww, operator_review}` |
| Sites   | RECORD (only meaningful with `@crdt_doc_member`) |
| Rules   | R280 |
| Errors  | E001, E002, E003, E023, E029 |
| Wire    | `lww` rides the standard `@crdt(LWW_*)` rules; `operator_review` routes conflicts to a side-channel (UI Кладенец) — see `../graph-zenoh/WIRE.md` |
| IR      | `IRRecord.directives[]` |
| Code    | `packages/graph/src/ir.ts → DIRECTIVE_SIGS.conflict` |
| Since   | v0.3.9 |

```
@conflict(strategy: ConflictStrategy = lww) on RECORD
```

CRDT merge strategy. Default `lww` matches the existing `@crdt(LWW_*)` semantics; `operator_review` is a structural escape hatch for records where automatic merge is unsafe — the runtime queues both sides and surfaces a resolution prompt to the operator UI (Кладенец).

**R280** `@conflict` is meaningful only on records that also carry `@crdt_doc_member`. Standalone `@crdt` records use `@conflict` advisorially (codegen no-op in v0.3.9; reserved for future generators).

### 7.21 `@bootstrap`

| Field   | Value |
|---------|-------|
| Args    | `mode: enum` (req) — closed set `{crdt_sync, full_snapshot}` |
| Sites   | SCHEMA (alongside `@crdt_doc_topic`) |
| Rules   | R290, R291 |
| Errors  | E001, E002, E003, E023, E029 |
| Wire    | governs handshake when a peer connects to a composite document — see `../graph-zenoh/WIRE.md` |
| IR      | `IRSchema.directives[]` |
| Code    | `packages/graph/src/ir.ts → DIRECTIVE_SIGS.bootstrap` |
| Since   | v0.3.9 |

```
@bootstrap(mode: BootstrapMode = crdt_sync) on SCHEMA
```

Composite-document handshake mode. Default `crdt_sync` triggers an Automerge sync handshake on (re)connect — closes the **offline-resurrection bug** where `full_snapshot` mode replays a peer's local-only edits as if they were remote. `full_snapshot` is opt-in for clients that genuinely need a fresh document load (recovery scenarios, debugging).

**R290** `@bootstrap` is meaningful only on schemas that declare at least one `@crdt_doc_topic`. Without composite documents, the directive is a codegen no-op.

**R291** Default mode (`crdt_sync`) is the safe choice for live mesh peers. Switching to `full_snapshot` requires `@breaking_change(reason: ...)` to self-document the divergence.

### 7.22 `@large`

| Field   | Value |
|---------|-------|
| Args    | `threshold_kb: number` (req) |
| Sites   | FIELD (field type MUST be `Bytes` or `Bytes!`) |
| Rules   | R300, R301 |
| Errors  | E001, E002, E003, E023, E029 |
| Wire    | large field rides a sub-topic `<topic>/blob/{blob_id}`; the parent message carries `blob_id` reference — see `../graph-zenoh/WIRE.md` |
| IR      | `IRField.directives[]` |
| Code    | `packages/graph/src/ir.ts → DIRECTIVE_SIGS.large` |
| Since   | v0.3.9 |

```
@large(threshold_kb: Int!) on FIELD
```

Field-level large-blob splitting. The annotated field MUST be `Bytes` or `Bytes!`. When the runtime payload exceeds `threshold_kb` kilobytes, codegen emits a sub-topic publish (`<topic>/blob/{blob_id}`) for the binary payload and replaces the value in the main message with a `blob_id` reference; below the threshold the field rides inline.

**R300** Field type is constrained to `Bytes` / `Bytes!`. Other types fire E029 via the centralised site check (FIELD-only) plus a generator-level type check.

**R301** `threshold_kb` is the inline-vs-blob cutoff in kilobytes. Negative or zero values are rejected at the generator level; the SDL itself accepts any number literal.

### 7.23 `@deprecated_field`

| Field   | Value |
|---------|-------|
| Args    | `replaced_by: string` (optional) |
| Sites   | FIELD |
| Rules   | R310 |
| Errors  | E001, E002, E003, E029 |
| Warnings| W009 |
| Wire    | (no wire row — codegen-time advisory) |
| IR      | `IRField.directives[]` |
| Code    | `packages/graph/src/ir.ts → DIRECTIVE_SIGS.deprecated_field` |
| Since   | v0.3.9 |

```
@deprecated_field(replaced_by: String) on FIELD
```

Soft-deprecation on a field. The field stays in the generated code; codegen emits W009 on the source declaration and advisorially in the generated docstring. Optional `replaced_by:` names the successor field for migration tooling.

**R310** Distinct from `@deprecated(since, reason)` (§7.11): `@deprecated_field` is field-scoped, links to a replacement, and is the marker the v0.4 baseline-checker uses to classify removals as soft (W009) vs. breaking (E031).

### 7.24 `@retired_topic`

| Field   | Value |
|---------|-------|
| Args    | (none) |
| Sites   | SCHEMA |
| Rules   | R320 |
| Errors  | E001, E029 |
| Wire    | governs baseline-checker `@crdt_doc_topic` removal classification |
| IR      | `IRSchema.directives[]` |
| Code    | `packages/graph/src/ir.ts → DIRECTIVE_SIGS.retired_topic` |
| Since   | v0.3.9 |

```
@retired_topic on SCHEMA
```

Marker placed alongside (or in lieu of) a `@crdt_doc_topic` declaration permitting the topic's removal under the backward-compat baseline checker (§12 / E032). Without this marker, removing a previously-declared topic between baseline and HEAD fires E032.

**R320** `@retired_topic` is consumed only by the baseline-checker (B7, deferred to v0.4). At parse time the directive is recognised and validated for shape; no runtime semantics are emitted.

### 7.25 `@breaking_change`

| Field   | Value |
|---------|-------|
| Args    | `reason: string` (req) |
| Sites   | SCHEMA \| RECORD \| FIELD \| EVENT \| ACTION \| ENUM |
| Rules   | R330 |
| Errors  | E001, E002, E003, E023, E029 |
| Wire    | (no wire row — opt-out marker for backward-compat checker) |
| IR      | `IRSchema.directives[]` / record/field/event/action/enum directives |
| Code    | `packages/graph/src/ir.ts → DIRECTIVE_SIGS.breaking_change` |
| Since   | v0.3.9 |

```
@breaking_change(reason: String!) on SCHEMA | RECORD | FIELD | EVENT | ACTION | ENUM
```

Opt-in marker for a wire-incompatible change. `reason:` is required so the diff produced by the baseline-checker self-documents what justified the break. Without `@breaking_change`, structural changes that would invalidate live consumers fire **E031** / **E034** (deferred to v0.4).

Also serves as the **R236 opt-out**: a record carrying `@crdt_doc_member` without `soft_delete` MUST also carry `@breaking_change(reason: ...)` to suppress E030 — the `reason:` documents the legacy contract being preserved (Busynca `DeviceEntry` is the canonical example).

**R330** `reason:` MUST be a non-empty string literal. The baseline-checker (v0.4) renders `reason` text in its diff report.

### 7.26 `@liveliness_token`

| Field   | Value |
|---------|-------|
| Args    | `pattern: string` (req) |
| Sites   | RECORD |
| Rules   | R340, R341 |
| Errors  | E001, E002, E003, E023, E029, E035 |
| Wire    | `../graph-zenoh/WIRE.md` (row: `record R @liveliness_token(pattern: ...)`) |
| IR      | `IRRecord.directives[]` |
| Code    | `packages/graph/src/ir.ts → DIRECTIVE_SIGS.liveliness_token` |
| Since   | v0.3.10 |

```
@liveliness_token(pattern: String!) on RECORD
```

Declares the annotated record as a **presence beacon** atop the Zenoh `liveliness` API. Each producer instance calls `<Record>::declare_alive(...)` (codegen-emitted) which performs `session.liveliness().declare_token(<resolved-pattern>)`; the returned `LivelinessToken` is a Drop-guard. Subscribers call `<Record>::subscribe_alive(...)` and receive `SampleKind::Put` on token appearance and `SampleKind::Delete` on session-keepalive loss (Zenoh tracks this internally — no application-level heartbeat).

`pattern` is a Zenoh key-expression (free-form, no closed set). `{field}` placeholders MUST resolve to fields of the record; missing → **E035**.

**R340** Every `{placeholder}` in `pattern` MUST name a field declared on the annotated record (or merged in via `extend record`). The producer-side codegen reads the field value off the instance to resolve the key; an unresolved placeholder would yield a compile error in the generated Rust. Validator-emitted **E035**.

**R341** Presence records SHOULD be minimal — typically the placeholder fields plus an `id`. Wide presence records (>3 fields) waste session-tracking bandwidth and confuse the role of the record (presence vs. payload). Validator-emitted **W010** (advisory). Move payload data to a sibling record carrying `@envelope(kind: snapshot|stream)`.

`@liveliness_token` is **orthogonal to `@envelope`** (which describes payload QoS) and to `@topic` (which describes the put/sub topic). A presence record may also carry `@envelope` and `@topic` — they govern any sample-payload publishes the consumer chooses to make alongside the liveliness signal. The directive does not imply `crdt_mode`, retention, or ordering.

```aql
record DeviceAlive
  @liveliness_token(pattern: "busynca/v2/{group}/alive/{device_id}") {
  group: String!
  device_id: String!
}
```

### 7.27 `@codegen_target`

| Field   | Value |
|---------|-------|
| Args    | `rust: object` |
| Sites   | SCHEMA |
| Rules   | R350, R351 |
| Errors  | E001, E029 |
| Wire    | none — generator-private knobs do not change wire bytes |
| IR      | `IRSchema.directives[]` |
| Code    | `packages/graph/src/ir.ts → DIRECTIVE_SIGS.codegen_target` |
| Since   | v0.3.12 |

```
@codegen_target(rust: { emit_pubsub: Bool }) on SCHEMA
```

Schema-level escape hatch for **generator-target-specific knobs** that are not part of the wire vocabulary. Each top-level argument names a target (today: `rust:`); its value is an object literal of generator-private settings. Targets the directive does not name use defaults.

The directive **MUST NOT** alter wire bytes — generators that consume it adjust shape of the emitted module (which helpers exist, which imports are present), not the bytes that go on Zenoh. Consumers that round-trip data through the generator output are unaffected.

**R350** Outer arg names form a closed set per SPEC version. v0.3.11 defines exactly one: `rust:` (consumed by `@alaq/graph-zenoh`). Adding a new target arg is a SPEC version bump. Unknown outer args → **E001** (unknown directive arg).

**R351** Inner-object keys are **not** validated by the SDL parser/validator — each generator owns the shape of its own knob bag. Unknown inner keys are silently ignored (forward-compat: an SDL author writing for a newer generator must remain parseable by older ones). Generators MUST document their accepted inner keys in their own README.

#### Rust knobs (`@alaq/graph-zenoh`)

| Inner key      | Type | Default | Meaning |
|----------------|------|---------|---------|
| `emit_pubsub`  | Bool | `true`  | When `false`: skip every `zenoh::Session`-using helper (per-record `publish_*`/`subscribe_*`, composite-doc pub/sub, `@liveliness_token` declare/subscribe, action `call_*`), drop `use zenoh::*` + `use std::sync::Arc;` imports, and drop zenoh + tokio from the Cargo dep-list / footer. Types, scalars, enums, CRDT-doc wrappers, `*Event` enums and `emit_*_diffs` / `merge_remote_with_events` survive — they never touch `zenoh::Session`. |

Use case: a downstream crate has its own pub/sub layer (e.g. Бусинка's `BusyncaNode`) and wants the generator's types but not its wire helpers. Without this directive the only options were to hand-strip the generator output after every regen (drift-prone) or fork the generator (worse).

```aql
schema BusyncaProtocol @transport(kind: "zenoh")
                       @codegen_target(rust: { emit_pubsub: false })
                       @crdt_doc_topic(doc: "GroupSync", pattern: "busynca/v2/{group}/sync/patch")
                       @schema_version(doc: "GroupSync", value: 2) {
  version: 1
  namespace: "busynca"
}
```

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
- **E029** (v0.3.9) Centralised site validation. Generic fall-back when a directive appears at a site outside its declared `DirectiveSignature.sites`. E028 / E006 / E024 keep tailored messages and fire alongside E029 only where they were already defined; new directives get site validation for free.
- **E030** (v0.3.9 — R236) Hard-delete forbidden on `@crdt_doc_member`. `soft_delete: { flag, ts_field }` is required by default; opt out with `@breaking_change(reason: ...)` (§7.25) for legacy wire contracts.
- **E031** *(deferred to v0.4 — baseline-checker stub)* Required field type changed in a wire-incompatible way without `@breaking_change`. CLI flag `aqc build --baseline=<git-ref>` accepts the option today and emits a stub advisory; full IR-vs-baseline diff lands in v0.4.
- **E032** *(deferred to v0.4 — baseline-checker stub)* `@crdt_doc_topic(doc: ...)` removed from the schema between baseline and HEAD without `@retired_topic` (§7.24).
- **E033** *(deferred to v0.4 — baseline-checker stub)* `@schema_version(doc: ...)` downgraded between baseline and HEAD.
- **E034** *(deferred to v0.4 — baseline-checker stub)* `@rename_case(kind: ...)` value changed between baseline and HEAD without `@breaking_change`.
- **E035** (v0.3.10 — R340) `@liveliness_token.pattern` references a `{placeholder}` that does not name a field of the annotated record. Producer-side codegen resolves placeholders against the record instance, so each one MUST be a real field.

### Warnings

- **W001** `@sync(qos: REALTIME)` on composite (record-typed) field without `@atomic`.
- **W002** `@store` without explicit `@sync`; defaults to `RELIABLE`.
- **W003** Record has `@crdt` but no `Timestamp!` field named `updated_at`.
- **W004** Directive declared but target does not use it (detected by generator context; advisory only).
- **W007** *(deferred to v0.4 — baseline-checker stub)* Optional field added in the middle of a record between baseline and HEAD. CBOR-map wire (keyed by name) tolerates positional additions; array-frozen consumers (legacy fixtures) break. Append at end or use `@breaking_change`.
- **W008** (v0.3.9) `@envelope` override-coherence. The preset expansion implies a default for each axis (priority, congestion, ordering, retention, crdt_mode); when a sibling directive contradicts the preset, W008 fires. Today the only structural check is `@envelope(stream|event)` paired with `@crdt`/`@crdt_doc_member` (preset implies `crdt_mode: none`); other axes are deferred to v0.4 alongside their sibling directives.
- **W009** (v0.3.9) Field annotated with `@deprecated_field`; codegen emits the advisory at the source declaration and inside the generated docstring. The `replaced_by:` argument, when supplied, is rendered as a migration pointer.
- **W010** (v0.3.10 — R341) Presence record carrying `@liveliness_token` declares more than 3 fields. Advisory: presence records should be minimal (id + placeholder fields). Move payload data to a sibling record carrying `@envelope(kind: snapshot|stream)`.

(The historical W005 was retired in 0.3.5 and replaced by E025. See `./CHANGELOG.md`.)

---

## 13. Conformance

Conformance suite: see `packages/graph/test/` (parser/linker/validator tests, 40+ cases) and `packages/graph-zenoh/test/` (generator + wire-parity tests including legacy sokol/v1 fixtures).

---

## 14. Full example

Full multi-file example: see `packages/graph/test/__fixtures__/` and `packages/graph-zenoh/test/__fixtures__/` (Kotelok, Busynca, sokol-legacy).

---

## 15. Versioning

Current SPEC version: **0.3.12**.

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
