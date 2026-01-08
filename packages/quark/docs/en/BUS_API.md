# Quantum Bus API Reference

The **Quantum Bus** is the event distribution system connecting Quarks, Realms, and the outside world.

## Imports

```typescript
import { quantumBus, CHANGE, AWAKE } from '@alaq/quark'
```

## Constants

- **`CHANGE`**: `'CHANGE'` - The standard event name for value updates.
- **`AWAKE`**: `'AWAKE'` - Emitted when a quark gets its first listener (rarely used directly).

---

## `quantumBus` (Manager)

The global singleton that manages all Realms.

### `.getRealm(name)`
Returns a `RealmBus` instance for the given name. Creates one if it doesn't exist.

```typescript
const uiBus = quantumBus.getRealm('ui')
```

### `.emit(realm, event, data)`
Emits an event to a specific realm from the global scope.

```typescript
quantumBus.emit('ui', 'CLICK', { x: 10, y: 10 })
```

---

## `RealmBus`

Represents a specific channel (Realm) on the bus.

### `.onScope(scope, event, listener)`
Subscribes to events within a specific scope and its sub-scopes.
- **scope** *(string)*: Scope name (e.g., `'user.1'`).
- **event** *(string)*: Event name.

```typescript
// Listens to events from this specific user and all their properties
bus.onScope('user.1', 'CHANGE', data => console.log(data))
```

### `.emitInScope(scope, event, data)`
Emits an event into a specific scope with **bubbling**.
The event will be delivered to:
1. Exact scope subscribers (`user.1.name`).
2. Parent scope subscribers (`user.1`, `user`).
3. Global subscribers (`on(event)`).

```typescript
// Notifies:
// 1. onScope('user.1.name', ...)
// 2. onScope('user.1', ...)
// 3. onScope('user', ...)
// 4. on('CHANGE', ...)
bus.emitInScope('user.1.name', 'CHANGE', { val: 'John' })
```

### `.offScope(scope, event, listener)`
Unsubscribes a listener from a specific scope.

### `.on(event, listener)`
Subscribes to an event **globally** (catches events from any scope).

```typescript
const bus = quantumBus.getRealm('app')

// 1. Specific
bus.on('LOGIN', data => console.log('User logged in', data))
```

### `.off(event, listener)`
Unsubscribes a listener.

```typescript
bus.off('LOGIN', myListener)
```

### `.emit(event, data)`
Emits an event within this realm.

```typescript
// Listeners will receive: { id: 'btn', value: 'clicked' }
bus.emit('CHANGE', { id: 'btn', value: 'clicked' })
```

### `.clear()`
Removes ALL listeners from this realm. Useful for cleanup/testing.

```typescript
bus.clear()
```
