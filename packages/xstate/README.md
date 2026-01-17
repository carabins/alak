# @alaq/xstate

**StateX: XState Integration Adapter for the Alak ecosystem.**

[![Read in Russian](https://img.shields.io/badge/Language-Russian-blue)](./README.ru.md)

StateX bridges XState state machines with the Alak reactive system. XState acts as the "brain" (state transition logic), while Alak serves as the "body" (reactive data, UI binding, effects).

### 📦 Installation

```bash
bun add @alaq/xstate xstate
# or
npm install @alaq/xstate xstate
```

---

### 🛠 Architecture Example

In this scenario, we integrate an XState machine designed in [Stately.ai](https://stately.ai/viz) with Alak's reactive primitives for seamless UI binding and effect management.

```typescript
import { setup, assign } from 'xstate'
import { fromMachine } from '@alaq/xstate'
import { Qv } from '@alaq/quark'

// --- Machine: Designed in Stately.ai ---
const heaterMachine = setup({
  types: {
    context: {} as { target: number; current: number },
    events: {} as 
      | { type: 'SENSOR_UPDATE'; temp: number }
      | { type: 'TOGGLE' }
  }
}).createMachine({
  id: 'heater',
  initial: 'inactive',
  context: { target: 22, current: 20 },
  states: {
    inactive: { on: { TOGGLE: 'active' } },
    active: {
      initial: 'heating',
      on: { TOGGLE: 'inactive' },
      states: {
        heating: { /* ... */ },
        idle: { /* ... */ }
      }
    }
  }
})

// --- Adapter: Alak Integration ---
const heater = fromMachine(heaterMachine)

// --- Reactive Bindings ---
heater.state().up(s => console.log('State:', s))
heater.ctx('target').up(t => console.log('Target:', t))

const isActive = heater.state('active')
isActive.up(active => button.classList.toggle('active', active))

// --- Input Binding ---
const sensor = Qv(20)
heater.toEvent(sensor, 'SENSOR_UPDATE', 'temp')

sensor(25) // Auto-sends: { type: 'SENSOR_UPDATE', temp: 25 }

// --- Cleanup ---
heater.decay()
```

### Basic Usage (Minimal Pattern)

If you just need to connect a machine to reactive state, use the basic pattern.

```typescript
import { setup } from 'xstate'
import { fromMachine } from '@alaq/xstate'

const toggleMachine = setup({}).createMachine({
  id: 'toggle',
  initial: 'inactive',
  states: {
    inactive: { on: { TOGGLE: 'active' } },
    active: { on: { TOGGLE: 'inactive' } }
  }
})

const toggle = fromMachine(toggleMachine)

toggle.state('active').up(active => console.log('Active:', active))
toggle.send({ type: 'TOGGLE' }) // Active: true
```

---

### 📚 Documentation

*   **[Concept](./docs/en/CONCEPT.md)** — Philosophy: State machines as brains, reactive primitives as bodies.
*   **[Full Specification](./SPEC.md)** — Complete API reference with all methods and options.

---

### ⚡ Key Features

StateX is designed to combine XState's explicit state modeling with Alak's reactive efficiency.

| Feature | Description |
| :--- | :--- |
| **Visual Design** | Design machines in [Stately.ai](https://stately.ai/viz), use in code |
| **State Binding** | `.state()` for full state, `.state('value')` for matcher |
| **Context Selectors** | `.ctx()` with string paths or functions |
| **Can Check** | `.can(event)` returns reactive boolean |
| **Action Stream** | `.action(type?)` to listen for executed actions |
| **Input Binding** | `.toEvent()` and `.asEvent()` for reactive inputs |
| **Primitive Choice** | Use Quark (default) or Nucl with plugins |
| **Auto Cleanup** | `.decay()` stops machine and clears all subscriptions |
| **TypeScript** | Full type inference from XState machine definitions |
