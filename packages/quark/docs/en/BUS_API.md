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

### `.on(event, listener)`
Subscribes to an event in this realm.
- **event** *(string)*: Event name. Supports wildcards.
- **listener**: `(payload) => void`

**Event Patterns:**
- `'EVENT_NAME'`: Listen to specific event.
- `'*'`: Listen to **all** events in this realm.
- `'realm:event'`: Listen to an event from **another** realm (Cross-Realm).
- `'*:*'`: Global wildcard (listen to everything everywhere).

```typescript
const bus = quantumBus.getRealm('app')

// 1. Specific
bus.on('LOGIN', data => console.log('User logged in', data))

// 2. Wildcard
bus.on('*', payload => {
  // payload is { event: 'LOGIN', data: ... }
  console.log(`Event ${payload.event} happened`)
})
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
