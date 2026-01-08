# Comparison: Nucl vs Quark vs Vue

This document places `@alaq/nucl` in the ecosystem context.

## 1. Nucl vs Quark

**Quark** is the engine. **Nucl** is the car.

| Feature | Quark | Nucl |
| :--- | :--- | :--- |
| **Philosophy** | "Metal" Performance | Developer Experience (DX) |
| **API Surface** | Minimal (.up, .value) | Extensible (Plugins) |
| **Deep Reactivity** | No (Primitive/Reference only) | Yes (via `deep-state`) |
| **Computed** | Manual (Pipe/Listeners) | First-class (`fusion`) |
| **Creation Speed** | Extreme (~12k ops/ms) | Very Fast (~6.5k ops/ms) |
| **Memory** | Tiny | Small (Prototype chain overhead) |

**When to use Quark?**
- High-frequency trading, Games (60fps loop), massive data visualization.
- When you don't need helpers like `.push()` or computed props.

**When to use Nucl?**
- Application State Management (Stores).
- UI Logic (where computed values are common).
- When you want convenience methods (`isEmpty`, `assign`).

---

## 2. Nucl vs Vue Reactivity (`ref`)

Nucl mimics the API and ergonomics of `ref` but focuses on explicit data flow.

| Feature | Vue `ref` | Nucl |
| :--- | :--- | :--- |
| **Dependency Tracking** | Automatic (Global Graph) | Explicit (Edges/Fusion) |
| **Deep Reactivity** | Enabled by default | Opt-in (Plugin) |
| **Modularity** | Fixed feature set | Composable (Plugins) |
| **Performance** | Optimized for DOM | Optimized for Data Flow |
| **Cross-Module** | Requires context/props | Native (Realms) |

**Key Difference:**
Vue's reactivity is "Magic" (it tracks what you read).
Nucl's reactivity is "Explicit" (you declare what you depend on).

Explicit reactivity (Nucl/Fusion) is generally:
1.  **More predictable:** No "why did this re-render?" mysteries.
2.  **More performant:** No graph traversal overhead on reads.
3.  **Harder to write:** You must list dependencies manually.

## Summary

- Use **Quark** for raw primitives.
- Use **Nucl** for app state and logic.
- Use **Vue Ref** inside Vue Components (for DOM binding convenience).
