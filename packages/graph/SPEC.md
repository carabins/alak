# @alaq/graph — SDL Specification

**Version:** 0.3.4
**Format:** `.aql`
**Status:** normative
**Audience:** compilers, generators, AI agents writing SDL

This document is the single source of truth. Anything not defined here does not exist. Anything ambiguous here is a defect — file an issue.

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

EventDecl      = "event" , Identifier , { Directive } , "{" , { Field } , "}" ;  (* v0.3.4 *)

TypeExpr       = ( Identifier | ListType | MapType ) , [ "!" ] ;
ListType       = "[" , TypeExpr , "]" ;
MapType        = "Map" , "<" , TypeExpr , "," , TypeExpr , ">" ;

Directive      = "@" , Identifier , [ "(" , ArgList , ")" ] ;
ArgList        = Arg , { "," , Arg } ;
Arg            = Identifier , ":" , Value ;
Value          = StringLit | IntLit | FloatLit | BoolLit | EnumLit | ListLit ;
EnumLit        = Identifier ;
ListLit        = "[" , [ Value , { "," , Value } ] , "]" ;

QoSValue       = "RELIABLE" | "REALTIME" | "ORDERED_RELIABLE"
               | "best_effort_push" | "reliable_push" | "fire_forget" | "query_response" ;

Identifier     = ( letter | "_" ) , { letter | digit | "_" } ;
StringLit      = '"' , { character } , '"' ;
IntLit         = [ "-" ] , digit , { digit } ;
FloatLit       = [ "-" ] , digit , { digit } , "." , digit , { digit } ;
BoolLit        = "true" | "false" ;

Comment        = "#" , { any-char-except-newline } , newline ;
```

**R001** Comments start with `#` and run to end of line. They are not part of the parse tree.

> *v0.3.2 (additive, non-normative):* the parser now optionally exposes `#`-comments that appear on consecutive lines immediately before a top-level declaration (`record`, `extend record`, `action`, `enum`, `scalar`, `opaque stream`) as `leadingComments: string[]` on the corresponding IR node. See §10. This does not change R001's "not part of the parse tree" guarantee — the data is opaque to the compiler and carries no built-in semantics. It is an extension point for generators (e.g. Tauri event/stream hints, JSDoc pass-through, doc-comment harvesters). Pre-0.3.2 IR consumers ignore the field.
**R002** Whitespace between tokens is insignificant. Newlines are whitespace.
**R003** Field bodies, action input bodies, and **enum member lists** accept comma-less or comma-separated entries; both are valid. Trailing commas are allowed. One file should use one style. (v0.3: the parser was previously strict about enum commas — fixed.)
**R004** `Identifier` pattern: `/^[A-Za-z_][A-Za-z0-9_]*$/`.

### 2.1 Reserved names and contextual keywords

The lexer recognises a fixed set of reserved words. They split into two classes by how the parser treats them. v0.3.3 introduced this split — before v0.3.3 every reserved word was strict everywhere, which blocked valid user schemas like `record VersionRef { version: String! }` (Arsenal stress-test F-01 finding).

**Strict keywords** drive top-level structure. They may never appear as a field name, argument name, enum member, or type name. Using one of these as an identifier is a parse error (E000).

| Token | Position | Introduced |
|-------|----------|-----------|
| `schema`      | top-level `schema X { … }` block | v0.1 |
| `use`         | `use "path" { Ident, … }`        | v0.1 |
| `record`      | `record X { … }`                 | v0.1 |
| `extend`      | `extend record X { … }`          | v0.1 |
| `action`      | `action X { … }`                 | v0.1 |
| `enum`        | `enum X { … }`                   | v0.1 |
| `scalar`      | `scalar X`                       | v0.1 |
| `opaque`      | `opaque stream X { … }`          | v0.1 |
| `stream`      | `opaque stream X { … }`          | v0.1 |
| `event`       | `event X { … }`                  | v0.3.4 |
| `true`, `false` | boolean literal                | v0.1 |

**Contextual keywords** are keywords **only inside specific block bodies**. Anywhere else — including field names, argument names, enum members, and the element-type slot of a `[T]` / `Map<K, V>` — the parser treats them as ordinary identifiers (R004 pattern). This mirrors how TypeScript treats `type`, `from`, `of`, etc.

| Token | Keyword when… | Identifier otherwise? |
|-------|--------------|----------------------|
| `version`   | inside `schema { … }` block — `version: IntLit`                 | yes (v0.3.3) |
| `namespace` | inside `schema { … }` block — `namespace: StringLit`            | yes (v0.3.3) |
| `scope`     | inside `action { … }` block — `scope: StringLit`                | yes (v0.3.3) |
| `input`     | inside `action { … }` block — `input: { Field … }`              | yes (v0.3.3) |
| `output`    | inside `action { … }` block — `output: TypeExpr`                | yes (v0.3.3) |
| `qos`       | inside `opaque stream { … }` block — `qos: QoSValue`            | yes (v0.3.3) |
| `max_size`  | inside `opaque stream { … }` block — `max_size: IntLit`         | yes (v0.3.3) |

**R005 (v0.3.3)** Contextual keywords are lexed as `KEYWORD` tokens, but the parser accepts them as identifiers wherever R004 applies — field names, directive argument names, enum members, and type-expression element names. Structural positions (inside `schema`, `action`, `opaque stream` bodies) continue to recognise them as keywords without ambiguity: these block bodies only admit the targeted set of field keywords, so a contextual keyword cannot be misinterpreted as an identifier there.

**R006 (v0.3.3)** Type names (the identifier after `record`, `action`, `enum`, `scalar`, `opaque stream`) are strict identifiers. A declaration like `record scope { … }` is rejected. Type names follow the PascalCase convention (SPEC §5 R063 is the normative precedent for actions); using a contextual-keyword spelling for a user type is disallowed for readability, not for grammar ambiguity.

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

# OK — the same keyword-looking identifiers in schema/action positions still
# drive structure.
schema Arsenal {
  version: 1
  namespace: "rest.valkyrie.arsenal"
}
action JoinRoom {
  scope: "room"
  input: { name: String! }
  output: Player!
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

**R010** Enum values are bare identifiers, never quoted.
**R011** String literals use double quotes only. No single quotes, no backticks.
**R012** There is no null literal. Optionality is expressed by absence of `!` on the type.

---

## 4. Types

### 4.1 Built-in scalars

`ID`, `String`, `Int`, `Float`, `Boolean`, `Timestamp`, `UUID`, `Bytes`, `Duration`.

- `Timestamp` — integer, Unix milliseconds (i64).
- `Duration` — integer, milliseconds. May be written as `Duration` type with int values.
- `UUID` — canonical 36-character form on wire.
- `Bytes` — opaque byte array.

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

### 4.8 `Map<K, V>` (v0.3)

A built-in type constructor for key-value collections. Mirrors the shape of `Record<K, V>` in TypeScript / `dict[K, V]` in Python / `map<K, V>` in Protobuf.

```
record GameRoom {
  roundVotes:     Map<ID, Map<ID, VoteDir>>!
  wordCountVotes: Map<ID, Int>!
  exclusions:     Map<ID, PlayerExclusion>!
}
```

- `K` — **scalar key** only (SPEC §4.1 built-ins: `ID`, `String`, `Int`, `UUID`, `DeviceID`, `Bytes`, `Timestamp`, `Duration`, or any user-declared `scalar`). Records, enums, opaques, lists, and maps are not valid keys — see **E022**.
- `V` — any type expression (scalar, record, enum, user scalar, list, or another `Map<...>`).
- Nesting is allowed: `Map<ID, Map<ID, T>>` compiles to nested dictionaries.
- The outer `!` makes the map itself required; the value type's own `!` is respected recursively.
- `Map` is **not** a reserved keyword. The parser recognises it by the literal identifier `Map` followed by `<`. A user scalar literally named `Map` will collide syntactically only when used as a type — avoid the clash.

**R022 (new)** The `Map<K, V>` constructor replaces the v0.2 workaround of flattening maps into list-of-tuple records. Migrate applicable records when adopting v0.3.

**R023 (v0.3.4) — inner quantifiers: key is always required, value follows `!`.**

A `Map<K, V>` has two inner type slots, and the `!` quantifier has a fixed reading in each:

- **Key (`K`) — always required.** A map key can never be null (in JSON, CBOR, Rust's `HashMap`, Python's `dict` — the same story across every target). The SDL pins this as a normative convention: the key of a `Map<K, V>` is `K!` semantically, whether or not the author typed the `!`. The parser normalises both `Map<String, V>` and `Map<String!, V>` to the same IR (`mapKey.required === true`). Writing `!` on the key is redundant but not an error; an SDL formatter may drop it.
- **Value (`V`) — follows `!`.** `Map<K, V>` means *optional value* (semantically: "the map may store nulls at a key"). `Map<K, V!>` means *required value* — the map never stores nulls. This mirrors the standalone `T` vs `T!` distinction in every other position (§4.3).
- **Outer `!`** is unchanged and independent: `Map<K, V>!` is a required map that holds optional values; `Map<K, V!>` is an optional map that holds required values; `Map<K, V!>!` is required-of-required.

Pre-0.3.4 parsers produced `mapKey.required === false` when the key lacked `!` — this forced generators targeting typed languages (Rust `HashMap<Option<K>, ...>`) to emit a semantically wrong type for a map key that syntactically can never be null. The fix is a parser-level normalisation; no SDL change is required. All valid pre-0.3.4 schemas continue to compile unchanged.

IR consumers that already consult `mapKey.required` see `true` now where they used to see either `true` or `false`. Consumers that previously ignored the flag see no change. The field is never removed — it continues to be part of the stable `TypeRef` shape (§10) — only its domain narrows to the single value `true` when `map === true`.

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

## 5.5 Events (v0.3.4)

An **event** is a named, typed broadcast payload. It is declared in parallel with `record` and `action` at the top level of a schema:

```
event DownloadProgress {
  handle: String!
  bytes: Int!
  total: Int!
}

event DownloadCompleted {
  handle: String!
}

event DownloadFailed {
  handle: String!
  message: String!
}
```

### Grammar

```ebnf
EventDecl = "event" , Identifier , { Directive } , "{" , { Field } , "}" ;
```

Identical to `RecordDecl` (§4.4) in shape — same field grammar, same directive grammar — but the keyword is different and the semantics are broadcast/pub-sub, not state.

### Normative rules

**R065 (new)** An `event` is a payload declaration for a one-way broadcast. It is not state. It is not a record. It never participates in `extend record` merging.

**R066 (new)** The wire name of an event is `snake_case(EventName)`. `DownloadProgress` → `download_progress`. This matches the invoke-name convention for actions (R063 derives camelCase at call sites; R066 derives snake_case for the wire). The convention is enforced by the default generators: `@alaq/graph-tauri-rs` emits `app.emit("<snake_name>", payload)`; `@alaq/graph-tauri` emits `listen('<snake_name>', …)`.

**R067 (new)** Events MUST NOT carry `@scope`. Attempting to do so is **E024**. Broadcast payloads are not lifecycle-bound — authorisation and filtering, if any, live at the transport layer (§17). A future `@scope` on events is explicitly not scheduled; use the payload itself to carry a scope-id if the receiver needs to filter.

**R068 (new)** Events MAY carry `@deprecated`, `@added`, `@topic` (same rules as for records/actions). They MAY NOT carry `@sync`, `@crdt`, `@atomic`, `@store` — these describe state semantics that do not apply to a one-shot broadcast. Unknown directives emit **E001** as usual; semantically-inapplicable directives are not currently rejected with a dedicated code.

**R069 (new)** The payload fields obey the usual type system (§4). `Map<K, V>`, lists, required / optional are unchanged. Referenced record / enum / user-scalar types resolve via the same type universe (E009 on missing types).

### Wire mapping (default generators)

| SDL | Wire | Generator |
|-----|------|-----------|
| `event E { … }` (Tauri target) | `app.emit("<snake_name>", payload)` / `listen("<snake_name>", …)` | `@alaq/graph-tauri-rs` / `@alaq/graph-tauri` |
| `event E { … }` (Zenoh target) | Topic `ns/events/<snake_name>`, fire-and-forget put | `@alaq/graph-zenoh` (advisory stub; full support is a follow-up) |
| `event E { … }` (HTTP target)  | *Skipped* with a per-event warning. HTTP is request/response; broadcast events are out-of-surface. | `@alaq/graph-axum` |

**R066a** A generator that does not support broadcast events MUST emit a warning per declared event and skip code generation for that event, rather than failing the build. Schemas mixing HTTP actions and Tauri events are expected — the split-file-per-transport convention (§17, `*.http.aql` + `*.tauri.aql`) is the standard way to keep surfaces sharp.

### IR (additive)

`IRSchema.events: Record<string, IREvent>` is added as of v0.3.4 (§10). The shape mirrors `IRRecord` — `name`, `fields: IRField[]`, optional `directives`, optional `leadingComments`. Pre-0.3.4 IR consumers that iterate only over the historical buckets (`records`, `actions`, `enums`, `scalars`, `opaques`) continue to work unchanged; they simply don't see events.

### Example (end-to-end)

```
schema BelladonnaReaderEvents {
  version: 1
  namespace: "belladonna.reader.events"
}

event RenderProgress {
  path: String!
  bytes: Int!
  total: Int!
}
```

Rust (from `@alaq/graph-tauri-rs`):

```rust
pub struct RenderProgress { pub path: String, pub bytes: i64, pub total: i64 }

pub fn emit_render_progress<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    payload: &RenderProgress,
) -> tauri::Result<()> {
    app.emit("render_progress", payload)
}
```

TypeScript (from `@alaq/graph-tauri`):

```ts
export interface IRenderProgress { readonly path: string; readonly bytes: number; readonly total: number }

export function onRenderProgress(handler: (payload: IRenderProgress) => void): Promise<UnlistenFn> {
  return listen<IRenderProgress>('render_progress', ev => handler(ev.payload))
}
```

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
@sync(
  qos: QoS = RELIABLE,
  mode: SyncMode = EAGER,
  atomic: Boolean = false
) on FIELD | RECORD
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
@crdt(
  type: CrdtType = LWW_REGISTER,
  key: String
) on FIELD | RECORD
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

**R120** `@atomic` is exactly equivalent to `@sync(atomic: true)`. Use `@atomic` for brevity; do not combine with `@sync`.

### 7.4 `@auth`

```
@auth(
  read: Access = "public",
  write: Access = "public"
) on FIELD | RECORD
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

**R135 (scope semantics, normative).** `@scope` is **single-axis**. A record opts into exactly one scope. The SDL has no syntax for multi-axis scoping (e.g. `@scope(channel, admin)` is not valid and will not be added). Multi-axis data slicing is expressed by declaring the primary axis as the scope and passing the remaining axes as `input` fields on scope-bound actions (with server-side filtering in the handler). This is a conscious design choice — see PHILOSOPHY §5.

**R136 (auth is not scope, normative).** `@scope` controls reactive lifecycle and state slicing only. It does **not** express authorization. SDL does not describe authentication or authorization at all — both live at the transport layer (see §17). Actions declared without `scope` are the intended shape for admin / unrestricted operations; whatever gate decides "may this caller invoke this action" is the consumer's middleware, not a directive.

**R137 (transport is not scope, normative).** `@scope` has no relationship to transport selection. Whether a schema is served over HTTP, Tauri IPC, or Zenoh is decided by which generator consumes the IR (see §17). `@scope` has identical semantics across all transports — in transports that do not have a native scope concept (e.g. Tauri IPC), a scoped action is emitted as a plain call and the scope identifier travels through the input like any other argument.

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
@liveness(
  source: String!,
  timeout: Duration!,
  on_lost: LivenessAction = MARK_ABSENT
) on FIELD | RECORD
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

### 7.14 `@transport` (v0.3.4)

```
@transport(kind: String!) on SCHEMA
```

Marks the **intended** transport for the schema. The value is a string literal
drawn from the closed set:

| `kind` | Intended target |
|--------|-----------------|
| `"tauri"` | Tauri IPC (local desktop/mobile process). Picked up by `@alaq/graph-tauri` and `@alaq/graph-tauri-rs`. |
| `"http"`  | HTTP request/response. Picked up by `@alaq/graph-axum`, `@alaq/graph-link-state`, `@alaq/graph-link-server`. |
| `"zenoh"` | Zenoh mesh (pub/sub + query/reply). Picked up by `@alaq/graph-zenoh`. |
| `"any"`   | Explicit opt-in to "any transport". Default when `@transport` is omitted. Generators treat `"any"` as compatible with themselves. |

```
schema BelladonnaReader @transport(kind: "tauri") {
  version: 1
  namespace: "belladonna.reader"
}
```

**R220 (v0.3.4)** `@transport` appears at the schema-declaration level only —
between the schema name and the opening `{`. It has no effect on IR shape,
wire mapping, or validation of records/actions. The parser projects the value
of `kind` into `IRSchema.transport`; the raw directive is also preserved on
`IRSchema.directives` for uniform generator walks.

**R221 (v0.3.4, revised v0.3.5)** `@transport` is a **binding declaration of
intent**, enforced at generation time. A generator consuming the IR MUST
refuse code emission when `IRSchema.transport` is set to a value outside the
generator's `supportedTransports` list — the standard diagnostic code for
this mismatch is **E025** (error). On E025 the generator returns `files: []`
and a single error diagnostic; no partial artifacts are written. (Pre-0.3.5
this was **W005**, an advisory warning; the rename reflects that advisory
semantics encouraged consumers to ignore the mismatch and ship bogus
output. See §15 Changelog and §12 for the W005→E025 transition.)

**R222 (v0.3.4, revised v0.3.5)** A schema without `@transport` behaves as if
it had declared `@transport(kind: "any")`. Pre-0.3.4 schemas are therefore
unchanged in observable behavior. Generators MUST treat a missing `transport`
and an explicit `"any"` as equivalent: both suppress E025 and code is
generated normally. `"any"` is the documented escape hatch for authors who
want a schema consumable by every generator regardless of transport.

**R223 (v0.3.4)** Adding a new value to the closed `kind` set is a spec
version bump. Generators implementing a new target declare it in their
`supportedTransports` list; until the SPEC lists the new value, authors
cannot write it — the validator emits E003 on anything outside the closed
set.

**R224 (v0.3.5)** Refusal contract on E025. When a generator rejects an IR
because of transport mismatch, the returned `GenerateResult` MUST contain:
(a) an empty `files` array, (b) exactly one `GenerateDiagnostic` with
`severity: "error"` and a message naming the schema namespace, the declared
`kind`, the offending generator, and the generator's supported list. Authors
who intentionally want the schema to flow through a non-native generator set
the escape hatch `@transport(kind: "any")` — this bypasses the check
entirely. Omitting the directive has the same effect (R222) and is the
recommended form for generic/library schemas; `"any"` is reserved for
schemas that previously declared a narrower `kind` and are being opened up.

**Relation to §7.5 R137 and §17.** §7.5 R137 states that `@scope` does not
express transport selection. §7.14 `@transport` does — but only as an advisory
marker. Transport is still picked by *which generator consumes the IR*, not by
a directive mutating code generation. §17 enumerates `@transport` alongside
split-file conventions (`arsenal.http.aql` + `arsenal.tauri.aql`) as two
orthogonal expressions of intent: `@transport` is cheap and authoritative
inside one file, split-file is cheap and authoritative when the SDL itself
diverges between surfaces.

---

## 8. Cookbook

Reverse-index: find the task, copy the pattern.

### 8.1 Add a field to a record

```
record Player {
  id: ID!
  name: String!
  avatar: String          # optional scalar
  myWords: [String!]!     # required list of required strings
}
```

### 8.2 Declare an optional field with a default

```
record GameSettings {
  wordsPerPlayer: Int! @default(value: 10)
  roundTime: Int! @default(value: 60)
}
```

### 8.3 Mark a field visible only to its owner

```
record Player {
  id: ID!
  myWords: [String!]! @auth(read: "owner")
}
```

### 8.4 Declare a scoped record (per-room state)

```
record GameRoom @scope(name: "room") @sync(qos: RELIABLE) {
  id: ID!
  status: RoomStatus!
  players: [Player!]!
}
```

### 8.5 Declare a real-time field inside a reliable record

```
record RoundState {
  phase: RoundPhase!
  timeLeft: Int! @sync(qos: REALTIME)
}
```

### 8.6 Declare a CRDT-replicated collection

```
record Message @crdt(type: LWW_MAP, key: "updated_at") {
  id: ID!
  author: ID!
  text: String!
  updated_at: Timestamp!
}
```

### 8.7 Declare an atomic blob

```
record KalmanBlock @atomic {
  matrix: [[Float!]!]!
  bias: [Float!]!
}
```

### 8.8 Declare an RPC-style action

```
action CreateRoom {
  input: { settings: GameSettings }
  output: ID!
}
```

### 8.9 Declare a fire-forget action

```
action StartGame {
  scope: "room"
}
```

### 8.10 Declare a scope-bound action (room context)

```
action JoinRoom {
  scope: "room"
  input: { name: String! }
  output: Player!
}
```

Call-site: `room.joinRoom(name)`. The runtime binds `room.id` automatically.

### 8.11 Extend an existing record

```
extend record GameRoom {
  currentRound: RoundState
  currentTeamId: ID
}
```

### 8.12 Declare an opaque byte stream

```
opaque stream AudioFrames {
  qos: best_effort_push
  max_size: 8192
}
```

### 8.13 Add a liveness presence check

```
record Player @liveness(source: "ws:player", timeout: 5000, on_lost: MARK_ABSENT) {
  id: ID!
  name: String!
}
```

### 8.14 Bound numeric input

```
record GameSettings {
  wordsPerPlayer: Int! @default(value: 10) @range(min: 1, max: 100)
}
```

### 8.15 Import shared types

```
use "core/identity" { UUID, DeviceID }
use "./round" { RoundState }
```

### 8.16 Mark a field deprecated

```
record Player {
  avatar: String
  avatarUrl: String @deprecated(since: "2", reason: "use avatar")
}
```

### 8.17 Declare a map field (v0.3)

```
record GameRoom {
  # Single-level map: peerId → vote count
  wordCountVotes: Map<ID, Int>!

  # Nested map: roundId → peerId → direction
  roundVotes: Map<ID, Map<ID, VoteDir>>!

  # Map with a record value
  exclusions: Map<ID, PlayerExclusion>!
}
```

Default TS mapping: `Record<K, V>`. Wire mapping: CBOR map or LWW-Map CRDT when `@crdt(type: LWW_MAP)` is applied. Keys must be scalar (SPEC §4.8).

---

## 9. Intent-to-syntax index

| Intent | Syntax |
|--------|--------|
| Create a data type | `record Name { ... }` |
| Create a closed value set | `enum Name { A, B, C }` |
| Create an opaque type | `scalar Name` |
| Create an operation | `action Name { ... }` |
| Operation with arguments | `action X { input: { a: T! } }` |
| Operation returning data | `action X { output: T }` |
| Operation in room context | `action X { scope: "room" }` |
| Bind argument to scope | inside input, use `@this` on argument |
| Reliable state replication | `record X @sync(qos: RELIABLE)` |
| Real-time numeric field | `field: Int! @sync(qos: REALTIME)` |
| Lazy-loaded field | `field: T! @sync(mode: LAZY)` |
| Atomic blob (no diff) | `record X @atomic` or `field: T! @atomic` |
| LWW-replicated map | `record X @crdt(type: LWW_MAP, key: "updated_at")` |
| CRDT set | `record X @crdt(type: OR_SET)` |
| Persisted record | `record X @store` |
| Private to owner | `field: T! @auth(read: "owner")` |
| Scoped to room | `record X @scope(name: "room")` |
| Presence tracking | `record X @liveness(source: "...", timeout: 3000)` |
| Bounded numeric | `field: Int! @range(min: 0, max: 100)` |
| Default value | `field: T! @default(value: V)` |
| Add fields to existing type | `extend record X { ... }` |
| Import types | `use "path" { A, B }` |
| Byte-transparent channel | `opaque stream Name { qos: ..., max_size: ... }` |
| Override topic path | `@topic(pattern: "custom/{id}/path")` |
| Map field (v0.3) | `field: Map<K, V>!` |
| Nested map field | `field: Map<K, Map<K2, V>>!` |

---

## 10. IR schema (JSON Schema)

Generators read IR. The parser emits IR conforming to this schema.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "AlaqGraphIR",
  "type": "object",
  "required": ["schemas"],
  "properties": {
    "schemas": {
      "type": "object",
      "additionalProperties": { "$ref": "#/$defs/SchemaBlock" }
    }
  },
  "$defs": {
    "SchemaBlock": {
      "type": "object",
      "required": ["name", "namespace", "version"],
      "properties": {
        "name": { "type": "string" },
        "namespace": { "type": "string" },
        "version": { "type": "integer" },
        "records": { "type": "object", "additionalProperties": { "$ref": "#/$defs/Record" } },
        "actions": { "type": "object", "additionalProperties": { "$ref": "#/$defs/Action" } },
        "enums":   { "type": "object", "additionalProperties": { "$ref": "#/$defs/Enum" } },
        "scalars": { "type": "object", "additionalProperties": { "$ref": "#/$defs/Scalar" } },
        "opaques": { "type": "object", "additionalProperties": { "$ref": "#/$defs/Opaque" } },
        "events":  { "type": "object", "additionalProperties": { "$ref": "#/$defs/Event" }, "description": "v0.3.4 (additive, W9): broadcast-event payloads declared with `event Name { … }`. Mirrors `records` in shape but lives in its own bucket so generators can fan out pub/sub emitters separately from state." },
        "transport": {
          "type": "string",
          "enum": ["tauri", "http", "zenoh", "any"],
          "description": "v0.3.4 (additive, W8): schema-level intended transport projected from `@transport(kind: ...)` (SPEC §7.14). Absent ≡ 'any'. Consulted by generators for W005 mismatch warnings. Pre-0.3.4 consumers ignore."
        },
        "directives": {
          "type": "array",
          "items": { "$ref": "#/$defs/Directive" },
          "description": "v0.3.4 (additive, W8): schema-level directives in source order. `@transport` is also projected into `transport`; this array preserves the raw list for uniform walks."
        }
      }
    },
    "Record": {
      "type": "object",
      "required": ["name", "fields"],
      "properties": {
        "name": { "type": "string" },
        "fields": { "type": "array", "items": { "$ref": "#/$defs/Field" } },
        "directives": { "type": "array", "items": { "$ref": "#/$defs/Directive" } },
        "scope": { "type": ["string", "null"] },
        "topic": { "type": ["string", "null"] },
        "leadingComments": { "type": "array", "items": { "type": "string" }, "description": "v0.3.2 (additive): raw `#`-comment lines immediately preceding the declaration (leading `#` + one optional space stripped). Absent when no leading comments were attached (not `[]`). No built-in semantics — generator extension point." }
      }
    },
    "Field": {
      "type": "object",
      "required": ["name", "type", "required", "list"],
      "properties": {
        "name": { "type": "string" },
        "type": { "type": "string" },
        "required": { "type": "boolean" },
        "list": { "type": "boolean" },
        "listItemRequired": { "type": "boolean" },
        "map":       { "type": "boolean", "description": "v0.3: true when field is Map<K,V>. `type` is then the literal string 'Map'." },
        "mapKey":    { "$ref": "#/$defs/TypeRef", "description": "v0.3: key type; present iff map=true. v0.3.4: `mapKey.required` is always `true` — see §4.8 R023 (map keys are never null). Syntactic `!` on the key is redundant; parsers normalise both `Map<K, V>` and `Map<K!, V>` to the same IR." },
        "mapValue":  { "$ref": "#/$defs/TypeRef", "description": "v0.3: value type; present iff map=true. `mapValue.required` reflects the syntactic `!` on V (§4.3)." },
        "directives": { "type": "array", "items": { "$ref": "#/$defs/Directive" } }
      }
    },
    "TypeRef": {
      "type": "object",
      "description": "v0.3: nested type reference used inside map key/value slots. Recursively describes scalars, lists, and nested maps.",
      "required": ["type", "required", "list"],
      "properties": {
        "type":     { "type": "string" },
        "required": { "type": "boolean" },
        "list":     { "type": "boolean" },
        "listItemRequired": { "type": "boolean" },
        "map":      { "type": "boolean" },
        "mapKey":   { "$ref": "#/$defs/TypeRef" },
        "mapValue": { "$ref": "#/$defs/TypeRef" }
      }
    },
    "Action": {
      "type": "object",
      "required": ["name"],
      "properties": {
        "name": { "type": "string" },
        "scope": { "type": ["string", "null"] },
        "input": { "type": "array", "items": { "$ref": "#/$defs/Field" } },
        "output": { "type": ["string", "null"] },
        "outputRequired": { "type": "boolean" },
        "outputList": { "type": "boolean", "description": "v0.3.1: true when output is a list [T] / [T!] / [T]! / [T!]!. `output` still carries the element's base type name." },
        "outputListItemRequired": { "type": "boolean", "description": "v0.3.1: meaningful only when outputList=true. True iff the list element carries `!`." },
        "directives": { "type": "array", "items": { "$ref": "#/$defs/Directive" } },
        "leadingComments": { "type": "array", "items": { "type": "string" }, "description": "v0.3.2 (additive): see Record.leadingComments." }
      }
    },
    "Enum": {
      "type": "object",
      "required": ["name", "values"],
      "properties": {
        "name": { "type": "string" },
        "values": { "type": "array", "items": { "type": "string" } },
        "leadingComments": { "type": "array", "items": { "type": "string" }, "description": "v0.3.2 (additive): see Record.leadingComments." }
      }
    },
    "Scalar": {
      "type": "object",
      "required": ["name"],
      "properties": {
        "name": { "type": "string" },
        "leadingComments": { "type": "array", "items": { "type": "string" }, "description": "v0.3.2 (additive): see Record.leadingComments." }
      }
    },
    "Opaque": {
      "type": "object",
      "required": ["name", "qos"],
      "properties": {
        "name": { "type": "string" },
        "qos": { "type": "string" },
        "maxSize": { "type": "integer" },
        "leadingComments": { "type": "array", "items": { "type": "string" }, "description": "v0.3.2 (additive): see Record.leadingComments." }
      }
    },
    "Event": {
      "type": "object",
      "description": "v0.3.4 (additive, W9): broadcast-event payload declaration. Shape mirrors `Record` exactly — same fields, same directives, same leading-comments passthrough — but with pub/sub (not state) semantics. See SPEC §5.5.",
      "required": ["name", "fields"],
      "properties": {
        "name": { "type": "string" },
        "fields": { "type": "array", "items": { "$ref": "#/$defs/Field" } },
        "directives": { "type": "array", "items": { "$ref": "#/$defs/Directive" } },
        "leadingComments": { "type": "array", "items": { "type": "string" }, "description": "v0.3.2 (additive): see Record.leadingComments." }
      }
    },
    "Directive": {
      "type": "object",
      "required": ["name"],
      "properties": {
        "name": { "type": "string" },
        "args": { "type": "object", "additionalProperties": true },
        "argTypes": {
          "type": "object",
          "description": "v0.3.3 (additive): per-argument literal-kind tag. Keys mirror `args` exactly. Values are one of 'string' | 'int' | 'float' | 'bool' | 'enum_ref' | 'list'. Present iff the directive has at least one argument. Generators MUST consult `argTypes[k] === 'enum_ref'` to distinguish a bare-identifier enum literal (per R041) from a string literal when emitting defaults; pre-0.3.3 consumers may ignore and fall back to resolving by enclosing field type.",
          "additionalProperties": {
            "type": "string",
            "enum": ["string", "int", "float", "bool", "enum_ref", "list"]
          }
        }
      }
    }
  }
}
```

**R300** IR is the sole interface between the parser and generators. Generators never re-parse `.aql`.
**R301** IR field names are stable across minor spec versions. Additive changes may append new optional fields.

---

## 11. Wire mapping (normative for default generator)

The default Tier-2 generator (`@alaq/graph-zenoh`) produces this mapping. Other generators document their own mapping, but this table is authoritative for default-target implementations.

| SDL | Wire |
|-----|------|
| `schema X { namespace: "n" }` | Topic root `n/` |
| `record R` (unscoped, `@sync(qos: RELIABLE)`) | Topic `n/R`, reliable publisher |
| `record R @scope(name: "room")` | Topic family `n/room/{id}/R`, one replica per `{id}` |
| `record R @sync(qos: RELIABLE)` | Zenoh put/subscribe, reliable |
| `record R @sync(qos: REALTIME)` | Zenoh put/subscribe, best-effort |
| `field f @sync(qos: REALTIME)` on reliable record | Sub-topic `<parent-topic>/f`, best-effort |
| `record R @crdt(type: LWW_MAP, key: "updated_at")` | Automerge document keyed by record id, LWW by `updated_at` |
| `record R @atomic` | CBOR blob, whole-record replace on change |
| `action A` (unscoped) | Topic `n/action/A`, request-reply |
| `action A { scope: "room" }` | Topic `n/room/{id}/action/A`, request-reply per room |
| `action A` without `output` | Fire-forget, no reply topic |
| `action A` with `output: T` | Request on `.../action/A`, reply on `.../action/A/reply/{req_id}` |
| `opaque stream S { qos: Q, max_size: N }` | Topic `n/stream/S`, pass-through, fragmented above `N` |
| `@liveness(source, timeout)` | Runtime presence loop publishes `on_lost` event after `timeout` of silence |
| `@auth(read: "owner")` | Generator emits ACL check; wire includes identity token in frame |
| `@store` | Runtime persists to storage backend; not visible on wire directly |
| `Map<K, V>` (v0.3) | CBOR map on the wire. With `@crdt(type: LWW_MAP)` → LWW-Map CRDT keyed by `K`. Default TS mapping: `Record<K, V>`. |

**R400** Two deployments that use the same generator version against the same `.aql` produce byte-identical wire traffic.
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
- **E022** (v0.3) `Map<K, V>` key type is not scalar. Valid keys: built-in scalars (SPEC §4.1) and user-declared `scalar`s. Records, enums, opaques, lists, and maps are rejected.
- **E023** (v0.3.3) Directive is missing a required argument. Required arguments are the ones declared with `!` in §7 (e.g. `@scope(name!)`, `@default(value)`, `@range(min, max)`, `@deprecated(since!)`, `@added(in!)`, `@topic(pattern!)`, `@liveness(source!, timeout!)`). The `@crdt(key)`-for-LWW_* case is a context-sensitive requirement and is reported as E004 instead.
- **E024** (v0.3.4, W9) `event` declaration carries `@scope`. Events are broadcast payloads and are not lifecycle-bound (SPEC §5.5 R067). Remove the `@scope` directive; if the receiver needs a scope identifier, carry it as a field on the payload.
- **E025** (v0.3.5, C7) Schema `@transport(kind: ...)` does not match the consuming generator's `supportedTransports` list. Emitted by generators, not the parser/validator. Generation halts: generator returns `files: []` and a single error diagnostic (§7.14 R221/R224). Authors who want a schema to flow through any generator set `@transport(kind: "any")` or omit the directive. Pre-0.3.5 this was **W005** (advisory warning). The upgrade to error status reflects that advisory-only mismatches produced bogus artifacts downstream — an HTTP-axum generator invoked against a Tauri schema emitted compilable but semantically wrong code, and nothing in the pipeline stopped it.

### Warnings

- **W001** `@sync(qos: REALTIME)` on composite (record-typed) field without `@atomic`.
- **W002** `@store` without explicit `@sync`; defaults to `RELIABLE`.
- **W003** Record has `@crdt` but no `Timestamp!` field named `updated_at`.
- **W004** Directive declared but target does not use it (detected by generator context; advisory only).
- **W005** (v0.3.4, superseded v0.3.5) Previously advisory `@transport` mismatch. Replaced by **E025** (error). See §7.14 R221 and §15 Changelog for v0.3.5 (C7). No warning-severity mismatch diagnostic is emitted by generators anymore.

---

## 13. Conformance test cases

Each case includes SDL input, expected parse outcome, and expected validation code. Compilers must agree on these outcomes.

### 13.1 Valid: minimal schema

**Input:**
```
schema S { version: 1, namespace: "s" }
record R { id: ID! }
```

**Expected:** parses, no errors.

### 13.2 Valid: record with directive

**Input:**
```
schema S { version: 1, namespace: "s" }
record R @sync(qos: RELIABLE) { id: ID!, name: String! }
```

**Expected:** parses, no errors. IR `records.R.directives[0].name == "sync"`.

### 13.3 Invalid: unknown directive

**Input:**
```
schema S { version: 1, namespace: "s" }
record R @frobnicate { id: ID! }
```

**Expected:** E001.

### 13.4 Invalid: LWW crdt without key

**Input:**
```
schema S { version: 1, namespace: "s" }
record R @crdt(type: LWW_MAP) { id: ID!, updated_at: Timestamp! }
```

**Expected:** E004.

### 13.5 Invalid: @this without scope

**Input:**
```
schema S { version: 1, namespace: "s" }
action Join { input: { roomId: ID! @this } output: Boolean! }
```

**Expected:** E006.

### 13.6 Valid: extend record

**Input:**
```
schema S { version: 1, namespace: "s" }
record R { id: ID! }
extend record R { name: String! }
```

**Expected:** parses. IR `records.R.fields` length 2.

### 13.7 Invalid: duplicate field via extend

**Input:**
```
schema S { version: 1, namespace: "s" }
record R { id: ID! }
extend record R { id: ID! }
```

**Expected:** E010.

### 13.8 Warning: REALTIME on composite without atomic

**Input:**
```
schema S { version: 1, namespace: "s" }
record Inner { x: Int! }
record R { data: Inner! @sync(qos: REALTIME) }
```

**Expected:** parses. W001.

### 13.9 Valid: nested `Map<ID, Map<ID, VoteDir>>` (v0.3)

**Input:**
```
schema S { version: 1, namespace: "s" }
enum VoteDir { UP DOWN }
record R { votes: Map<ID, Map<ID, VoteDir>>! }
```

**Expected:** parses, no errors. IR `records.R.fields[0].map == true`; `mapKey.type == "ID"`; `mapValue.map == true`; `mapValue.mapValue.type == "VoteDir"`.

### 13.10 Invalid: Map with a composite (record) key → E022 (v0.3)

**Input:**
```
schema S { version: 1, namespace: "s" }
record Player { id: ID! }
record R { bad: Map<Player, Int>! }
```

**Expected:** E022.

---

## 14. Full example — Kotelok

Four files, one namespace.

### 14.1 `core/identity.aql`

```
schema Identity {
  version: 1
  namespace: "core.identity"
}

scalar UUID
scalar DeviceID
```

### 14.2 `kotelok/players.aql`

```
schema Kotelok {
  version: 1
  namespace: "kotelok"
}

record Player {
  id: ID!
  name: String!
  avatar: String
  myWords: [String!]! @auth(read: "owner")
}

record Team {
  id: ID!
  name: String!
  score: Int! @default(value: 0)
  memberIds: [ID!]!
}
```

### 14.3 `kotelok/lobby.aql`

```
use "./players" { Player, Team }

enum RoomStatus { LOBBY, GAME_ACTIVE, FINISHED }

record GameSettings {
  wordsPerPlayer: Int! @default(value: 10) @range(min: 1, max: 100)
  roundTime: Int! @default(value: 60) @range(min: 10, max: 600)
}

record WordSubmission {
  playerId: ID!
  count: Int!
  isDone: Boolean!
}

record GameRoom @scope(name: "room") @sync(qos: RELIABLE) {
  id: ID!
  status: RoomStatus! @default(value: LOBBY)
  settings: GameSettings!
  players: [Player!]!
  teams: [Team!]!
  wordSubmissions: [WordSubmission!]!
  totalWordsCount: Int!
}

action CreateRoom {
  input: { settings: GameSettings }
  output: ID!
}

action JoinRoom {
  scope: "room"
  input: { name: String! }
  output: Player!
}

action CreateTeam {
  scope: "room"
  input: { name: String! }
  output: Team!
}

action JoinTeam {
  scope: "room"
  input: { teamId: ID! }
  output: Boolean!
}

action SubmitWords {
  scope: "room"
  input: { words: [String!]! }
  output: Boolean!
}

action StartGame {
  scope: "room"
}
```

### 14.4 `kotelok/round.aql`

```
use "./lobby" { GameRoom }

enum RoundPhase { PREPARE, ACTIVE, REVIEW }
enum WordOutcome { GUESSED, SKIPPED }

record RoundStats {
  guessed: [String!]!
  skipped: [String!]!
}

record RoundState {
  phase: RoundPhase!
  activePlayerId: ID!
  timeLeft: Int! @sync(qos: REALTIME)
  currentWord: String @auth(read: "owner")
  stats: RoundStats!
}

extend record GameRoom {
  currentRound: RoundState
  currentTeamId: ID
}

action PlayerReady  { scope: "room", output: Boolean! }
action GuessWord    { scope: "room", output: Boolean! }
action SkipWord     { scope: "room", output: Boolean! }
action ConfirmRound { scope: "room", output: Boolean! }

action FixScore {
  scope: "room"
  input: { word: String!, outcome: WordOutcome! }
  output: Boolean!
}
```

### 14.5 `kotelok/system.aql`

```
record SystemInfo @sync(qos: REALTIME) {
  online: Int!
  ping: Int!
}
```

---

## 15. Versioning

This SPEC is versioned. Current: `0.3`.

- **Minor bump** (0.2 → 0.3): new directives, new scalars, new type constructors (e.g. `Map<K, V>` in 0.3), new enum values in existing spec enums (e.g. new CRDT type), new validation codes. Backwards compatible for existing `.aql`.
- **Major bump** (0.x → 1.0): grammar changes, directive removals, IR breaking changes. Requires migration document.

### Changelog

**0.3.5 (2026-04-21)** — normative (§7.14 tightened, W005→E025) + behavioral for one tight slice (generators refuse on mismatch)
- **§7.14 `@transport` — enforcement, not advice (C7).** R221 rewritten: mismatch between `IRSchema.transport` and a generator's `supportedTransports` list is now an **error**, not a warning. Generators emit a single `E025` diagnostic and return `files: []` on mismatch; no partial artifacts. R224 (new) pins the refusal contract (empty files, single error diagnostic with schema/kind/generator/supported-list). R222 retained — missing `@transport` ≡ `@transport(kind: "any")`, both suppress E025. Legacy schemas without `@transport` are unchanged.
- **§12 Validation rules — E025 added, W005 retired.** E025 (§12 Errors) supersedes W005 (§12 Warnings). W005 entry kept as a tombstone so pre-0.3.5 tooling references remain discoverable. No parser/validator code path changes — E025 is generator-only, same as W005 was.
- **Rationale.** W005 was validation-theatre: `graph-zenoh.generate(http-schema)` printed "W005 mismatch; generation proceeds" and emitted bogus code that downstream consumers happily compiled. The advisory frame trained users to ignore the warning. `@transport(kind: "any")` remains the documented escape hatch for authors who do want to feed a schema to every generator; omitting the directive has the same effect (R222).
- **No spec-level IR change.** `IRSchema.transport?: string` unchanged: absent when `@transport` was not declared (per R222, equivalent to `"any"`). Generators already treated `undefined` as compatible; the enforcement path uses the existing `schema.transport && !SUPPORTED_TRANSPORTS.includes(schema.transport)` guard, with severity flipped from `warning` to `error` and an early `return { files: [], diagnostics }`.

**0.3.4 (2026-04-20)** — behavioral (parser normalisation, schema-level directives, event keyword) + additive (IR/§10) + normative (§4.8, §7.14, §5.5, W005, E024)
- **New §5.5 "Events" (W9)** — first-class `event Name { … }` declaration. Shape-identical to `record` but broadcast/pub-sub semantics, not state. Strict keyword `event` added to §2.1. R065–R069 normative (what events are, wire name rule `snake_case(EventName)`, `@scope` rejected via E024, allowed/disallowed directives, field type universe). Wire mapping table in §5.5 ties `app.emit("<snake_name>", payload)` to `@alaq/graph-tauri-rs`, `listen('<snake_name>', …)` to `@alaq/graph-tauri`, per-event warning-and-skip to `@alaq/graph-axum`. IR addition: `IRSchema.events: Record<string, IREvent>` (additive; pre-0.3.4 consumers ignore). New diagnostic E024 (event with `@scope`). §17 updated — broadcast events moved from out-of-scope to in-scope; streams remain out-of-scope. Closes stress.md Q18; partially closes Q19/Q20 (leadingComments remain the workaround for schema-level / inline comments). Resolves Arsenal-A.0/О8 blocker for `graph-tauri-rs`/`graph-tauri` completeness.
- **New §7.14 `@transport` (W8)** — schema-level marker directive: `@transport(kind: "tauri" | "http" | "zenoh" | "any")`. Closed value set. R220–R223: placement between schema name and `{`, intent-only (no wire rewiring), missing ≡ `"any"`, adding a new `kind` value requires a spec bump. Closes stress.md Q15.
- **Grammar (§2 EBNF)** — `SchemaDecl` extended: `"schema" Identifier { Directive } "{" SchemaField+ "}"`. Schemas without directives parse identically (strict superset).
- **IR additions (§10, W8)** — `SchemaBlock.transport?: string` and `SchemaBlock.directives?: Directive[]`. Both optional; absent on schemas that declare no `@transport` / no schema-level directives. Pre-0.3.4 consumers ignore.
- **New W005 (§12, W8)** — generator-emitted warning when `IRSchema.transport` does not match the consuming generator's `supportedTransports` list. Advisory — generation proceeds. Strict-mode rejection is future work.
- **Generator opt-in (W8)** — `graph-axum`, `graph-tauri`, `graph-tauri-rs`, `graph-zenoh`, `graph-link-state`, `graph-link-server` each declare a `supportedTransports: string[]` list and emit W005 on mismatch. Lists default to `["<target>", "any"]`; for back-compat a schema without `@transport` is treated as `"any"` and suppresses W005.
- **New R023 (§4.8)** — `Map<K, V>` inner quantifiers: key is always required (normative convention, mirrors JSON/CBOR/Rust/Python map semantics); value follows the syntactic `!` on `V`. Syntactic `!` on the key is accepted but redundant.
- **Parser change (behavioral)** — `parseTypeExpr` normalises `keyType.required = true` for every `Map<K, V>` regardless of whether the source wrote `!`. Pre-0.3.4 IR had `mapKey.required === false` for bare keys; post-0.3.4 it is always `true`. No SDL is invalidated — existing `Map<String, String>!` style schemas keep compiling; IR shape of pre-existing map fields narrows `mapKey.required` from `true|false` to `true`.
- **§10 clarification** — `TypeRef.mapKey.required` domain narrowed to `{ true }` when `map === true`. `mapValue.required` unchanged (still reflects `!` on V).
- **Generator impact** — `graph-tauri-rs`, `graph-axum` (and any downstream consumer of `mapFieldType` / `mapTypeRef`) now emit `HashMap<K, V>` instead of `HashMap<Option<K>, V>` for `Map<K, V>`. Value-side `Option<V>` is unchanged (still controlled by `mapValue.required`). Closes stress.md Q03.

**0.3.3 (2026-04-20)** — text-only, normative clarifications + behavioral (contextual keywords)
- **§7.5 `@scope`** — three normative rules added: R135 (scope is single-axis), R136 (auth is not scope), R137 (transport is not scope). No behavior change; boundary explicit.
- **New §17 "Out of scope (SDL limitations)"** — single normative source for what the SDL deliberately does not describe (auth, transport selection, UI commands, byte streams, events, multi-axis scope, query/mutation split, deployment, persistence backend, identity derivation). R700 — adding any of these as first-class requires cross-consumer justification + spec bump.
- **PHILOSOPHY §5** uplifted in parallel with matching boundaries (see `PHILOSOPHY.md`).
- **New §2.1 "Reserved names and contextual keywords"** + R005, R006. Parser now accepts `version`, `namespace`, `scope`, `input`, `output`, `qos`, `max_size` as ordinary identifiers in field-name / arg-name / enum-member / type-expression positions. Inside their native blocks (`schema`, `action`, `opaque stream`) they remain structural keywords — no ambiguity. Strict keywords unchanged (`schema`, `record`, `extend`, `action`, `enum`, `scalar`, `opaque`, `stream`, `use`, `true`, `false`). Unblocks `record VersionRef { version: String! }` style schemas (Arsenal stress-test F-01). Existing valid SDL from pre-0.3.3 continues to parse identically — the change is strictly a superset.

**0.3.2 (2026-04-20)** — additive
- **IR additions**: optional `leadingComments: string[]` on `Record`, `Action`, `Enum`, `Scalar`, `Opaque` (§10). Consecutive `#`-comment lines immediately preceding a top-level declaration are surfaced for generator consumption (e.g. Tauri event/stream hint markers, doc-comment harvesters). R001 unchanged — comments remain "not part of the parse tree" for structural purposes. Blank line between the comment block and the keyword detaches the comments (they are dropped). Pre-0.3.2 consumers ignore the new field.
- **Lexer change (additive)**: comments now emit `COMMENT` tokens (payload = body with leading `#` and one optional space stripped). Previously silently skipped. The parser treats `COMMENT` as transparent outside the harvesting path — no structural impact.

**0.3 (2026-04-18)**
- **New type constructor**: `Map<K, V>` (§4.8, §2 EBNF). Scalar keys only — see E022.
- **R003 clarified**: enum member lists accept comma-less and comma-separated entries. Parser fixed to match.
- **IR additions**: `Field.map`, `Field.mapKey`, `Field.mapValue`; new `TypeRef` definition (§10). Pre-0.3 consumers that ignore these fields keep working — map fields have `list: false` and `type: "Map"`.
- **New validation code**: E022 (Map key must be scalar).
- **Generator (`@alaq/graph-link-state`)**: `@range`, `@default`, `@deprecated`, `@auth` emitted as JSDoc blocks above the field so IDE tooling shows them on hover. Previously only comments.

**R500** Generated code includes `specVersion` metadata. Runtimes verify compatibility on connect.
**R501** Compilers declare the SPEC version they implement. Running SDL against a lower-versioned compiler than it requires fails with E018-class error (spec mismatch).

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

These are **not** oversights and **not** scheduled for a future version. They are load-bearing boundaries that keep the SDL small.

| Concern | Where it lives instead |
|---------|------------------------|
| **Authentication / authorization** | Transport layer. HTTP middleware for `graph-axum`, Tauri capabilities / command-level checks for `graph-tauri-rs`, per-topic ACL for `graph-zenoh`. Action without `scope` is the correct shape for admin mutations. `@auth` (§7.4) describes **field visibility**, not auth — it is a read/write filter hint for the runtime, not an identity system. |
| **Transport selection (local vs remote)** | Generator choice. The schema does not *pick* Tauri vs HTTP vs Zenoh; the build pipeline picks the generator by choosing which generator consumes the IR. v0.3.4 added `@transport(kind: ...)` (§7.14) — it **marks intended transport** so tooling can warn on mismatch (W005), but generation still proceeds. `@transport` is advisory, not a control channel; it does not rewire wire mapping, does not reject generators, and does not replace split-file (`arsenal.http.aql` + `arsenal.tauri.aql`). Authors pick whichever expression of intent fits: `@transport` for a single surface, split-file when the SDL itself diverges. |
| **UI commands** (window close / minimize / focus / clipboard) | Out of SDL. Not data operations. Handle natively in the host (Tauri window API, DOM, OS). Do not model `CloseWindow` as an `action`. |
| **Byte streams / file uploads / large blobs** | Out-of-band HTTP endpoints or `opaque stream` (§4.7) for byte-transparent channels. Regular `record`-typed actions are not for multi-megabyte payloads. |
| **Event broadcasts** (one-shot, typed payloads) | **In scope as of v0.3.4.** First-class `event Name { … }` declaration (SPEC §5.5). Pub/sub semantics, not state. Supported out of the box by `@alaq/graph-tauri-rs` / `@alaq/graph-tauri` (Tauri `emit` / `listen`); planned for `@alaq/graph-zenoh` (topic `ns/events/<snake_name>`); explicitly skipped in `@alaq/graph-axum` (HTTP is request/response) with a per-event warning. |
| **Streams** (many typed payloads per session) | Still out-of-scope in v0.3. Events cover the one-shot broadcast case; long-running chunked streams (download progress frames, media, telemetry) continue to live behind `opaque stream` (§4.7) until a concrete cross-consumer design emerges. Promoting streams to first-class is a separate spec decision, not a v0.3.4 extension. |
| **Multi-axis scope** (e.g. `channel × admin × region`) | By design. `@scope` is single-axis (§7.5 R135). Additional axes travel as `input` fields with server-side filtering. |
| **Query vs mutation distinction** | Unified under `action`. GraphQL-style split does not exist here — SDL is codegen+sync, not query (PHILOSOPHY §1, relation table). Generators targeting REST pick HTTP verbs by convention (`@alaq/graph-axum` v0.1: all actions → POST) or by a future target-specific `@http` directive. |
| **Deployment, observability, logging, tracing** | Separate layers (`@alaq/plugin-logi` for observability; deployment is out of the stack entirely). The SDL has no `@trace`, `@metric`, or `@log` directives and will not gain them. |
| **Persistence backend / storage schema** | `@store` (§7.7) declares *that* persistence happens, not *how*. Runtime picks the backend. SDL does not describe SQL tables, indexes, migrations, or key-value layouts. |
| **Identity derivation** (what is a "user", how is owner computed) | Runtime. `@auth(read: "owner")` references the concept; the algorithm is not in SDL (§1, "Out"). |

**R700** Adding any of the above as a first-class SDL construct requires a spec version bump and a concrete, cross-consumer justification — not a single use-case. If one generator needs one of these, the preferred path is a generator-local convention (e.g. `leadingComments` marker, build-config file, naming prefix) until the pattern proves general.
