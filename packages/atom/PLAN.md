# @alaq/atom v6 - Architecture & Implementation Plan

## 1. Core Philosophy
**Atom is an Orchestrator.** It parses a Model Class, processes its properties and methods, and wraps everything in a Proxy. It delegates state management to **Nucl** and **Fusion** instances.

*   **Orbit-based Configuration**: Uses `kind()` to return an "Orbit" (config object). Explicit `kind` is optional.
*   **Dynamic Discovery**: Supports properties initialized in `constructor`.
*   **Privacy by Convention**: Properties/methods starting with `_` are hidden from public TS interfaces but accessible in runtime.
*   **Plugin-driven Logic**: All conventions (like `_up` listeners) are implemented as pluggable modules.
*   **Direct Mutation**: Actions change state directly (`this.count++`), intercepted by Proxy.

## 2. API Design

### Defining a Model
```typescript
import { kind } from '@alaq/atom'

class UserModel {
  // 1. Default (becomes Nucl automatically)
  name = "Guest"

  // 2. Explicit Orbit via kind()
  token = kind("stored", null)

  // 3. Private property (Runtime accessible via this, TS hidden from interface)
  _internalId = Math.random()

  constructor() {
    // 4. Dynamic property (becomes Nucl automatically)
    this.count = 0
  }

  // 5. Computed (Fusion, default strategy: "alive")
  // Accessing this via atom.$displayName returns the Fusion instance
  get displayName() {
    return `${this.name} (#${this.count})`
  }

  // 6. Action
  inc() {
    this.count++ // Direct mutation via Proxy
  }
  
  // 7. Convention: Auto-wiring (via ConventionPlugin)
  _name_up(val: string) {
    console.log("Name changed:", val)
  }
  
  // 8. Convention: Bus Listener (via ConventionPlugin)
  _on_LOGOUT() {
    this.token = null
  }
}
```

### Using an Atom
```typescript
const user = Atom({
  model: UserModel,
  options: {
    realm: "app",        // Namespace for events (QuantumBus realm)
    name: "user",         // Prefix for events: "user.propName"
    constructorArgs: [],  // Args for new UserModel(...args)
    emitChanges: true,    // Automatically emit "name.prop" to bus on change
    plugins: []           // Custom plugins (undefined = defaults)
  }
})

user.name = "Admin"    // Triggers Nucl
console.log(user.$name) // Access to Nucl instance
user.$displayName.up(v => ...) // Subscribe to computed
user.inc() // Call action
```

## 3. Architecture Layers

### Layer 1: Orbit & Kind
`kind(name, value)` returns an `Orbit` object `{ kind: string, value: any, options?: any }`. 
If a property is assigned a primitive, the factory treats it as a default Orbit (kind: "nucleus").

### Layer 2: Plugin System
Hooks for extending Atom behavior. Plugins are passed in options.
*   `onSetup(model, options)`: Before analysis.
*   `onProp(key, orbit, atom)`: Modify Orbit before Nucl creation.
*   `onMethod(key, fn, atom)`: Intercept/wrap methods.
*   `onInit(atom)`: Final wiring (listeners, bus subscriptions).

**Default Plugins (included by default):**
*   `ConventionsPlugin`: Handles `_prop_up` (reactivity) and `_on_EVENT` (bus).
*   `ComputedPlugin`: Transforms getters into `Fusion` instances.

### Layer 3: Proxy & Privacy
The Proxy handles:
1.  **State access**: Mapping `atom.prop` to `nucl.value` (getter) and `nucl(val)` (setter).
2.  **Ref access**: Mapping `atom.$prop` to the `Nucl` instance.
3.  **Context access**: `atom.$` provides `{ bus, decay, options }`.
4.  **Privacy**: Filters out `_` keys from `Object.keys`. 
    *   *Note*: Inside class methods, `this` refers to the Proxy, so `this._private` works in runtime.
    *   *Types*: Generated TS interfaces omit `_` members.

### Layer 4: Event Bus (Quark)
Integration with `@alaq/quark/quantum-bus`:
*   `options.realm` defines the bus instance: `atom.$.bus = quantumBus.getRealm(options.realm)`.
*   If `options.emitChanges` is true, every Nucl update calls `atom.$.bus.emit(`${options.name}.${prop}`, value)`.
*   This allows cross-atom communication via `_on_OTHER_ATOM_PROP_CHANGE` or global listeners.

## 4. Implementation Steps

### Phase 1: Primitives & Types
1.  **`src/orbit.ts`**: Implement `kind`, `Orbit` interface.
2.  **`src/types.ts`**: Define `AtomInstance`, `AtomOptions`, `AtomPlugin`. Ensure `_` exclusion in mapped types.

### Phase 2: Factory & Discovery (`src/atom.ts`)
1.  **Instantiation**: Create raw instance, run constructor to capture dynamic props.
2.  **Discovery**: Scan all own properties (Nucl candidates) and prototype members (Method/Getter candidates).
3.  **Creation**: Initialize `Nucl` for data and `Fusion` for getters.
4.  **Binding**: Bind methods to the Proxy.

### Phase 3: Plugin Integration (`src/plugins/`)
1.  Implement the hook runner in Factory.
2.  **`src/plugins/conventions.ts`**: Regex-based scanning for `_up` and `_on_`.
3.  **`src/plugins/computed.ts`**: Getter-to-Fusion transformation.

### Phase 4: Integration
1.  Connect `quantumBus` via `options.realm`.
2.  Verify `this` context behavior.
3.  Update exports and documentation.

## 5. Performance & Constraints
*   **Initialization**: Minimize object allocation per atom.
*   **Memory**: Shared prototypes where possible, though Proxy requires per-instance binding.
*   **Safety**: `atom.$.decay()` must unsubscribe all auto-wired listeners and bus events.