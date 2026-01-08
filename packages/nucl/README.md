# @alaq/nucl

**Extensible reactive primitive with a plugin system.**

[![Читать на русском](https://img.shields.io/badge/Language-Russian-red)](./README.ru.md)

Nucl (Nucleon) is a high-level wrapper around Quark, providing a modular architecture for state management. It combines the extreme performance of the core with the convenience of modern development through a system of plugins and computed values (Fusion).

### 📦 Installation

```bash
bun add @alaq/nucl
# or
npm install @alaq/nucl
```

---

### 🛠 Quick Start

```typescript
import { Nv, fusion } from '@alaq/nucl';
import '@alaq/nucl/presets/std'; // Enable standard helpers

// 1. Create a nucleon with 'std' helpers
const price = Nv(100, { kind: 'std' });
const quantity = Nv(2, { kind: 'std' });

// 2. Fusion: Computed value
const total = fusion(price, quantity).alive((p, q) => p * q);

total.up(val => console.log('Total:', val)); // 200

price(150); // Total: 300
```

---

### 📚 Documentation

*   **[Concept](./docs/en/CONCEPT.md)** — Nucleon as an extensible state structure.
*   **[Core API](./docs/en/API.md)** — Basic factories `Nu`, `Nv` and core methods.
*   **[Plugin System](./docs/en/API_PLUGINS.md)** — How to use Kinds and create extensions.
*   **[Fusion API](./docs/en/API_PLUGIN_FUSION.md)** — Computed values and strategies.
*   **[Standard Helpers](./docs/en/API_PLUGIN_STD.md)** — `.push()`, `.set()`, `.isEmpty` methods.
*   **[Deep State](./docs/en/API_PLUGIN_DEEP.md)** — Proxies and deep tracking.
*   **[Comparison](./docs/en/COMPARISON.md)** — Nucl vs Quark vs Vue.

---

### ⚡ Performance

Nucl is optimized for maximum read speed and complex data handling. Thanks to the Fusion system and optimized proxies, Nucleon significantly outperforms traditional libraries in computed reads and deep mutations.

| Metric | @alaq/nucl | Signals (Preact) | Vue Reactive | Valtio |
| :--- | :--- | :--- | :--- | :--- |
| **Read Speed** | **~540k ops/ms** | ~250k ops/ms | ~125k ops/ms | ~320k ops/ms |
| **Read (Cached)** | **~330k ops/ms** | ~110k ops/ms | ~85k ops/ms | - |
| **Deep Mutation** | **~8.3k ops/ms** | - | ~1.8k ops/ms | ~4.4k ops/ms |

*> Benchmarks run on Bun v1.3. Detailed report: [BENCHMARK_REPORT.md](../../BENCHMARK_REPORT.md)*
