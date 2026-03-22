# @alaq/gql: The Meta-Compiler

**Zero-Runtime Overhead GraphQL-to-Everything Generator.**

`@alaq/gql` is the "brain" of the ecosystem. It translates an abstract Game Schema (SDL) into highly optimized code for the Client (TS), Server (Go/TS), and Network (`@alaq/link`).

## 1. Philosophy

### A. Schema as Single Source of Truth (SSOT)
If it's not in `.graphql`, it doesn't exist in the network layer.
We use GraphQL SDL not just for API queries, but as a definition language for **State**, **Events**, and **Persistence**.

### B. Zero Runtime Overhead
We do NOT parse GraphQL at runtime.
All logic is compiled AOT (Ahead-of-Time) into static TypeScript interfaces and Golang structs. The runtime code is fast, strictly typed, and minimal.

### C. Directive-Driven
We control behavior via directives (`@qos`, `@auth`, `@store`). The generator reads these directives and produces different code paths (e.g., using `UDP` for `@qos(REALTIME)` vs `HTTP` for `@qos(LAZY)`).

---

## 2. Directives Specification

### `@sync(qos: QoS = RELIABLE, mode: SyncMode = EAGER, atomic: Boolean = false)`
Controls the network delivery strategy and lifecycle.

**QoS (Transport):**
*   **`RELIABLE` (Default):** Guaranteed delivery, ordered. Uses Versioning/Hashing. (Stream/WebSocket)
*   **`REALTIME`:** Fast, unreliable, unordered. (Datagrams/UDP)
    *   *Note:* In future, we might add `store: false` option here to bypass SyncStore for particle systems (Volatile Mode).

**SyncMode (Lifecycle):**
*   **`EAGER` (Default):** Loaded immediately with parent.
*   **`LAZY`:** Loaded on demand (Ghost Proxy -> Fetch).

**Atomic (Structure):**
*   **`false` (Default):** Deep sync (nested properties are tracked individually).
*   **`true`:** Atomic blob. The object is treated as a single unit. No deep diffing. (Useful for Vec2, Matrix, JSON configs).

### `@atomic`
Standalone directive. Marks an object or field as atomic (structurally indivisible).
Equivalent to `atomic: true` in sync configuration.

### `@auth(read: Access, write: Access)`
Controls visibility and permissions.
*   `public`, `owner`, `room`, `server`.

### `@store`
Marks data for persistence (Database). Without this, data is ephemeral (Memory-only).

### `@scope(name: String!)`
Defines the lifecycle context (`global`, `room`, `session`).

### `@this`
Used in `extend type Mutation` to bind an argument to the context of the calling object.

```graphql
# player.graphql
type Player { id: ID! }

extend type Mutation {
  # Generated method: player.move(x, y)
  # The 'id' argument is taken from 'this.id'
  move(id: ID! @this, x: Float!, y: Float!): Boolean
}
```

---

## 3. File Structure & Organization

We encourage splitting the schema into domain-specific files.

*   **`globals.graphql`**: Root types (`Query`, `Mutation`), global shared types.
*   **`domain.graphql`** (e.g., `player.graphql`): Type definitions and their specific mutations.

**Rule:** `extend type Mutation` blocks in a file are logically grouped with the primary type defined in that file.

---

## 4. Generator Architecture

### Input
A set of `.graphql` files.

### Process
1.  **Parser:** Standard `graphql/language` parses SDL to AST.
2.  **Compiler:** Transforms AST into an internal **IR (Intermediate Representation)** optimized for our needs (resolving types, flattening interfaces).
3.  **Generators:**
    *   `ts-client`: Interfaces (`IPlayer`), `SyncStore` definitions, and `NetworkClient` class.
    *   `go-server`: Structs (`type Player struct`), Interfaces (`GameLogic`), and `quic-go` handlers.
    *   `docs`: OpenAPI / AsyncAPI specs.

---

## 4. Example

**Input (SDL):**
```graphql
type Player {
  hp: Int! # Default: RELIABLE
  pos: Vec2! @qos(REALTIME)
  inventory: [Item!]! @qos(LAZY)
}
```

**Output (TS Client):**
```typescript
class PlayerSync {
  // RELIABLE: Syncs via patch stream
  hp: number; 
  
  // REALTIME: Updated via datagram handler
  pos: Vec2;
  
  // LAZY: Ghost Proxy that triggers fetch() on access
  get inventory(): Item[] { ... }
}
```
