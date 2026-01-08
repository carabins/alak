# Atom API Reference

**Atom** is a high-level orchestrator that transforms regular TypeScript/JavaScript classes into reactive data models.

## `Atom(Model, options)` Factory

Creates an instance of the specified class, wrapping it in a Proxy to manage reactivity.

### Parameters
- **`Model`**: The class describing the data structure.
- **`options`**: Configuration object (optional).

### Options (AtomOptions)
- **`name`** *(string)*: Model name (used for debugging and event ID generation).
- **`realm`** *(string)*: Quantum Bus realm (defaults to `root`).
- **`nuclearKind`** *(string)*: Global default nucleon kind for all model properties.
- **`plugins`** *(AtomPlugin[])*: Array of plugins. If omitted, default plugins are used (`ComputedPlugin`, `ConventionsPlugin`).
- **`emitChanges`** *(boolean)*: If true, every property change is broadcast to the Quantum Bus.
- **`constructorArgs`** *(any[])*: Arguments passed to the class constructor upon creation.

---

## Instance Behavior (Proxy)

Atom uses Proxies to intercept access to properties and methods of the class.

### 1. Properties -> Nucleons
Every class field automatically becomes a reactive nucleon (`Nucl`).
- **Read**: `atom.count` returns the value from the nucleon.
- **Write**: `atom.count = 5` updates the nucleon and notifies subscribers.

### 2. Accessing Raw Nucleons (`$`)
You can access the nucleon object itself (to use methods like `.up()`, `.push()`, etc.) by adding a `$` prefix to the property name.

```typescript
const store = Atom(class { count = 0 });

store.count;      // 0 (value)
store.$count;     // Nucl instance (object)
store.$count.up(v => console.log(v));
```

### 3. Model Context (`$`)
The `$` property (single dollar sign) provides access to the atom's management context.

#### Context Properties (`atom.$`):
- **`.bus`**: Reference to the `RealmBus` for this model.
- **`.options`**: Options passed during creation.
- **`.on(event, listener)`**: Subscribes to bus events with automatic cleanup when the atom is destroyed.
- **`.addDisposer(fn)`**: Registers a function to be called during `decay()`.
- **`.decay()`**: Complete destruction of the instance (clears all nucleons, subscribers, and plugins).

---

## Property Typing (`kind`)

Use the `kind` function to specify the nucleon type and additional options directly inside the class definition.

```typescript
import { Atom, kind } from '@alaq/atom';

class User {
  // count will be a 'std' nucleon
  count = kind('std', 0);
  
  // list will be a 'std' nucleon with extra Quark options
  list = kind('std', [], { dedup: false });
}
```

---

## Computed Properties

The `ComputedPlugin` is enabled by default, transforming all class getters into automatic computed values based on `fusion`.

```typescript
const store = Atom(class {
  firstName = 'John';
  lastName = 'Doe';

  get fullName() {
    return `${this.firstName} ${this.lastName}`;
  }
});

// fullName automatically recalculates when firstName or lastName changes
```

---

## Instance Destruction

The `atom.$.decay()` method performs the following actions:
1. Calls all registered disposers.
2. Unsubscribes all event listeners created via `atom.$.on()`.
3. Calls `.decay()` on all internal nucleons.
4. Triggers the `onDecay` hook for all plugins.
