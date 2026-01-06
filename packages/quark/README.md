# @alaq/quark

**The High-Performance Reactive Primitive.**

[![Read in Russian](https://img.shields.io/badge/Language-Russian-blue)](./README.ru.md)

Quark is the fundamental building block of the Alaq ecosystem. It provides a zero-cost abstraction for reactive state, optimized specifically for modern V8 engines (Chrome/Node.js/Bun).

### 📦 Installation

```bash
bun add @alaq/quark
# or
npm install @alaq/quark
```

---

### ⚡ Performance Benchmarks

Quark is designed for high-frequency scenarios where traditional libraries introduce garbage collection pauses or frame drops.

| Metric | @alaq/quark | Signals (Solid/Preact) | Observables (RxJS) |
| :--- | :--- | :--- | :--- |
| **Update Speed** | **~10ns / op** | ~150ns / op | ~1000ns+ / op |
| **Creation Speed** | **~0.15µs** | ~0.50µs | ~2.00µs |
| **Memory per Unit** | **~40 bytes** | ~80-120 bytes | ~200+ bytes |

*> Benchmarks run on Bun v1.3 / V8. Speed measured on 1M iterations.*

---

### 🛠 Architecture Example

In this scenario, we separate the **Data Source** (Engine) from the **Interface** (UI) using Realms. This allows the UI to be completely decoupled from the complex engine logic.

```typescript
import { Qu, quantumBus, CHANGE } from '@alaq/quark'

// --- Realm 1: "Engine" (High-Frequency Data Source) ---
// These quarks represent raw hardware sensors.
// They emit changes to the 'engine' bus.
const rpm = Qu({ realm: 'engine', id: 'rpm', value: 0, emitChanges: true })
const temp = Qu({ realm: 'engine', id: 'temp', value: 60, emitChanges: true })
const fuel = Qu({ realm: 'engine', id: 'fuel', value: 100 })

// --- Realm 2: "UI" (Interface State) ---
// This quark controls a visual element. It belongs to a different isolated world.
const alertVisible = Qu({ realm: 'ui', id: 'alert', value: false })

// --- System Logic ( The "Wiring" ) ---
// The connection logic lives in the bus, decoupling the two realms.
// The UI does not need to import the 'rpm' variable directly.

const engineBus = quantumBus.getRealm('engine')

engineBus.on(CHANGE, ({ id, value }) => {
  // Logic: If RPM > 8000, trigger UI alert in the other realm
  if (id === 'rpm') {
    if (value > 8000 && !alertVisible.value) {
      console.log('[System] RPM Critical! Showing Alert.')
      alertVisible(true) // Cross-realm update
    } else if (value <= 8000 && alertVisible.value) {
      alertVisible(false)
    }
  }
})

// --- Simulation ---

// 1. Normal operation
rpm(4000) 
// -> 'engine' bus emits CHANGE { id: 'rpm', value: 4000 }
// -> Logic checks condition (False)
// -> 'ui' realm remains silent

// 2. Critical operation
rpm(8500)
// -> 'engine' bus emits CHANGE { id: 'rpm', value: 8500 }
// -> Logic checks condition (True)
// -> alertVisible updates to true
// -> 'ui' realm emits its own events
```

### Basic Usage (Minimal Pattern)

If you don't need complex realms and just want a simple reactive variable, use `Qv` (shortcut for `Qu` with initial value).

```typescript
import { Qv } from '@alaq/quark'

// Create and set initial value immediately
const count = Qv(10)

// Direct subscription
count.up(val => console.log('Count:', val))

// Update
count(11) // logs: Count: 11
```

---

### 📚 Documentation

*   **[Concept](./docs/en/CONCEPT.md)** — Architectural philosophy: State as particles, Quantum Bus, and Realms.
*   **[Comparison](./docs/en/COMPARISON.md)** — Detailed breakdown vs Signals and RxJS.
*   **[Quark API](./docs/en/API.md)** — Reference for `Qu` factory, instance methods, and options.
*   **[Quantum Bus API](./docs/en/BUS_API.md)** — Reference for event routing and cross-realm communication.
