# @alaq/atom

Minimal reactive state management built on [@alaq/quark](../quark) proactive containers.

## Features

- 🎯 **Minimal Core** - Only what you need, nothing more
- 🔌 **Plugin System** - Extend with custom property markers
- 🧮 **Computed Properties** - Auto-tracking dependencies via getters
- 🏗️ **Class & Object Support** - Works with ES6 classes or plain objects
- 🌳 **Tree-Shakeable** - Pay only for what you use
- 🚀 **High Performance** - Built on optimized Quark primitives
- 📡 **Event Bus** - Realm-based event system via quantumBus

## Installation

```bash
bun add @alaq/atom @alaq/quark @alaq/nucl
```

## Quick Start

### Plain Object

```typescript
import { Atom } from '@alaq/atom'

const counter = Atom({
  count: 0,
  step: 1,
  increment() {
    this.count += this.step
  }
})

counter.state.count = 10
counter.actions.increment()
console.log(counter.state.count) // 11
```

### ES6 Class

```typescript
class User {
  name = ''
  age = 0

  greet() {
    return `Hello, ${this.name}!`
  }

  get isAdult() {
    return this.age >= 18
  }
}

const user = Atom(User, {
  name: 'user',
  realm: 'app'
})

user.state.name = 'John'
user.state.age = 25

console.log(user.actions.greet())  // 'Hello, John!'
console.log(user.state.isAdult)    // true
```

## API

### Atom Constructor

```typescript
function Atom<T>(
  model: T | (new (...args: any[]) => T),
  options?: AtomOptions
): AtomInstance<T>
```

**Options:**

```typescript
interface AtomOptions {
  name?: string            // Atom name (appended to realm)
  realm?: string           // Namespace (default: '+')
  container?: Function     // Quark/Nucl constructor (default: Qu)
  bus?: any                // External event bus
  constructorArgs?: any[]  // Arguments for class constructor
  emitChanges?: boolean    // Emit NUCLEUS_CHANGE events
}
```

### AtomInstance

```typescript
interface AtomInstance<T> {
  core: Record<string, Quark>  // Direct quark access
  state: T                     // Proxy for values (getter/setter)
  actions: Record<string, Function>  // Methods bound to state
  bus: RealmBus               // Event bus for this realm
  decay(): void               // Cleanup method
}
```

## Computed Properties (Getters)

Getters automatically become computed properties with dependency tracking:

```typescript
class Calculator {
  a = 0
  b = 0

  get sum() {
    return this.a + this.b  // depends on a, b
  }

  get doubled() {
    return this.sum * 2  // depends on sum
  }
}

const calc = Atom(Calculator)

calc.state.a = 10
calc.state.b = 5

console.log(calc.state.sum)      // 15 (computed)
console.log(calc.state.doubled)  // 30 (computed from computed)
```

**How it works:**
- Dependencies are tracked automatically via Proxy
- Getters are sorted topologically by dependency levels
- Uses `NeoFusion(...sources).any()` for reactive updates
- Works with falsy values (0, '', false)

## Constructor Support

```typescript
class Counter {
  count: number

  constructor(initial: number) {
    this.count = initial
    console.log('Initialized with:', initial)
  }

  increment() {
    this.count++
  }
}

const counter = Atom(Counter, {
  constructorArgs: [100]
})

console.log(counter.state.count)  // 100
```

## Direct Quark Access

```typescript
const data = Atom({ value: 42 })

// Via state
data.state.value = 100

// Via core (direct quark)
data.core.value.value  // 100
data.core.value(200)   // set
data.core.value.up(v => console.log(v))  // subscribe
```

## Event Bus & Realms

```typescript
const user = Atom(User, {
  realm: 'app.users',
  name: 'profile'
})

// Full realm: 'app.users.profile'
// Quark IDs: 'app.users.profile.name', 'app.users.profile.age'

// Listen to atom initialization
user.bus.on('ATOM_INIT', (data) => {
  console.log('Atom initialized:', data)
})

// Listen to quark changes (if emitChanges: true)
const user2 = Atom(User, {
  realm: 'app',
  emitChanges: true
})

user2.bus.on('NUCLEUS_CHANGE', ({ key, value }) => {
  console.log(`${key} changed to:`, value)
})
```

## Property Markers & Plugins

Atom supports a plugin system for property markers:

```typescript
import { synthesis, use } from '@alaq/atom'
import { persistPlugin, saved } from '@alaq/atom-persist'

use(persistPlugin)

class Settings {
  // Single marker
  theme = saved('dark')

  // Multiple markers (composition)
  email = synthesis(
    saved(''),
    tag('contact')
  )
}

const settings = Atom(Settings)
settings.state.theme = 'light'  // auto-saved to localStorage
```

### Creating Custom Plugins

```typescript
const MY_MARKER = Symbol.for('my-plugin')

export const myMarker = (value, opts = {}) => ({
  _marker: MY_MARKER,
  value,
  ...opts
})

export const myPlugin: AtomPlugin = {
  symbol: MY_MARKER,

  detectMarker(value) {
    return value?._marker === MY_MARKER
  },

  onQuarkProperty({ atom, quark, key, markers }) {
    // Called when quark with marker is created
    console.log(`Setting up ${key}`)
  },

  onCreate(atom, markedProperties) {
    // Called after all quarks are created
  },

  onDecay(atom) {
    // Cleanup
  }
}
```

## Cleanup

Always call `decay()` when done:

```typescript
const atom = Atom(MyModel)

// Use atom...

atom.decay()  // Cleanup all quarks, computed, and subscriptions
```

## TypeScript

Full TypeScript support with type inference:

```typescript
class User {
  name = ''
  age = 0
  greet() { return `Hi ${this.name}` }
}

const user = Atom(User)

user.state.name = 'John'  // ✅ string
user.state.name = 123     // ❌ Type error

user.actions.greet()      // ✅ () => string
user.actions.invalid()    // ❌ Property doesn't exist
```

## Examples

See [test/basic.test.ts](./test/basic.test.ts) for more examples.

## Related Packages

- [@alaq/quark](../quark) - Base reactive container
- [@alaq/nucl](../nucl) - Quark with plugin system
- [@alaq/nucl/fusion](../nucl/src/fusion) - Computed values

## License

MIT
