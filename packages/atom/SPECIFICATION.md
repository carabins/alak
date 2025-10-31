# @alaq/atom v6 - Functional Specification

## Overview

This document defines the complete functional requirements for @alaq/atom v6.

## Design Principles

### 1. Minimalism
- Core package contains ONLY essential functionality
- No built-in plugins (persistence, validation, etc.)
- Users import only what they need
- Optimal tree-shaking support

### 2. Performance
- Lazy container creation (only on first access)
- Optimized Fusion with `any` strategy
- Minimal overhead over raw Quark
- V8-optimized code patterns

### 3. Type Safety
- Full TypeScript support
- Type inference for state/actions/computed
- Compile-time validation
- IDE autocomplete

### 4. Extensibility
- Plugin system for custom markers
- Custom container support (Qu/Nucl/custom)
- Event-driven architecture
- Composable markers via `synthesis()`

### 5. Developer Experience
- Intuitive API (state/actions/core)
- Clear error messages
- Comprehensive documentation
- Easy debugging

---

## Functional Requirements

### FR-1: Model Parsing

**Requirement:** Parse JavaScript models into reactive structures

#### FR-1.1: Plain Object Support
```typescript
const atom = Atom({
  prop1: value1,
  prop2: value2,
  method() { ... }
})
```

**Must:**
- Extract all enumerable properties
- Identify methods (typeof === 'function')
- Preserve property values
- Support nested objects as values

**Must Not:**
- Modify original object
- Call methods during parsing
- Create containers during parsing (lazy)

#### FR-1.2: Class Support
```typescript
class Model {
  field1 = value1
  field2 = value2
  method() { ... }
}

const atom = Atom(Model)
```

**Must:**
- Support ES6 class syntax
- Extract class fields with default values
- Extract methods from prototype
- Support prototype inheritance
- Support getters (become computed)

**Must Not:**
- Require `new` keyword from user
- Call constructor during initial parsing
- Lose inherited methods

#### FR-1.3: Constructor Support
```typescript
class Model {
  field: Type

  constructor(arg: Type) {
    this.field = arg
  }
}

const atom = Atom(Model, {
  constructorArgs: [value]
})
```

**Must:**
- Accept constructor arguments via options
- Call constructor with provided args
- Use `state` proxy as `this` context
- Allow initialization logic in constructor
- Support multiple constructor signatures

**Must Not:**
- Require `new` keyword
- Call constructor before atom setup
- Fail on constructor errors (fallback gracefully)

#### FR-1.4: Getter Recognition
```typescript
class Model {
  prop = 0

  get computed() {
    return this.prop * 2
  }
}
```

**Must:**
- Detect getters via `Object.getOwnPropertyDescriptor()`
- Extract getter function
- Mark as computed property
- Support inherited getters

**Must Not:**
- Call getter during parsing
- Treat as regular property
- Treat as method

---

### FR-2: Reactive Containers

**Requirement:** Convert properties into reactive Quark/Nucl containers

#### FR-2.1: Lazy Creation
```typescript
const atom = Atom({ a: 1, b: 2, c: 3 })
// No containers created yet

atom.state.a  // NOW container for 'a' is created
atom.state.b  // NOW container for 'b' is created
// 'c' still not created
```

**Must:**
- Create containers only on first access
- Cache created containers
- Return same container on repeated access
- Emit ATOM_INIT on first container creation

**Must Not:**
- Create all containers eagerly
- Create multiple containers for same property
- Recreate containers on each access

#### FR-2.2: Container Configuration
```typescript
const atom = Atom(Model, {
  container: Nucl,  // Use Nucl instead of Qu
  realm: 'app.users',
  name: 'profile'
})
```

**Must:**
- Use specified container constructor
- Pass realm to container
- Pass full ID (realm.name.property) to container
- Support custom container functions

**Must Not:**
- Hardcode Qu as only option
- Ignore realm in container creation
- Create invalid IDs

#### FR-2.3: Container ID Format
```typescript
// Without name:
realm: 'app', property: 'count'
→ ID: 'app.count'

// With name:
realm: 'app', name: 'counter', property: 'count'
→ ID: 'app.counter.count'

// Default realm:
(no realm), property: 'count'
→ ID: '+.count'
```

**Must:**
- Follow format: `realm[.name].property`
- Use '+' as default realm
- Create unique IDs per atom
- Include name if provided

---

### FR-3: State Proxy

**Requirement:** Provide convenient property access

#### FR-3.1: Getter Behavior
```typescript
atom.state.property  // Returns quark.value
```

**Must:**
- Return current value from container
- Work for all properties
- Return computed value for getters
- Support undefined values
- Be synchronous

**Must Not:**
- Trigger side effects
- Create containers (use getContainer internally)
- Throw on missing properties

#### FR-3.2: Setter Behavior
```typescript
atom.state.property = newValue  // Calls quark(newValue)
```

**Must:**
- Set value on container
- Work with all value types
- Trigger subscriptions
- Work with operators (++, +=, etc.)
- Return true (Proxy requirement)

**Must Not:**
- Allow setting computed properties
- Fail silently on errors
- Lose precision with numbers

#### FR-3.3: Type Safety
```typescript
class Model {
  count: number = 0
  name: string = ''
}

const atom = Atom(Model)

atom.state.count = 10   // ✅ OK
atom.state.count = 'x'  // ❌ Type error
atom.state.invalid      // ❌ Property doesn't exist
```

**Must:**
- Infer types from model
- Enforce type safety at compile time
- Provide autocomplete in IDE
- Show errors for invalid properties

---

### FR-4: Actions

**Requirement:** Bind methods to reactive state

#### FR-4.1: Method Binding
```typescript
class Counter {
  count = 0

  increment() {
    this.count++  // this = state proxy
  }
}

const counter = Atom(Counter)
counter.actions.increment()
```

**Must:**
- Bind `this` to `state` proxy
- Preserve method signature
- Allow property access via `this`
- Support calling other methods
- Support reading computed properties

**Must Not:**
- Lose method context
- Create new bound function on each access
- Prevent recursive method calls

#### FR-4.2: Method Arguments
```typescript
class Model {
  value = 0

  add(n: number) {
    this.value += n
  }

  calculate(a: number, b: number, c: number) {
    return a + b + c
  }
}

const model = Atom(Model)
model.actions.add(5)
model.actions.calculate(1, 2, 3)
```

**Must:**
- Support any number of arguments
- Preserve argument types
- Support rest parameters
- Support optional parameters

---

### FR-5: Computed Properties

**Requirement:** Auto-tracked reactive getters

#### FR-5.1: Dependency Tracking
```typescript
class Model {
  a = 0
  b = 0

  get sum() {
    return this.a + this.b
  }
}
```

**Must:**
- Automatically detect dependencies
- Track property access via Proxy
- Build dependency list: `['a', 'b']`
- Work with any number of dependencies
- Support zero dependencies (pure function)

**Must Not:**
- Require manual dependency declaration
- Miss dependencies
- Include false positives
- Fail on undefined properties during tracking

#### FR-5.2: Nested Computed
```typescript
class Model {
  firstName = ''
  lastName = ''

  get fullName() {
    return `${this.firstName} ${this.lastName}`
  }

  get greeting() {
    return `Hello, ${this.fullName}!`
  }

  get shout() {
    return this.greeting.toUpperCase()
  }
}
```

**Must:**
- Support computed depending on computed
- Perform topological sort
- Create in correct order (parents before children)
- Handle arbitrary nesting depth
- Detect circular dependencies

**Must Not:**
- Create in wrong order
- Cause infinite loops
- Fail to update dependent computed

#### FR-5.3: Fusion Strategy
```typescript
// Must use NeoFusion with 'any' strategy
internal.computed[key] = NeoFusion(...sources).any(() => {
  return getter.call(state)
})
```

**Must:**
- Use `any` strategy (recompute on all changes)
- Work with falsy values (0, '', false, null)
- Unpack source values in callback
- Support Fusion as source (nested computed)
- Be lazy (compute on first access)

**Must Not:**
- Use `alive` strategy (breaks with falsy values)
- Eagerly compute on creation
- Lose updates when source is falsy

#### FR-5.4: Computed Cleanup
```typescript
atom.decay()  // Must clean up all computed
```

**Must:**
- Call `.decay()` on all Fusion instances
- Unsubscribe from sources
- Prevent memory leaks
- Remove all references

---

### FR-6: Property Markers & Plugins

**Requirement:** Extensible property decoration system

#### FR-6.1: Marker Structure
```typescript
const marker = {
  _marker: Symbol.for('plugin:name'),
  value: initialValue,
  ...customOptions
}
```

**Must:**
- Use Symbol for plugin identification
- Include value property
- Support additional options
- Be serializable (no functions in marker itself)

#### FR-6.2: Marker Composition
```typescript
synthesis(marker1, marker2, marker3)
```

**Must:**
- Accept any number of markers
- Preserve all markers
- Extract value from first marker with value
- Return ComposedMarker object
- Support array syntax as alternative

**Must Not:**
- Lose marker information
- Modify original markers
- Require specific order

#### FR-6.3: Plugin Registration
```typescript
use(plugin)
```

**Must:**
- Accept AtomPlugin interface
- Store in global registry
- Prevent duplicate registration (same symbol)
- Apply to all atoms created after registration

**Must Not:**
- Modify existing atoms
- Allow unregistering (no `unuse`)
- Require plugin order

#### FR-6.4: Plugin Hooks

**`detectMarker(value)`**
```typescript
detectMarker(value: any): boolean
```

**Must:**
- Return true if value is marker for this plugin
- Be fast (called for every property)
- Handle null/undefined gracefully

**`onQuarkProperty(context)`**
```typescript
onQuarkProperty({
  atom,      // AtomInstance
  quark,     // Created container
  key,       // Property name
  markers    // All markers for this property
}): void
```

**Must:**
- Be called after quark creation
- Receive all markers (if multiple)
- Have access to full atom instance
- Be called for each marked property
- Handle errors gracefully

**`onCreate(atom, markedProperties)`**
```typescript
onCreate(
  atom: AtomInstance,
  markedProperties: Record<string, any[]>
): void
```

**Must:**
- Be called after all quarks created
- Receive map of property → markers
- Be called before constructor
- Have access to complete atom

**`onDecay(atom)`**
```typescript
onDecay(atom: AtomInstance): void
```

**Must:**
- Be called on atom.decay()
- Be called before quarks decay
- Allow cleanup operations
- Handle errors without stopping other cleanups

---

### FR-7: Event Bus Integration

**Requirement:** Realm-based event system

#### FR-7.1: Bus Creation
```typescript
const atom = Atom(Model, {
  realm: 'app.users',
  name: 'profile'
})

// atom.bus = quantumBus.getRealm('app.users.profile')
```

**Must:**
- Create/get RealmBus from quantumBus
- Use full realm path (realm.name)
- Share bus with same realm
- Support external bus via options

**Must Not:**
- Create multiple buses for same realm
- Isolate events unnecessarily
- Leak bus references

#### FR-7.2: Event Emission
```typescript
atom.bus.emit('EVENT_NAME', data)
```

**Must:**
- Emit to current realm only
- Include event name and data
- Be synchronous
- Support any data type
- Notify all subscribers

**Must Not:**
- Bubble to parent realms
- Broadcast to child realms
- Fail silently on errors

#### FR-7.3: Built-in Events

**ATOM_INIT**
```typescript
// Emitted on first container access
atom.bus.on('ATOM_INIT', ({ realm }) => {
  console.log('Atom initialized')
})
```

**Must:**
- Emit exactly once per atom
- Emit on first property access
- Include realm in payload
- Be emitted before value access

**NUCLEUS_CHANGE** (optional)
```typescript
const atom = Atom(Model, { emitChanges: true })
atom.bus.on('NUCLEUS_CHANGE', ({ key, value, realm }) => {
  console.log(`${key} changed`)
})
```

**Must:**
- Only emit if `emitChanges: true`
- Include key, value, realm
- Emit after value change
- Not affect performance when disabled

---

### FR-8: Lifecycle Management

**Requirement:** Proper resource cleanup

#### FR-8.1: Decay Method
```typescript
atom.decay()
```

**Must:**
- Call plugin onDecay hooks
- Decay all created containers
- Decay all computed properties
- Clear internal references
- Be idempotent (safe to call multiple times)

**Must Not:**
- Fail if already decayed
- Leave subscriptions active
- Leak memory
- Affect other atoms

#### FR-8.2: Constructor Lifecycle
```
1. parseModel(model, plugins, constructorArgs)
   - Create temp instance with constructorArgs
   - Extract fields, methods, getters

2. Create atom structure
   - Setup lazy containers
   - Create computed properties
   - Bind actions

3. Call plugin onCreate hooks

4. Call constructor with state proxy as this
   - constructor.call(state, ...constructorArgs)

5. Return AtomInstance
```

**Must:**
- Follow exact order
- Handle constructor errors
- Preserve field values from parseModel
- Allow constructor to modify state

---

### FR-9: Type System

**Requirement:** Full TypeScript integration

#### FR-9.1: Type Inference

**Must:**
- Infer property types from model
- Infer method signatures
- Infer computed return types
- Infer constructor parameter types
- Work with generic types

**Must Not:**
- Require manual type annotations
- Lose type information
- Allow invalid operations at compile time

#### FR-9.2: Exported Types

**Must Export:**
```typescript
AtomPlugin
AtomOptions
AtomInstance<T>
ParsedModel
PropertiesOf<T>
MethodsOf<T>
```

**Must:**
- Be importable via `import type`
- Be well-documented
- Support IDE autocomplete

---

### FR-10: Error Handling

**Requirement:** Graceful failure and clear messages

#### FR-10.1: Constructor Errors
```typescript
class Model {
  constructor() {
    throw new Error('Fail')
  }
}

const atom = Atom(Model)  // Must not throw
```

**Must:**
- Catch constructor errors
- Log warning (not error)
- Continue atom creation
- Use field defaults from parseModel

#### FR-10.2: Plugin Errors
```typescript
const buggyPlugin = {
  symbol: Symbol(),
  onQuarkProperty() {
    throw new Error('Bug')
  }
}

use(buggyPlugin)
const atom = Atom(Model)  // Must not crash
```

**Must:**
- Catch plugin hook errors
- Log error with plugin name
- Continue with other plugins
- Complete atom creation

#### FR-10.3: Computed Errors
```typescript
get computed() {
  throw new Error('Error in getter')
}
```

**Must:**
- Catch getter errors during tracking
- Return undefined as fallback
- Log warning
- Continue atom creation

---

## Non-Functional Requirements

### NFR-1: Performance

**Container Creation:**
- Must be < 1ms per property (on modern hardware)
- Lazy creation must add < 10% overhead vs eager

**Computed Properties:**
- Dependency tracking must be < 1ms per getter
- Fusion creation must be < 2ms per computed

**Memory:**
- Empty atom must use < 10KB
- Each property must add < 1KB

### NFR-2: Bundle Size

**Core Package:**
- Minified + gzipped: < 5KB
- Without dependencies: < 3KB

**Tree-Shaking:**
- Unused code must be removable
- Each plugin must be independently tree-shakeable

### NFR-3: Browser Compatibility

**Minimum Support:**
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Node 16+

**Required Features:**
- Proxy
- Symbol
- Object.create
- Object.getOwnPropertyDescriptor
- WeakMap
- ES6 Classes

### NFR-4: Documentation

**Must Include:**
- README with quick start
- Complete API documentation
- Specification (this document)
- Examples for common use cases
- TypeScript type definitions
- Migration guide from v5

**Quality:**
- All public APIs must be documented
- All examples must be tested
- All types must have JSDoc

### NFR-5: Testing

**Coverage:**
- Must have 80%+ code coverage
- All public APIs must have tests
- All edge cases must be tested
- All error paths must be tested

**Test Categories:**
- Unit tests (per function)
- Integration tests (full atom creation)
- Plugin tests (custom plugins)
- Type tests (TypeScript compilation)

---

## Acceptance Criteria

### Core Functionality

✅ Plain objects can be converted to atoms
✅ Classes can be converted to atoms
✅ Constructor arguments are supported
✅ Properties become reactive containers
✅ Methods become bound actions
✅ Getters become computed properties
✅ Computed dependencies are tracked automatically
✅ Nested computed properties work
✅ Lazy container creation works
✅ decay() cleans up all resources

### Plugin System

✅ Plugins can be registered via use()
✅ Property markers are detected
✅ Plugin hooks are called in correct order
✅ synthesis() composes multiple markers
✅ Custom plugins can be created
✅ Plugin errors don't crash atoms

### Event System

✅ Each atom has event bus
✅ Events can be emitted and subscribed
✅ ATOM_INIT is emitted once
✅ NUCLEUS_CHANGE works with emitChanges
✅ External bus can be provided
✅ Realms isolate events correctly

### Type System

✅ Types are inferred from model
✅ state proxy is type-safe
✅ actions preserve signatures
✅ computed properties have correct types
✅ Invalid operations cause compile errors

### Performance

✅ Lazy creation is measurably faster
✅ Memory usage is reasonable
✅ Bundle size is under 5KB
✅ No memory leaks in long-running apps

### Documentation

✅ README explains quick start
✅ API.md documents all functions
✅ SPECIFICATION.md defines requirements
✅ Examples demonstrate common patterns
✅ All types have JSDoc comments

---

## Future Considerations

### Potential Features (Not in v6.0)

1. **Async Computed** - Computed properties from promises
2. **Batch Updates** - Group multiple changes into single update
3. **Time Travel** - Undo/redo support
4. **Serialization** - JSON export/import of atom state
5. **Dev Tools** - Browser extension for debugging
6. **Middleware** - Intercept state changes
7. **Immutability** - Optional immutable mode
8. **Persistence** - Built-in localStorage sync (currently plugin)

### Breaking Changes from v5

1. No built-in `saved()` marker (use @alaq/atom-persist)
2. Constructor called with state proxy (not raw object)
3. Plugin API completely redesigned
4. No `atom.known` API
5. Computed uses `any` strategy (not `alive`)
6. Realm is required for cross-atom communication

---

**Version:** 6.0.0-alpha.1
**Status:** Implementation Complete
**Last Updated:** 2025-01-31
