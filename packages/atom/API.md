# @alaq/atom - Complete API Documentation

## Table of Contents

- [Core Concepts](#core-concepts)
- [Atom Constructor](#atom-constructor)
- [AtomInstance API](#atominstance-api)
- [Property Markers](#property-markers)
- [Plugin System](#plugin-system)
- [Computed Properties](#computed-properties)
- [Event Bus](#event-bus)
- [TypeScript Types](#typescript-types)
- [Advanced Usage](#advanced-usage)

---

## Core Concepts

### What is an Atom?

An **Atom** is a reactive state container that transforms a model (class or object) into a reactive structure where:
- **Properties** become reactive Quark containers
- **Methods** become actions bound to reactive state
- **Getters** become computed properties with auto-tracked dependencies

### Architecture Layers

```
┌─────────────────────────────────┐
│      atom.state (Proxy)         │ ← User-facing state access
├─────────────────────────────────┤
│      atom.actions               │ ← Methods with reactive this
├─────────────────────────────────┤
│      atom.core (Quarks)         │ ← Direct container access
├─────────────────────────────────┤
│   @alaq/nucl (Fusion)           │ ← Computed properties
├─────────────────────────────────┤
│   @alaq/quark (Containers)      │ ← Reactive primitives
└─────────────────────────────────┘
```

---

## Atom Constructor

### Signature

```typescript
function Atom<T>(
  model: T | (new (...args: any[]) => T),
  options?: AtomOptions
): AtomInstance<T>
```

### Parameters

#### `model: T | (new (...args: any[]) => T)`

The model to convert into an atom. Can be:

**1. Plain Object**
```typescript
const counter = Atom({
  count: 0,
  step: 1,
  increment() {
    this.count += this.step
  }
})
```

**2. ES6 Class**
```typescript
class Counter {
  count = 0
  step = 1

  increment() {
    this.count += this.step
  }
}

const counter = Atom(Counter)
```

**3. Class with Constructor**
```typescript
class User {
  name: string

  constructor(initialName: string) {
    this.name = initialName
  }
}

const user = Atom(User, { constructorArgs: ['John'] })
```

#### `options?: AtomOptions`

Optional configuration object:

```typescript
interface AtomOptions {
  /** Atom name - appended to realm for full path */
  name?: string

  /** Realm namespace (default: '+' for global) */
  realm?: string

  /** Container constructor (default: Qu from @alaq/quark) */
  container?: (options: any) => any

  /** External event bus (default: creates new from quantumBus) */
  bus?: any

  /** Arguments passed to class constructor */
  constructorArgs?: any[]

  /** Emit NUCLEUS_CHANGE events on property changes */
  emitChanges?: boolean
}
```

### Options Details

#### `name` - Atom Name

Identifies the atom within its realm. Combined with realm to form full path.

```typescript
const user = Atom(User, {
  realm: 'app',
  name: 'currentUser'
})
// Full realm: 'app.currentUser'
// Quark IDs: 'app.currentUser.name', 'app.currentUser.age', etc.
```

**Without name:**
```typescript
const settings = Atom(Settings, { realm: 'app' })
// Realm: 'app'
// Quark IDs: 'app.theme', 'app.language', etc.
```

#### `realm` - Namespace

Organizes atoms into hierarchical namespaces. Default is `'+'` (global realm).

```typescript
// Global realm (default)
const atom1 = Atom(Model)
// Realm: '+'

// Application realm
const atom2 = Atom(Model, { realm: 'app' })
// Realm: 'app'

// Nested realm
const atom3 = Atom(Model, { realm: 'app.users', name: 'profile' })
// Realm: 'app.users.profile'
```

**Realm affects:**
- Event bus isolation
- Quark ID prefixes
- Cross-atom communication

#### `container` - Custom Container

Override the default Quark constructor:

```typescript
import { Nucl } from '@alaq/nucl/nucleus'

const atom = Atom(Model, {
  container: Nucl  // Use Nucl instead of Qu
})

// Now atom.core properties are Nucl instances with plugins
atom.core.value.push('item')  // If Nucl has array plugin
```

**Use cases:**
- Using Nucl with specific plugins
- Custom reactive primitive
- Wrapper for additional behavior

#### `bus` - External Event Bus

Share event bus between multiple atoms:

```typescript
import { quantumBus } from '@alaq/quark/quantum-bus'

const sharedBus = quantumBus.getRealm('shared')

const atom1 = Atom(Model1, { bus: sharedBus })
const atom2 = Atom(Model2, { bus: sharedBus })

// Both atoms share the same event bus
sharedBus.on('CUSTOM_EVENT', (data) => {
  console.log('Received:', data)
})

atom1.bus.emit('CUSTOM_EVENT', { from: 'atom1' })
```

#### `constructorArgs` - Constructor Arguments

Pass arguments to class constructor:

```typescript
class Database {
  connection: Connection

  constructor(url: string, options: DbOptions) {
    this.connection = connect(url, options)
  }
}

const db = Atom(Database, {
  constructorArgs: [
    'mongodb://localhost',
    { poolSize: 10 }
  ]
})
```

**Note:** Constructor is called twice:
1. During `parseModel()` to extract field default values
2. After atom setup with `state` proxy as `this` for initialization logic

#### `emitChanges` - Auto-emit Events

Enable automatic `NUCLEUS_CHANGE` events:

```typescript
const user = Atom(User, {
  realm: 'app',
  emitChanges: true
})

user.bus.on('NUCLEUS_CHANGE', ({ key, value, realm }) => {
  console.log(`${realm}.${key} changed to:`, value)
})

user.state.name = 'John'
// Logs: "app.name changed to: John"
```

---

## AtomInstance API

The object returned by `Atom()` constructor.

### Structure

```typescript
interface AtomInstance<T> {
  core: Record<string, Quark>
  state: T
  actions: Record<string, Function>
  bus: RealmBus
  decay(): void
  _internal: InternalState
}
```

### `atom.core` - Direct Quark Access

Access reactive containers directly.

```typescript
const user = Atom({
  name: '',
  age: 0
})

// Get quark
const nameQuark = user.core.name

// Read value
nameQuark.value  // ''

// Set value
nameQuark('John')

// Subscribe to changes
nameQuark.up((newValue) => {
  console.log('Name changed:', newValue)
})

// Unsubscribe
nameQuark.down(listener)

// Cleanup
nameQuark.decay()
```

**Use cases:**
- Fine-grained subscriptions
- Advanced reactive patterns
- Integration with other reactive systems
- Performance-critical operations

### `atom.state` - State Proxy

Convenient getter/setter access to values.

```typescript
const counter = Atom({
  count: 0,
  step: 1
})

// Read
counter.state.count  // 0

// Write
counter.state.count = 10

// Computed (getter)
counter.state.doubled  // read-only
```

**Features:**
- Transparent property access
- Works with all JavaScript operators (`++`, `+=`, etc.)
- Computed properties are read-only
- TypeScript type-safe

**Implementation:**
```typescript
const state = new Proxy({}, {
  get(_, key) {
    // Returns quark.value or computed.value
  },
  set(_, key, value) {
    // Calls quark(value)
    return true
  }
})
```

### `atom.actions` - Methods

Methods from the model bound to `state` proxy.

```typescript
class Counter {
  count = 0

  increment() {
    this.count++  // this = state proxy
  }

  add(n: number) {
    this.count += n
  }
}

const counter = Atom(Counter)

counter.actions.increment()
console.log(counter.state.count)  // 1

counter.actions.add(5)
console.log(counter.state.count)  // 6
```

**Characteristics:**
- `this` inside methods is `state` proxy
- Property access triggers reactivity
- Can call other actions
- Can read computed properties

### `atom.bus` - Event Bus

RealmBus instance for this atom's realm.

```typescript
const user = Atom(User, { realm: 'app.users' })

// Subscribe to events
user.bus.on('USER_UPDATED', (data) => {
  console.log('User updated:', data)
})

// Emit events
user.bus.emit('USER_UPDATED', { id: 123 })

// Listen to all events in realm
user.bus.on('*', ({ event, data }) => {
  console.log(`Event ${event}:`, data)
})

// Cross-realm subscription
user.bus.on('admin:SETTINGS_CHANGED', (data) => {
  console.log('Admin settings changed:', data)
})

// Wildcard (all realms)
user.bus.on('*:*', ({ realm, event, data }) => {
  console.log(`${realm}:${event}`, data)
})
```

**Built-in Events:**

**`ATOM_INIT`** - Emitted on first property access
```typescript
atom.bus.on('ATOM_INIT', ({ realm }) => {
  console.log('Atom initialized in realm:', realm)
})
```

**`QUARK_INIT`** - Emitted by Quark when created (from quark itself)
```typescript
atom.bus.on('QUARK_INIT', ({ id, quark }) => {
  console.log('Quark created:', id)
})
```

**`NUCLEUS_CHANGE`** - Emitted on value change (if `emitChanges: true`)
```typescript
atom.bus.on('NUCLEUS_CHANGE', ({ key, value, realm }) => {
  console.log(`${realm}.${key} = ${value}`)
})
```

### `atom.decay()` - Cleanup

Destroys the atom and all resources.

```typescript
const atom = Atom(Model)

// Use atom...

atom.decay()  // Cleanup
```

**What it does:**
1. Calls plugin `onDecay()` hooks
2. Decays all quarks (`atom.core.*`)
3. Decays all computed properties
4. Clears subscriptions
5. Marks atom as destroyed

**When to call:**
- Component unmount (React/Vue)
- Route change
- Application shutdown
- Memory cleanup

### `atom._internal` - Internal State

For advanced use cases and debugging.

```typescript
interface InternalState {
  realm: string                    // Full realm path
  containers: Record<string, any>  // Created quarks
  computed: Record<string, any>    // Computed fusions
  model: any                       // Original model
  initialized: boolean             // ATOM_INIT emitted?
}
```

**⚠️ Warning:** Internal API - may change between versions.

---

## Property Markers

### `synthesis()` - Marker Composition

Combine multiple property markers:

```typescript
import { synthesis } from '@alaq/atom'
import { saved } from '@alaq/atom-persist'
import { tag } from '@alaq/atom-meta'

class Settings {
  // Single marker
  theme = saved('dark')

  // Multiple markers
  email = synthesis(
    saved('user@example.com'),
    tag('contact'),
    validate(isEmail)
  )
}
```

**Signature:**
```typescript
function synthesis(...markers: any[]): ComposedMarker

interface ComposedMarker {
  _marker: Symbol
  _isComposed: true
  value: any        // From first marker with value
  markers: any[]    // All markers
}
```

**Rules:**
- Value is taken from first marker that has `value` property
- All markers are preserved in `markers` array
- Plugins detect markers via `detectMarker()`

### Creating Markers

```typescript
const MY_SYMBOL = Symbol.for('my-plugin:marker')

export function myMarker(value: any, options = {}) {
  return {
    _marker: MY_SYMBOL,
    value,
    ...options
  }
}
```

### Using Markers

```typescript
import { Atom, use } from '@alaq/atom'
import { myPlugin, myMarker } from './my-plugin'

use(myPlugin)

const atom = Atom({
  field: myMarker(42, { custom: 'option' })
})
```

---

## Plugin System

### Plugin Interface

```typescript
interface AtomPlugin {
  /** Unique plugin identifier */
  symbol: Symbol

  /** Detect if value is a marker for this plugin */
  detectMarker?(value: any): boolean

  /** Called when quark with markers is created */
  onQuarkProperty?(context: {
    atom: AtomInstance
    quark: Quark
    key: string
    markers: any[]
  }): void

  /** Called after all quarks are created */
  onCreate?(
    atom: AtomInstance,
    markedProperties: Record<string, any[]>
  ): void

  /** Called when atom.decay() is invoked */
  onDecay?(atom: AtomInstance): void
}
```

### Creating a Plugin

**Example: Logger Plugin**

```typescript
import type { AtomPlugin } from '@alaq/atom'

const LOGGER_SYM = Symbol.for('atom:logger')

// Marker function
export function logged(value: any) {
  return {
    _marker: LOGGER_SYM,
    value
  }
}

// Plugin implementation
export const loggerPlugin: AtomPlugin = {
  symbol: LOGGER_SYM,

  detectMarker(value) {
    return value?._marker === LOGGER_SYM
  },

  onQuarkProperty({ atom, quark, key, markers }) {
    // Subscribe to changes
    quark.up((newValue) => {
      console.log(`[${atom._internal.realm}] ${key} = ${newValue}`)
    })
  },

  onCreate(atom, markedProperties) {
    console.log('Atom created with logged properties:',
      Object.keys(markedProperties))
  },

  onDecay(atom) {
    console.log('Atom destroyed:', atom._internal.realm)
  }
}
```

**Usage:**

```typescript
import { Atom, use } from '@alaq/atom'
import { loggerPlugin, logged } from './logger-plugin'

use(loggerPlugin)

const user = Atom({
  name: logged(''),
  age: logged(0)
})

user.state.name = 'John'
// Logs: "[+] name = John"

user.state.age = 25
// Logs: "[+] age = 25"
```

### Registering Plugins

```typescript
import { use } from '@alaq/atom'

// Register plugin globally
use(myPlugin)

// All atoms created after will have this plugin
const atom = Atom(Model)
```

**⚠️ Note:** Plugins must be registered before creating atoms.

### Plugin Hooks Lifecycle

```
1. Atom() called
2. parseModel() - extracts properties/methods/getters
3. For each property with markers:
   3a. Create Quark
   3b. Call plugin.onQuarkProperty() for each marker
4. Create computed properties (Fusion)
5. Call plugin.onCreate() with all marked properties
6. Call constructor with state proxy
7. Return AtomInstance

...later...

8. atom.decay() called
9. Call plugin.onDecay()
10. Decay all quarks and computed
```

---

## Computed Properties

### How Getters Become Computed

Any getter in the model becomes a computed property:

```typescript
class Calculator {
  a = 0
  b = 0

  // This is a computed property
  get sum() {
    return this.a + this.b
  }
}

const calc = Atom(Calculator)
calc.state.sum  // Computed value
```

### Dependency Tracking

Dependencies are tracked automatically via Proxy:

```typescript
class User {
  firstName = ''
  lastName = ''

  get fullName() {
    // Automatically tracks: firstName, lastName
    return `${this.firstName} ${this.lastName}`
  }
}
```

**Tracking Process:**

1. Getter is called with tracking proxy as `this`
2. Any property access is recorded
3. Dependencies list is built: `['firstName', 'lastName']`
4. Fusion is created with these sources

### Nested Computed Properties

Computed properties can depend on other computed properties:

```typescript
class User {
  firstName = ''
  lastName = ''

  get fullName() {
    return `${this.firstName} ${this.lastName}`
  }

  get greeting() {
    return `Hello, ${this.fullName}!`
  }

  get formalGreeting() {
    return `${this.greeting} How are you?`
  }
}
```

**Dependency Resolution:**

```
Level 0 (properties):
  - firstName
  - lastName

Level 1 (depends on Level 0):
  - fullName → [firstName, lastName]

Level 2 (depends on Level 1):
  - greeting → [fullName]

Level 3 (depends on Level 2):
  - formalGreeting → [greeting]
```

**Topological Sort:**
- Ensures correct creation order
- Prevents circular dependencies
- Efficient computation

### Fusion Strategy

Computed properties use `NeoFusion(...sources).any()`:

```typescript
internal.computed[key] = NeoFusion(...sources).any(() => {
  return getter.call(state)
})
```

**Why `any` strategy?**
- Works with falsy values (0, '', false, null)
- Always recomputes on source changes
- Consistent behavior across all value types

**Alternative (`alive` strategy):**
```typescript
// This would NOT work for falsy values
Fusion(...sources, fn)  // Only recomputes if all sources are truthy
```

### Computed Property Characteristics

**Read-Only:**
```typescript
calc.state.sum = 100  // ❌ No effect (computed is read-only)
```

**Lazy Evaluation:**
```typescript
const calc = Atom(Calculator)
// Computed NOT calculated yet

const value = calc.state.sum
// NOW computed is calculated
```

**Reactive Updates:**
```typescript
calc.state.a = 10  // Triggers recomputation of 'sum'
console.log(calc.state.sum)  // Returns fresh value: 10
```

**Direct Access:**
```typescript
// Via state
calc.state.sum  // Returns computed value

// Via core (Fusion instance)
calc.core.sum.value  // Same value
calc.core.sum.up(fn)  // Subscribe to changes
```

---

## Event Bus

### RealmBus API

```typescript
interface RealmBus {
  on(event: string, listener: Function): void
  off(event: string, listener: Function): void
  emit(event: string, data: any): void
}
```

### Event Patterns

**Local Event:**
```typescript
atom.bus.on('MY_EVENT', (data) => {
  // Only events from this realm
})

atom.bus.emit('MY_EVENT', { value: 123 })
```

**Cross-Realm Event:**
```typescript
atom.bus.on('other.realm:EVENT', (data) => {
  // Listen to events from 'other.realm'
})
```

**Wildcard (All Events in Realm):**
```typescript
atom.bus.on('*', ({ event, data }) => {
  // All events in this realm
})
```

**Global Wildcard (All Realms):**
```typescript
atom.bus.on('*:*', ({ realm, event, data }) => {
  // All events from all realms
})
```

### Realm Hierarchy

Realms are flat namespaces (no automatic bubbling):

```
'+'                    # Global realm
'app'                  # App realm
'app.users'            # Users realm
'app.users.profile'    # Profile realm
```

Events stay in their realm unless explicitly routed:

```typescript
const profile = Atom(Model, { realm: 'app.users.profile' })

profile.bus.emit('UPDATE', data)
// → Only 'app.users.profile' listeners receive

// To notify parent realm explicitly:
quantumBus.getRealm('app.users').emit('PROFILE_UPDATE', data)
```

---

## TypeScript Types

### Type Inference

```typescript
class User {
  name = ''
  age = 0
  greet() { return `Hi ${this.name}` }
  get isAdult() { return this.age >= 18 }
}

const user = Atom(User)

// Inferred types:
user.state.name        // string
user.state.age         // number
user.state.isAdult     // boolean
user.actions.greet     // () => string

// Type errors:
user.state.name = 123  // ❌ Type 'number' is not assignable to type 'string'
user.actions.invalid() // ❌ Property 'invalid' does not exist
```

### Exported Types

```typescript
import type {
  AtomPlugin,
  AtomOptions,
  AtomInstance,
  ParsedModel,
  PropertiesOf,
  MethodsOf
} from '@alaq/atom'
```

### Type Utilities

**PropertiesOf<T>** - Extract property keys:
```typescript
type UserProps = PropertiesOf<User>
// 'name' | 'age'
```

**MethodsOf<T>** - Extract method keys:
```typescript
type UserMethods = MethodsOf<User>
// 'greet'
```

---

## Advanced Usage

### Custom Container

```typescript
import { Nucl } from '@alaq/nucl/nucleus'
import { arrayPlugin } from '@alaq/nucl/plugins/array'

Nucl.use(arrayPlugin)

const todoList = Atom({
  todos: []
}, {
  container: Nucl
})

// Now todos is a Nucl with array methods
todoList.core.todos.push('Task 1')
todoList.core.todos.filter(t => t.completed)
```

### Shared Bus Between Atoms

```typescript
import { quantumBus } from '@alaq/quark/quantum-bus'

const appBus = quantumBus.getRealm('app')

const user = Atom(User, { bus: appBus })
const settings = Atom(Settings, { bus: appBus })

// Both share same bus
appBus.on('LOGOUT', () => {
  user.state.authenticated = false
  settings.state = defaultSettings
})
```

### Dynamic Atom Creation

```typescript
function createUserAtom(userId: string) {
  return Atom(User, {
    realm: 'users',
    name: userId,
    constructorArgs: [userId]
  })
}

const user1 = createUserAtom('user-123')
const user2 = createUserAtom('user-456')

// Different realms:
// 'users.user-123'
// 'users.user-456'
```

### Integration with Vue

```typescript
import { ref, watchEffect } from 'vue'
import { Atom } from '@alaq/atom'

const counter = Atom(Counter)

// Sync atom to Vue ref
const count = ref(counter.state.count)

watchEffect(() => {
  counter.state.count = count.value
})

counter.core.count.up((newValue) => {
  count.value = newValue
})
```

### Integration with React

```typescript
import { useState, useEffect } from 'react'
import { Atom } from '@alaq/atom'

function useAtom<T>(atom: AtomInstance<T>) {
  const [state, setState] = useState(atom.state)

  useEffect(() => {
    const listeners = Object.keys(atom.core).map(key => {
      const listener = (value: any) => {
        setState({ ...atom.state })
      }
      atom.core[key].up(listener)
      return () => atom.core[key].down(listener)
    })

    return () => listeners.forEach(cleanup => cleanup())
  }, [atom])

  return state
}
```

---

## Best Practices

### 1. Always Call decay()

```typescript
// ✅ Good
const atom = Atom(Model)
try {
  // Use atom
} finally {
  atom.decay()
}

// ❌ Bad
const atom = Atom(Model)
// Atom never cleaned up
```

### 2. Use Computed for Derived State

```typescript
// ✅ Good
class User {
  firstName = ''
  lastName = ''
  get fullName() {
    return `${this.firstName} ${this.lastName}`
  }
}

// ❌ Bad
class User {
  firstName = ''
  lastName = ''
  fullName = ''  // Must manually sync
  updateFullName() {
    this.fullName = `${this.firstName} ${this.lastName}`
  }
}
```

### 3. Keep Actions Simple

```typescript
// ✅ Good
class Counter {
  count = 0
  increment() {
    this.count++
  }
}

// ❌ Bad (side effects)
class Counter {
  count = 0
  increment() {
    this.count++
    fetch('/api/count', { method: 'POST' })  // Side effect
    localStorage.setItem('count', this.count)  // Side effect
  }
}
```

### 4. Use Plugins for Cross-Cutting Concerns

```typescript
// ✅ Good - persistence via plugin
use(persistPlugin)
class Settings {
  theme = saved('dark')
}

// ❌ Bad - manual persistence
class Settings {
  theme = 'dark'
  saveTheme() {
    localStorage.setItem('theme', this.theme)
  }
}
```

### 5. Name Your Atoms

```typescript
// ✅ Good
const user = Atom(User, {
  realm: 'app',
  name: 'currentUser'
})

// ❌ Bad
const user = Atom(User)
// Realm: '+' (global, hard to debug)
```

---

## Migration from v5

### Breaking Changes

1. **No `atom.state` by default** → Use `atom.state` proxy
2. **No `atom.core` shorthand** → Explicit `atom.core[key]`
3. **Constructor called differently** → With `state` proxy as `this`
4. **Plugin API changed** → New `AtomPlugin` interface
5. **No built-in persistence** → Use `@alaq/atom-persist` plugin

### Migration Example

**v5:**
```typescript
import { Atom, saved } from '@alaq/atom'

const user = Atom({
  model: {
    name: saved('')
  }
})

user.state.name = 'John'
user.core.name.value
```

**v6:**
```typescript
import { Atom, use, synthesis } from '@alaq/atom'
import { persistPlugin, saved } from '@alaq/atom-persist'

use(persistPlugin)

const user = Atom({
  name: saved('')
})

user.state.name = 'John'
user.core.name.value
```

---

## Troubleshooting

### Computed Returns undefined

**Problem:** Getter returns `undefined` on first access

**Solution:** Check if using falsy values (0, '', false)
- v6 uses `any` strategy (works with falsy)
- Make sure NeoFusion is imported correctly

```typescript
// ✅ Should work in v6
get sum() {
  return this.a + this.b  // Works even if a=0, b=0
}
```

### Constructor Not Called

**Problem:** Constructor logic doesn't execute

**Solution:** Check constructor signature
- Must not require `new` keyword
- Should work with `.call(state, ...args)`

```typescript
// ✅ Good
class Model {
  constructor(arg: string) {
    this.field = arg
  }
}

// ❌ Bad (uses class-only features)
class Model {
  constructor() {
    super()  // Can't call super without new
  }
}
```

### Plugin Not Working

**Problem:** Plugin hooks not called

**Solution:** Register plugin before creating atoms

```typescript
// ✅ Good
use(myPlugin)
const atom = Atom(Model)

// ❌ Bad
const atom = Atom(Model)
use(myPlugin)  // Too late
```

---

**Version:** 6.0.0-alpha.1
**Last Updated:** 2025-01-31
