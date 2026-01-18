# @alaq/link-state: Synchronized State Engine

This package implements the **Client-Side Replica** logic. It connects the abstract Network Layer (`@alaq/link`) with the concrete Application Logic (`@alaq/atom`).

## 1. Core Architecture: The SyncStore

`SyncStore` is a specialized **In-Memory Database** that holds the entire replicated state of the application.

*   **Flat Structure:** Data is normalized (e.g., `players: Map<ID, Player>`).
*   **Versioned:** Every object has a `_v` (version) or `_h` (hash) field.
*   **Reactive:** Built on top of `@alaq/deep-state`.

```typescript
// The monolithic store (hidden from developer)
const store = new SyncStore({
  schema: GeneratedSchema,
  transport: link
});
```

## 2. Ghost Proxies & Lazy Loading

To provide a seamless DX (Developer Experience), `link-state` implements **Ghost Objects**.

**Problem:**
Accessing `store.player.inventory[0].name` before data is loaded usually throws `undefined` error.

**Solution:**
1.  Accessing `store.player` (missing) returns a **Ghost Proxy**.
2.  The Ghost Proxy automatically triggers a `subscribe()` or `fetch()` request based on the schema directives (`@qos`).
3.  Accessing nested props on a Ghost returns more Ghosts (`ghost.inventory` -> `GhostArray`).
4.  When data arrives, the Proxy target is swapped to the real object. Reactivity (`.up()`) fires.

**Result:**
Developer code doesn't need `if (loading) return null` checks everywhere.

## 3. Handling QoS Strategies

`SyncStore` handles the three `@qos` modes defined in `@alaq/gql`.

### A. RELIABLE (Default)
*   **Behavior:** Subscribe to Server Stream.
*   **Sync:** Applies JSON-Patch / Binary-Patch sequence.
*   **Consistency:** Guarantees eventual consistency via Version Check.

### B. REALTIME
*   **Behavior:** Listen to Datagrams.
*   **Sync:** "Last Write Wins" (Snapshot interpolation).
*   **Buffer:** Uses a Ring Buffer to smooth out jitter (Interpolation Buffer).

### C. LAZY (Http)
*   **Behavior:** On access (via Ghost), triggers `link.fetch()`.
*   **Cache:** Checks Browser Cache (Cache API) and `SyncStore` in-memory cache first.
*   **Stale-While-Revalidate:** Can return stale data while fetching fresh data in background.

---

## 4. Integration with View (SyncNode)

`SyncStore` returns **SyncNodes**, not just plain data or Atoms.
A `SyncNode` behaves like a `Nucl` but carries metadata about the network state.

```typescript
const player = api.state.me; // SyncNode<Player>

// 1. Data Access (Reactive)
// If data is missing (Ghost), returns undefined but triggers load.
console.log(player.name); 

// 2. Metadata Access ($ prefix)
player.$name.isLoading.up(v => console.log('Loading:', v));
player.$name.error.up(err => console.error('Failed:', err));

// 3. Status
if (player.$meta.isGhost) {
  // It's a placeholder
}
```

## 5. API Structure & DX

The generated `ApiClient` separates concerns to avoid collisions while providing convenient shortcuts.

### Namespaces
*   **`api.state`**: Access to reactive data (Queries). Returns `SyncNode`.
*   **`api.actions`**: RPC methods (Mutations). Returns `Promise`.
*   **`api.events`**: Event streams (Subscriptions). Returns `Subscribable`.

### Context Binding (Sugar)
Mutations defined in domain files (e.g., `player.graphql`) with the `@this` directive are generated as methods on the `SyncNode`.

```typescript
// player.move(x, y) calls api.actions.move(player.id, x, y)
player.move(10, 20); 
```

## 6. Scope Management (Rooms)

How to manage lifecycle of data that is only needed temporarily (e.g., inside a Game Room)?

### Reference Counting
Stores generated for scoped queries (like `room(id: ID)`) implement **Reference Counting**.

```typescript
// Component setup
const room = api.state.room(myRoomId); // refCount++

// Component unmount
room.release(); // refCount--. If 0 -> destroy store & unsubscribe.
```

This ensures we don't keep listening to socket channels for rooms the user has left.
