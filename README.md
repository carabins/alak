# Alak Monorepo

A proactive universe of reactive streams, atoms, and dataflow management.

## ⚠️ Legacy Notice
**Version 5.x is now considered Legacy.** 
Active development has shifted towards stabilization. This version is maintained for compatibility and critical fixes. 

## Focus Packages
The project is centered around three core pillars:

- **[`@alaq/nucleus`](./packages/nucleus)**: The engine. Handles the event bus, computed values (quarks), and the reactive backbone.
- **[`@alaq/atom`](./packages/atom)**: The state layer. Implements reactive "atoms" with proxy-based access and storage synchronization.
- **[`alak`](./packages/alak)**: The high-level facade. Integrates atoms and nuclei into a cohesive developer-friendly API (The Last Atom).

---

## Development

### Prerequisites
- [Bun](https://bun.sh) (recommended) or Node.js
- Standard dependencies installation:
  ```bash
  bun install
  # or
  npm install
  ```

### Testing
To run the full test suite across all packages:
```bash
npm test
```
*Note: Tests use `@swc-node/register` and `tsconfig-paths` for just-in-time compilation and module resolution.*

### Scripts & Task Runner (v6)
The project utilizes a custom task runner located in `scripts-v6/`. This runner handles building, versioning, and publishing.

To start the interactive task menu:
```bash
bun scripts-v6/index.ts
```

## Architecture
Alak follows a "proactive" dataflow model where state (Atoms) and logic (Nucleus) are decoupled but tightly synchronized via a proxy-based reactivity system.

- **Atoms**: Pure state containers.
- **Nucleus**: The reactive core that manages dependencies and updates.
- **Facades**: High-level abstractions (like in `alak`) to simplify complex state machines.

---
License: TVR
