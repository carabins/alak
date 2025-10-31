# Vue Plugins for @alaq/atom

Three approaches for integrating Vue 3 reactivity with Atom system. **NO additional ref/reactive instances created** - plugins hook directly into Vue's reactivity system.

## 🎯 Quick Comparison

| Plugin | API | Deep Reactivity | Clean Data | Use Case |
|--------|-----|-----------------|------------|----------|
| **VueQuarkRefPlugin** | `atom.core.prop` | ❌ Primitives only | ✅ Yes | Simple counters, flags |
| **StateReactivePlugin** | `atom.state.prop` | ✅ Objects/Arrays | ✅ `.rawState()` | Complex forms, nested data |
| **ViewMarkerPlugin** | `atom.view.prop` | ✅ Yes | ✅ Yes | Performance optimization |

---

## 1️⃣ VueQuarkRefPlugin - Quark as Vue Ref

**Best for:** Simple reactive values (numbers, strings, booleans)

### Installation

```typescript
import { Atom } from '@alaq/atom'
import { VueQuarkRefPlugin } from '@alaq/vue/quark-ref'

Atom.use(VueQuarkRefPlugin)
```

### Usage

```typescript
class Counter {
  count = 0
  name = 'Counter'
}

const counter = Atom(Counter)

// In Vue template:
// <div>{{ counter.core.count }}</div>
// <input v-model="counter.core.count.value" />

// In setup():
import { watch } from 'vue'

watch(() => counter.core.count.value, (newValue) => {
  console.log('Count changed:', newValue)
})

// Direct access:
counter.core.count.value = 10  // Triggers Vue updates
```

### How it works

- Each `quark` becomes a Vue `customRef`
- `quark.value` tracks in Vue components
- No wrapper objects - quark IS the ref
- `watch()` and `watchEffect()` work natively

### Limitations

- Only root-level reactivity (primitives)
- Objects/arrays don't track deeply
- Use StateReactivePlugin for nested structures

---

## 2️⃣ StateReactivePlugin - State as Vue Reactive

**Best for:** Complex objects, arrays, forms with nested data

### Installation

```typescript
import { Atom } from '@alaq/atom'
import { StateReactivePlugin } from '@alaq/vue/state-reactive'

Atom.use(StateReactivePlugin)
```

### Usage

```typescript
class UserForm {
  profile = { name: '', age: 0 }
  settings = { theme: 'dark', lang: 'en' }
  tags = ['vue', 'typescript']
}

const form = Atom(UserForm)

// In Vue template:
// <input v-model="form.state.profile.name" />
// <input v-model="form.state.profile.age" type="number" />
// <div v-for="tag in form.state.tags">{{ tag }}</div>

// Reactive mutations:
form.state.profile.name = 'John'  // ✅ Tracked by Vue
form.state.tags.push('atom')       // ✅ Tracked by Vue
form.state.settings.theme = 'light' // ✅ Tracked by Vue

// Clean data export (no Vue proxies):
const cleanData = form.rawState()
fetch('/api/user', {
  method: 'POST',
  body: JSON.stringify(cleanData)  // No toRaw() needed!
})
```

### How it works

- `atom.state` becomes a Proxy that mimics Vue `reactive()`
- Deep tracking via Vue's `track()` and `trigger()`
- Nested objects automatically become reactive
- `.rawState()` returns clean data without proxies

### Features

- ✅ Deep reactivity for objects and arrays
- ✅ Works with `v-model` on nested properties
- ✅ `watch()` on deep paths
- ✅ No `toRaw()` needed - use `.rawState()`
- ✅ Automatic conversion: primitives → values, objects → reactive

---

## 3️⃣ ViewMarkerPlugin - Selective Reactivity

**Best for:** Performance optimization, large models with few reactive properties

### Installation

```typescript
import { Atom } from '@alaq/atom'
import { ViewMarkerPlugin, view } from '@alaq/vue/view-marker'

Atom.use(ViewMarkerPlugin)
```

### Usage

```typescript
import { view } from '@alaq/vue/view-marker'

class AppState {
  // Vue reactive (marked with view)
  counter = view(0)
  username = view('')
  settings = view({ theme: 'dark' })

  // NOT reactive (no marker)
  internalCache = new Map()
  debugInfo = { logs: [] }
}

const app = Atom(AppState)

// In Vue template - only marked properties:
// <div>{{ app.view.counter }}</div>
// <input v-model="app.view.username" />
// <select v-model="app.view.settings.theme">

// Unmarked properties in .state (no Vue overhead):
app.state.internalCache.set('key', 'value')  // No Vue tracking
app.state.debugInfo.logs.push('event')       // No Vue tracking

// Marked properties are refs:
app.view.counter.value = 10  // ✅ Triggers Vue updates
watch(() => app.view.username.value, ...)  // ✅ Works
```

### How it works

- Only properties marked with `view()` become Vue refs
- Creates separate `atom.view` namespace with refs
- Unmarked properties stay in `atom.state` without Vue overhead
- Best performance - only track what you need

### When to use

- ✅ Large models with few UI-bound properties
- ✅ Performance-critical applications
- ✅ Clear separation: reactive UI vs internal state
- ✅ Combining with StateReactivePlugin for hybrid approach

---

## 🔥 Combining Plugins

You can use multiple plugins together!

### Example: State Reactive + View Marker

```typescript
import { Atom } from '@alaq/atom'
import { StateReactivePlugin, ViewMarkerPlugin, view } from '@alaq/vue'

Atom.use(StateReactivePlugin)
Atom.use(ViewMarkerPlugin)

class TodoApp {
  // View markers for special handling
  activeFilter = view('all')
  searchQuery = view('')

  // Normal properties (reactive via StateReactivePlugin)
  todos = []
  stats = { total: 0, completed: 0 }
}

const app = Atom(TodoApp)

// Use view refs for frequently accessed UI controls:
app.view.activeFilter.value = 'completed'
app.view.searchQuery.value = 'test'

// Use state reactive for complex data:
app.state.todos.push({ text: 'New todo', done: false })
app.state.stats.total += 1
```

---

## 🎨 Architecture Benefits

### No Double Tracking

**Old approach (creates extra instances):**
```typescript
const vueRef = ref(quark.value)  // ❌ Extra ref object
quark.up((v) => vueRef.value = v)  // ❌ Extra listener
watch(vueRef, (v) => quark(v))     // ❌ Another listener
```

**New approach (direct integration):**
```typescript
// ✅ Quark IS the ref via customRef
// ✅ Single tracking path
// ✅ No intermediate objects
```

### Memory Efficiency

- No wrapper ref/reactive objects
- No duplicate listeners
- Direct Vue integration via `customRef`, `track()`, `trigger()`

### Clean Data

- `StateReactivePlugin`: Use `.rawState()` for server sync
- `VueQuarkRefPlugin`: Values already clean (primitives)
- `ViewMarkerPlugin`: Direct quark values
- No `toRaw()` gymnastics needed!

---

## 📦 Package Exports

```typescript
// Main export
import { VueQuarkRefPlugin, StateReactivePlugin, ViewMarkerPlugin, view } from '@alaq/vue'

// Individual imports (tree-shaking)
import { VueQuarkRefPlugin } from '@alaq/vue/quark-ref'
import { StateReactivePlugin } from '@alaq/vue/state-reactive'
import { ViewMarkerPlugin, view } from '@alaq/vue/view-marker'
```

---

## 🧪 Testing Example

```typescript
import { describe, it, expect } from 'vitest'
import { Atom } from '@alaq/atom'
import { StateReactivePlugin } from '@alaq/vue/state-reactive'
import { watch } from 'vue'

describe('StateReactivePlugin', () => {
  it('tracks deep changes', async () => {
    Atom.use(StateReactivePlugin)

    class User {
      profile = { name: '', age: 0 }
    }

    const user = Atom(User)
    const changes: string[] = []

    watch(() => user.state.profile.name, (name) => {
      changes.push(name)
    })

    user.state.profile.name = 'Alice'
    await nextTick()

    expect(changes).toEqual(['Alice'])
  })

  it('provides clean data via rawState', () => {
    const user = Atom(User)
    user.state.profile.name = 'Bob'

    const raw = user.rawState()
    expect(raw).toEqual({ profile: { name: 'Bob', age: 0 } })
    expect(isReactive(raw.profile)).toBe(false)
  })
})
```

---

## 🚀 Performance Tips

1. **Small models → VueQuarkRefPlugin**
   - Minimal overhead for primitives

2. **Complex forms → StateReactivePlugin**
   - Deep tracking when you need it

3. **Large apps → ViewMarkerPlugin**
   - Only reactive what users see
   - Internal state stays fast

4. **Hybrid approach → Combine plugins**
   - State reactive as default
   - View markers for hot paths
