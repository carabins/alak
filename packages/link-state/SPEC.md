# @alaq/link-state Specification

**Network-Synchronized Graph Object Model (GOM).**

This document defines the architecture, API, and integration patterns for the `link-state` package. It bridges the gap between the abstract GraphQL Schema and the concrete Application Logic.

---

## 1. Core Concept: The Smart Graph

Instead of exposing raw data (`json`) or disconnected services (`api.fetch`), `link-state` generates a **Graph of Smart Nodes**.

*   **Node = Data + Behavior.** A `Player` object has `hp` (data), `move()` (action), and `onDamage` (event).
*   **Graph = Connected.** You can traverse `room.players[0].team.score`.
*   **Lazy = Ghost.** You can access data that hasn't loaded yet. The system fetches it transparently.

---

## 2. GQL Schema Mapping

We map GraphQL concepts to TypeScript constructs.

### A. File Structure
The schema is split into domain files.
*   `schema/globals.graphql` -> Root API methods.
*   `schema/player.graphql` -> `Player` node methods.

### B. Type Mapping

| GQL Concept | TS Runtime | Description |
| :--- | :--- | :--- |
| `type User` | `SyncNode<User>` | A reactive proxy to the store. |
| `field: Type` | `get field()` | Returns a child `SyncNode` (Ghost-capable). |
| `type Mutation` | `api.actions.*` | Low-level RPC calls. |
| `extend Mutation` | `Node.method()` | Context-bound methods (requires `@this`). |
| `type Subscription` | `api.events.*` | Event streams. |
| `@scope` | `StoreFactory` | Manages lifecycle (RefCounting). |

---

## 3. Generated API Structure

The generator produces a typed `ApiClient` class.

```typescript
// generated/api.ts
class ApiClient {
  // 1. Root Queries (Entry Points)
  get me(): SyncNode<Player> { ... }
  
  // Scoped Query (Factory with RefCounting)
  room(id: string): SyncNode<GameRoom> { ... }

  // 2. Actions Namespace (Raw RPC)
  readonly actions: {
    joinRoom(roomId: string, name: string): Promise<void>;
  };

  // 3. Events Namespace
  readonly events: {
    onGlobalMessage: Subscribable<Message>;
  };
}
```

### Smart Nodes (Context Binding)

Mutations defined in domain files with `@this` are attached to the Node class.

```graphql
# player.graphql
extend type Mutation {
  setReady(playerId: ID! @this, ready: Boolean!): Boolean
}
```

**Generates:**

```typescript
class PlayerNode extends SyncNode<Player> {
  // Data (Proxy to SyncStore)
  get isReady() { return this.get('isReady'); }

  // Action (Bound to context)
  setReady(ready: boolean) {
    // "this.id" is injected automatically
    return this.ctx.api.actions.setPlayerReady(this.id, ready);
  }
}
```

---

## 4. Lifecycle Management (RefCounting)

Data in "Scoped" queries (like `room(id)`) must be cleaned up when no longer used.

### Mechanism
`SyncStore` implements a Reference Counting mechanism.
1.  `api.room(id)` -> Checks if store exists.
    *   If no: Create store, connect socket channel, `refCount = 1`.
    *   If yes: `refCount++`.
2.  `node.release()` -> `refCount--`.
    *   If `refCount == 0`: Disconnect channel, delete data from memory.

### Vue Integration (Auto-Release)
To avoid manual `.release()` calls in components, we use a Vue Plugin approach.

**When `api.room(id)` is called inside a Vue `setup()` function:**
1.  The library detects the current Vue instance (`getCurrentInstance()`).
2.  It automatically registers an `onUnmounted` hook.
3.  The hook calls `node.release()` when the component is destroyed.

**Result DX:**
```typescript
<script setup>
const room = api.room(props.id); // Auto-managed lifecycle!
</script>
```

---

## 5. SyncNode Architecture

`SyncNode` is the building block returned by the API.

### Interfaces
1.  **Data Access:** Behaves like a Read-Only Object.
    *   `node.name` -> returns value or `undefined` (if loading).
    *   **Ghosting:** Accessing missing children (`node.config.theme`) returns a **Ghost Proxy**, triggering a fetch if configured via `@qos(LAZY)`.
2.  **Metadata:** Access via `$` prefix.
    *   `node.$meta.isLoading` (Reactive boolean).
    *   `node.$meta.error` (Reactive error).
3.  **Reactivity:** Compatible with `@alaq/atom`, `@alaq/fx`, and Vue.
    *   Can be passed to `reactive(node)` or used in templates directly.

### SyncNode Performance Optimization (Versioned Cache)
To achieve extreme performance in rendering loops (60fps), `SyncNode` uses a version-tracking mechanism to avoid repeated tree traversal.

1.  **Store Versioning:** `SyncStore` maintains a monotonic counter `_version` that increments on every update.
2.  **Reference Caching:** `SyncNode` stores a local `_cachedRef` and `_lastVersion`.
3.  **Fast Path:** Accessing `node.value` only re-resolves the path if `node._lastVersion !== store._version`. Otherwise, it returns the cached reference immediately.

---

## 6. Implementation Plan

1.  **`@alaq/link-state` (Core):**
    *   `SyncStore` implementation (Map-based normalized cache).
    *   `SyncNode` proxy logic (Ghosting).
    *   RefCounting logic.

2.  **`@alaq/gql` (Generator):**
    *   Parser for `@scope`, `@this`, `@qos`.
    *   TS Generator for `ApiClient` and `Nodes`.

3.  **`@alaq/link-state-vue` (Integration):**
    *   Plugin to inject `api`.
    *   Logic to hook into `onUnmounted` for auto-release.
