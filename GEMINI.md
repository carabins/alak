# Gemini Added Memories

# Core Rules
- **Strict Plan Adherence:** Never deviate from the agreed plan or switch strategies (e.g., dropping a library) without explicit user confirmation. If a blocker arises, report it and propose options.
- Package management: Do NOT create `package.json` or `tsconfig.json` in packages. They break tests and path resolution. All paths must be configured in the root `tsconfig.json`. They are generated automatically by build scripts. Use `package.yaml` instead (similar to `@packages/quark/package.yaml`).
- Testing: Run tests via `bun test ./packages/<package_name>/test/`.

# IQ Interface Specification (The Golden Standard)

All reactive primitives in the ecosystem must implement this interface.

```typescript
interface IQ<T> {
  // 1. Identification (Fast check, no duck-typing)
  readonly __q: true;

  // 2. Value Access
  // Get: node() -> T
  // Set: node(val) -> val (triggers update)
  (value?: T): T;

  // 3. Explicit Value Getter (for tools/proxies)
  readonly value: T;

  // 4. Subscription
  // Returns unsubscribe function
  up(listener: (val: T) => void): () => void;
  
  // 5. Unsubscribe (Alternative)
  down(listener: (val: T) => void): void;
}
```

Any object implementing `IQ` is compatible with `@alaq/flex`, `@alaq/fx`, and `@alaq/link-state`.