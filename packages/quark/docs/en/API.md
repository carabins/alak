# Quark API Reference

This document details the API for creating and managing Quarks — the fundamental reactive units.

## Factories

### `Qu(options)`
Creates a new Quark instance.

**Options:**
- `value` *(any)*: Initial value.
- `id` *(string)*: Unique identifier (useful for debugging/events).
- `realm` *(string)*: The realm name this quark belongs to.
- `dedup` *(boolean)*: If false, disables deduplication (default: true).
- `stateless` *(boolean)*: If true, does not store value, only emits events.
- `emitChanges` *(boolean)*: If true, automatically emits `CHANGE` events to the Quantum Bus.
- `emitChangeName` *(string)*: Custom event name instead of default `CHANGE`.
- `pipe` *(function)*: A transform function `(val) => val` applied before setting value.

```typescript
import { Qu } from '@alaq/quark'

const q = Qu({ value: 10, id: 'counter' })
```

### `Qv(value, options)`
A shortcut to create a Quark with a value immediately.

```typescript
import { Qv } from '@alaq/quark'

const q = Qv(10, { id: 'counter' })
```

---

## Quark Instance

A Quark is a callable object.
- **Get:** Access `.value`.
- **Set:** Call `quark(newValue)` or set `.value`.

```typescript
console.log(q.value) // Read
q(20)                // Write
q.value = 30         // Write (equivalent)
```

### Methods

#### `.up(listener)`
Subscribes to value changes.
- **listener**: `(value, quark) => void`
- *Returns:* `this` (chainable).

> **Note:** The listener is called immediately upon subscription with the current value.

```typescript
q.up(val => console.log('Updated:', val))
```

#### `.down(listener)`
Unsubscribes a listener.

```typescript
const log = v => console.log(v)
q.up(log)
q.down(log)
```

#### `.silent(value)`
Updates the value **without** triggering listeners or bus events.

```typescript
q.silent(100) // No console logs, no side effects
```

#### `.pipe(fn)`
Sets a transformation function that runs before every update.
- **fn**: `(newValue) => transformedValue`

```typescript
// Clamp value between 0 and 100
q.pipe(v => Math.min(100, Math.max(0, v)))
```

#### `.dedup(enable)`
Enables or disables deduplication.
- **enable** *(boolean)*: Default `true`.

```typescript
q.dedup(true)
q(5)
q(5) // Ignored, no events emitted
```

#### `.stateless(enable)`
Enables or disables stateless mode. In stateless mode, `.value` is not stored (or keeps previous), but listeners are still fired.

#### `.decay()`
Destroys the quark.
- Clears all listeners (`edges`).
- Removes value reference.
- Resets flags.
