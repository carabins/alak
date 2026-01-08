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

### 🛠 Architecture Example

In this scenario, we separate the **Data Source** (Engine) from the **Interface** (UI) using Realms. This allows the UI to be completely decoupled from the complex engine logic.

```typescript
import { Qu, quantumBus, CHANGE } from '@alaq/quark'

// --- Realm 1: "Engine" ---
const rpm = Qu({ realm: 'engine', id: 'rpm', value: 0, emitChanges: true })
const temp = Qu({ realm: 'engine', id: 'temp', value: 60, emitChanges: true })
const fuel = Qu({ realm: 'engine', id: 'fuel', value: 100 })

// --- Realm 2: "UI" ---
const alertVisible = Qu({ realm: 'ui', id: 'alert', value: false })

// --- System Logic ---
const engineBus = quantumBus.getRealm('engine')

engineBus.on(CHANGE, ({ id, value }) => {
  if (id === 'rpm') {
    if (value > 8000 && !alertVisible.value) {
      console.log('[System] RPM Critical! Showing Alert.')
      alertVisible(true) 
    } else if (value <= 8000 && alertVisible.value) {
      alertVisible(false)
    }
  }
})
```

### Basic Usage (Minimal Pattern)

If you don't need complex realms and just want a simple reactive variable, use `Qv`.

```typescript
import { Qv } from '@alaq/quark'

const count = Qv(10)
count.up(val => console.log('Count:', val))
count(11) 
```

---

### 📚 Documentation

*   **[Concept](./docs/en/CONCEPT.md)** — Architectural philosophy: State as particles, Quantum Bus, and Realms.
*   **[Comparison](./docs/en/COMPARISON.md)** — Detailed breakdown vs Signals and RxJS.
*   **[Quark API](./docs/en/API.md)** — Reference for `Qu` factory, instance methods, and options.
*   **[Quantum Bus API](./docs/en/BUS_API.md)** — Reference for event routing and cross-realm communication.

---

### ⚡ Performance Benchmarks

Quark is designed for high-frequency scenarios where raw access speed and minimal memory footprint are critical.

| Metric | @alaq/quark | Signals (Preact) | Vue (Ref) | MobX |
| :--- | :--- | :--- | :--- | :--- |
| **Read Speed** | **~400k ops/ms** | ~250k ops/ms | ~125k ops/ms | ~135k ops/ms |
| **Creation (Object)** | **~23k ops/ms** | ~34k ops/ms | ~5k ops/ms | ~0.7k ops/ms |
| **Memory (1M units)** | **~28 MB** | ~80 MB | ~120 MB | ~240 MB |

*> Benchmarks run on Bun v1.3 / V8. Detailed report: [BENCHMARK_REPORT.md](../../BENCHMARK_REPORT.md)*
