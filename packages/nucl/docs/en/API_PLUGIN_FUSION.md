# Fusion (Computed Values)

**Fusion** is a mechanism for creating dependent (computed) values based on one or more nucleons.

## Usage (Builder Pattern)

The `fusion(...sources)` function returns a builder object that lets you choose an update strategy.

```typescript
import { Nv, fusion } from '@alaq/nucl';

const price = Nv(100);
const quantity = Nv(2);

// Create a computed value
const total = fusion(price, quantity).alive((p, q) => p * q);

console.log(total.value); // 200
```

## Update Strategies

### `.alive(fn)`
The most common strategy. The computation runs only if **all** sources have "valid" values (not `null` or `undefined`).
Ideal for data chains where missing one link makes the calculation meaningless.

### `.any(fn)`
The computation runs on **any** change to any source, even if their values become `null` or `undefined`.

---

## Important Features

1.  **Result Type**: Fusion returns a fully functional Nucl. You can subscribe to it via `.up()` or use it as a source for another Fusion.
2.  **Lifecycle Management**: If one of the source nucleons is destroyed via `.decay()`, the fused nucleon also becomes `undefined` and stops updating.
3.  **Immediate Calculation**: Fusion calculates the initial value immediately upon creation.

## Side Effects

If you don't need a new value but want to perform an action when a group of nucleons changes, use helper functions from `@alaq/nucl/fusion/effects`:

- **`aliveFusion(sources, fn)`** — Runs `fn` when all sources are valid.
- **`anyFusion(sources, fn)`** — Runs `fn` on any change.

Both functions return a `cleanup` function.

```typescript
import { aliveFusion } from '@alaq/nucl/fusion/effects';

const stop = aliveFusion([user, token], (u, t) => {
  console.log(`User ${u} authorized with token ${t}`);
});

// To unsubscribe:
stop();
```
