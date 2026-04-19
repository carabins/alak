# @alaq/graph — SDL Specification

**Version:** 0.3
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
SchemaDecl     = "schema" , Identifier , "{" , SchemaField , { SchemaField } , "}" ;
SchemaField    = ( "version" , ":" , IntLit )
               | ( "namespace" , ":" , StringLit ) ;
UseDecl        = "use" , StringLit , "{" , Identifier , { "," , Identifier } , "}" ;

Definition     = RecordDecl | ExtendDecl | ActionDecl | EnumDecl
               | ScalarDecl | OpaqueDecl ;

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
**R002** Whitespace between tokens is insignificant. Newlines are whitespace.
**R003** Field bodies, action input bodies, and **enum member lists** accept comma-less or comma-separated entries; both are valid. Trailing commas are allowed. One file should use one style. (v0.3: the parser was previously strict about enum commas — fixed.)
**R004** `Identifier` pattern: `/^[A-Za-z_][A-Za-z0-9_]*$/`.

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

See §6.

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
        "opaques": { "type": "object", "additionalProperties": { "$ref": "#/$defs/Opaque" } }
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
        "topic": { "type": ["string", "null"] }
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
        "mapKey":    { "$ref": "#/$defs/TypeRef", "description": "v0.3: key type; present iff map=true." },
        "mapValue":  { "$ref": "#/$defs/TypeRef", "description": "v0.3: value type; present iff map=true." },
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
        "directives": { "type": "array", "items": { "$ref": "#/$defs/Directive" } }
      }
    },
    "Enum": {
      "type": "object",
      "required": ["name", "values"],
      "properties": {
        "name": { "type": "string" },
        "values": { "type": "array", "items": { "type": "string" } }
      }
    },
    "Scalar": {
      "type": "object",
      "required": ["name"],
      "properties": { "name": { "type": "string" } }
    },
    "Opaque": {
      "type": "object",
      "required": ["name", "qos"],
      "properties": {
        "name": { "type": "string" },
        "qos": { "type": "string" },
        "maxSize": { "type": "integer" }
      }
    },
    "Directive": {
      "type": "object",
      "required": ["name"],
      "properties": {
        "name": { "type": "string" },
        "args": { "type": "object", "additionalProperties": true }
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

### Warnings

- **W001** `@sync(qos: REALTIME)` on composite (record-typed) field without `@atomic`.
- **W002** `@store` without explicit `@sync`; defaults to `RELIABLE`.
- **W003** Record has `@crdt` but no `Timestamp!` field named `updated_at`.
- **W004** Directive declared but target does not use it (detected by generator context; advisory only).

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
