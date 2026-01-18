# @alaq/quark Implementation Todo

## Interfaces & Optimization
- [ ] **Fast Identification Flag**: Implement a fast boolean property (e.g., `__q: true` or `isQuark: true`) on the Quark prototype. This avoids slow duck-typing checks in UI libraries like `@alaq/flex`.
- [ ] **IQ Interface**: Export a shorthand type `IQ<T>` alias for `IQuark<T>`.

## Core
- [ ] Ensure `_flags` are optimized for V8 hidden classes.
