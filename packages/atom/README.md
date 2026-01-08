# @alaq/atom

**Class-based reactive state orchestrator.**

[![Читать на русском](https://img.shields.io/badge/Language-Russian-red)](./README.ru.md)

Atom is the most powerful and convenient tool in the Alaq ecosystem. It allows you to transform regular JavaScript/TypeScript classes into high-performance reactive models (stores) with automatic dependency tracking.

### 📦 Installation

```bash
bun add @alaq/atom
# or
npm install @alaq/atom
```

---

### 🛠 Quick Start

```typescript
import { Atom, kind } from '@alaq/atom';
import '@alaq/nucl/presets/std'; // Enable standard helpers

class CounterStore {
  // Properties automatically become nucleons
  count = 0;
  
  // Define nucleon type using kind()
  history = kind('std', []);

  // Getters automatically become computed properties
  get doubled() {
    return this.count * 2;
  }

  // Methods work as usual, but writing to properties triggers reactivity
  increment() {
    this.count++;
    this.history.push(this.count);
  }
}

const counter = Atom(CounterStore);

// Subscribe to changes
counter.$count.up(val => console.log('Count changed:', val));

counter.increment();
console.log(counter.doubled); // 2
```

---

### 📚 Documentation

*   **[Concept](./docs/en/CONCEPT.md)** — The philosophy of classes as state schemas and transparent reactivity.
*   **[API Reference](./docs/en/API.md)** — Detailed description of the `Atom` factory, `$` context, and proxy behavior.

---

### ⚡ Performance

Atom adds minimal overhead (Proxy + class instance) on top of Nucl, maintaining its speed leadership among other state managers.

| Metric | @alaq/atom | MobX | Zustand |
| :--- | :--- | :--- | :--- |
| **Property Read** | **~350k ops/ms** | ~140k ops/ms | ~180k ops/ms |
| **Memory (1M units)** | **~180 MB** | ~240 MB | ~150 MB |

*> Benchmarks run on Bun v1.3. Detailed report: [BENCHMARK_REPORT.md](../../BENCHMARK_REPORT.md)*
