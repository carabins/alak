# @alaq/quark

**High-Performance Reactive Primitive.**

[![Read in Russian](https://img.shields.io/badge/Language-Russian-blue)](./README.ru.md)

Quark is the fundamental building block of the Alaq ecosystem. It provides a zero-cost abstraction for reactive state, optimized specifically for modern V8 engines (Chrome/Node.js/Bun). Designed to outperform traditional observables by leveraging hidden class optimizations and direct memory access.

### Key Characteristics
*   **V8 Optimized:** Uses monomorphic code and stable hidden classes to ensure maximum execution speed.
*   **Memory Efficient:** Minimal memory footprint with no closure allocation per instance.
*   **Decoupled:** Built-in "Quantum Bus" enables event-driven architecture without tight coupling between components.

---

### Usage Example

```typescript
import { Qu, quantumBus, CHANGE } from '@alaq/quark'

// 1. Initialization (Particle)
// Create a quark in an isolated 'hardware' realm
// Deduplication is enabled by default.
const cpuTemp = Qu({ 
  id: 'cpu_0', 
  value: 45, 
  realm: 'hardware',
  emitChanges: true 
})

// 2. Logic (Transformation)
// Apply a pipe to round values before storage
cpuTemp.pipe(t => Math.round(t))

// 3. Direct Observation (Local Reactivity)
cpuTemp.up(t => {
  if (t > 90) console.warn(`[Alert] CPU Overheat: ${t}°C`)
})

// 4. System Integration (Quantum Bus)
// Analytics module listens to the entire 'hardware' realm
// It has no direct reference to cpuTemp variable
quantumBus.getRealm('hardware').on(CHANGE, ({ id, value }) => {
  Analytics.recordMetric(id, value)
})

// State Updates
cpuTemp(45.4) // Value becomes 45. Ignored if previous was 45 (dedup).
cpuTemp(95)   // Value becomes 95. Triggers Alert and Analytics.
```

---

### 📚 Documentation

*   **[Concept](./docs/en/CONCEPT.md)** — Architectural philosophy: State as particles, Quantum Bus, and Realms.
*   **[Quark API](./docs/en/API.md)** — Reference for `Qu` factory, instance methods, and options.
*   **[Quantum Bus API](./docs/en/BUS_API.md)** — Reference for event routing and cross-realm communication.
