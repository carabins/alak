# Nucl Concept: The Reactive Molecule

This document explains `@alaq/nucl` — the enhanced reactive primitive built on top of Quark.

## 1. From Atom to Molecule
If **Quark** is the fundamental particle (Atom) of state, **Nucl** (Nucleon) is the Molecule.
It wraps the raw performance of Quark with a powerful, extensible **Plugin System**.

- **Quark:** Raw speed, manual wiring, no overhead.
- **Nucl:** Feature-rich, modular, developer-friendly.

Think of Nucl as a **Quark with superpowers** that you can choose.

## 2. The Power of Plugins
Unlike monolithic frameworks that ship with every feature enabled (and the performance cost that comes with it), Nucl allows you to compose your state primitive.

You define the "Kind" of nucleon you want:
- **`+` (Default):** A bare-metal wrapper around Quark. Maximum speed.
- **`std`:** Adds standard helpers (`isEmpty`, `push`, `pop`, `assign`).
- **`deep`:** Adds deep state tracking (proxies) for nested objects.
- **`custom`:** Define your own business logic methods.

```typescript
import { Nu, defineKind, stdPlugin } from '@alaq/nucl'

// 1. Raw speed (Default)
const simple = Nu({ value: 0 })

// 2. Feature-rich (using 'std' kind)
const list = Nu({ 
  value: [1, 2, 3], 
  kind: 'std' 
})

// Now you have helper methods!
list.push(4) 
console.log(list.size) // 4
```

## 3. Fusion: Computed Reactivity
Nucl introduces **Fusion**, a high-performance system for computed values and side effects.

Fusion allows you to combine multiple Nucl/Quark sources into a new reactive value.

- **Smart Strategies:** Choose how updates propagate (`alive`, `any`, `lazy`).
- **Graph-Free:** Uses direct subscription (edges), avoiding global dependency graph overhead.

```typescript
import { Nu, fusion } from '@alaq/nucl'

const a = Nu(10)
const b = Nu(20)

// Create a fused value (Computed)
const sum = fusion((v1, v2) => v1 + v2, [a, b])

sum.up(val => console.log('Sum:', val)) // 30
a(15) // Sum: 35
```

## 4. Deep Reactivity (Optional)
Nucl can optionally track deep changes in objects and arrays using the `deep-state` plugin.
This provides Vue-like reactivity where mutating a nested property triggers updates.

```typescript
const user = Nu({ 
  value: { name: 'Alice', settings: { theme: 'dark' } },
  plugins: [deepStatePlugin]
})

// Triggers update!
user.value.settings.theme = 'light'
```

## Summary
- **Nucl** = Quark + Plugins.
- **Kind** = A preset of plugins (Reusable configuration).
- **Fusion** = Computed values (Reactive transformation).
- **Philosophy** = Pay only for what you use.
