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

For maximum performance (450k ops/ms), use pre-compilation via `Atom.define`.

```typescript
import { Atom, kind } from '@alaq/atom';
import '@alaq/nucl/presets/std'; 

class CounterStore {
  count = 0;
  history = kind('std', []);

  get doubled() {
    return this.count * 2;
  }

  increment() {
    this.count++;
    this.history.push(this.count);
  }
}

// 1. Compile schema (once)
const Counter = Atom.define(CounterStore);

// 2. Create instance (instant)
const counter = Counter.create(); 
// or Counter.get('main') for singleton/Identity Map

counter.$count.up(val => console.log('Count:', val));
counter.increment();
```

---

### ⚡ Performance

Thanks to Zero-Proxy architecture and JIT schema compilation, Atom creates instances faster than any competitor.

| Metric | @alaq/atom (Compiled) | Signals (Preact) | Vue (Ref) | MobX |
| :--- | :--- | :--- | :--- | :--- |
| **Creation** | **~450k ops/ms** | ~85k ops/ms | ~18k ops/ms | ~7k ops/ms |
| **Read** | **~95k ops/ms** | ~150k ops/ms | ~90k ops/ms | ~100k ops/ms |
| **Memory (1M units)** | **~180 MB** | ~80 MB | ~120 MB | ~240 MB |

*> Benchmarks run on Bun v1.3. Detailed report: [BENCHMARK_REPORT.md](../../BENCHMARK_REPORT.md)*
