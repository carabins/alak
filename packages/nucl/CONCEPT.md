# Nucleus (Nucl): The Intelligent Core

While a **Quark** is a raw container for data, a **Nucleus (Nu)** is the brain that manages it. 

If Quark is the brick, Nucl is the architect.

## 1. Why do we need Nucl?
Raw Quarks are powerful, but they are low-level. In real applications, you need more than just storing a value. You need:
- **Computed Data:** "Full Name" depends on "First" and "Last".
- **Side Effects:** Save to local storage when changed.
- **Validation:** Ensure age is > 0.
- **History:** Undo/Redo capability.

Nucl wraps a Quark and creates a **System** around it using **Plugins**.

## 2. The "Kind" System
Nucl uses a composition pattern called `Kind`. A Kind is a string that defines a set of behaviors (plugins).

```typescript
import { Nu } from '@alaq/nucl'

// A simple storage
const name = Nu({ value: 'Neo' })

// A storage that saves to LocalStorage AND keeps History
const deepConfig = Nu({ 
  kind: 'stored history', // <--- This is the magic
  value: { theme: 'dark' }
})

// Subscribe directly using .up() (Inherited from Quark)
deepConfig.up(val => console.log('Config updated:', val))
```

You don't subclass `Nucl`. You just compose strings.
`kind: 'deep validated async'` -> Creates a Nucleus with Deep Proxy, Validation, and Async capabilities.

## 3. Fusion: Reactive Computations
Nucl introduces **Fusion** — the ability to fuse multiple atoms of state into a new one.

```typescript
import { Nu, fusion } from '@alaq/nucl'

const count = Nu(1)
const double = fusion(use => use(count) * 2)

// 'double' updates automatically when 'count' changes.
// It is lazy and efficient.
double.up(val => console.log('Double is:', val))
```

## 4. The Bridge to the Outside World
Nucl is designed to be the "Public API" of your state.
- It exposes a clean `.value` getter/setter.
- It exposes lifecycle methods like `.decay()`.
- It integrates with the Quantum Bus automatically.

## Summary
- **Quark** = Raw Storage.
- **Nucl** = Storage + **Behavior** (Plugins) + **Computation** (Fusion).
- **Kind** = A text-based recipe for behavior (`'stored'`, `'deep'`, etc).