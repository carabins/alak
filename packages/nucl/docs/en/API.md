# Nucl API Reference

This document details the API for `@alaq/nucl`, the extensible reactive primitive.

## Factories

### `Nu(options)`
Creates a new Nucl instance.

**Options:**
- `value` *(any)*: Initial value.
- `kind` *(string)*: The plugin preset to use (default: `"+"`).
- `plugins` *(Array)*: Array of extra plugins to apply to this specific instance.
- `immutable` *(boolean)*: If true, enables immutability checks (plugin dependent).
- *...Quark Options*: `id`, `realm`, `dedup`, `stateless`, `emitChanges`, `pipe`.

```typescript
import { Nu } from '@alaq/nucl'

const n = Nu({ value: 10, kind: 'std' })
```

### `Nv(value, options)`
A shortcut to create a Nucl with a value immediately.
Equivalent to `Nu({ value, ...options })`.

```typescript
import { Nv } from '@alaq/nucl'

// Fast creation
const n = Nv(10)

// With options
const list = Nv([1, 2], { kind: 'std' })
```

---

## Nucl Instance

A Nucl instance is a **Quark** at its core. It is a callable object.
It inherits all Quark methods (`.up`, `.down`, `.silent`, `.decay`).

Depending on the `kind` or `plugins` used, it may have additional methods.

### Standard Plugin (`std`)
When using `kind: 'std'` or `plugins: [stdPlugin]`, the instance gains:

#### Properties
- `.isEmpty`: Returns `true` if value is null, undefined, empty string/array/object.
- `.size`: Returns length (array/string) or key count (object).
- `.keys`: Returns `Object.keys(value)`.
- `.values`: Returns `Object.values(value)`.

#### Methods
- `.get(path)`: Safe deep access.
- `.set(path, val)`: Safe deep update (triggers reactivity).
- `.assign(obj)`: Merges object into value.
- `.push(...items)`: (Array only) Adds items.
- `.pop()`: (Array only) Removes last item.
- `.pick(keys)`: Returns a subset object.

---

## Fusion (Computed)

### `fusion(fn, sources, strategy?)`
Creates a new reactive Nucl that is computed from source Nucleons/Quarks.

- **fn**: `(v1, v2, ...) => result`
- **sources**: Array of reactive sources.
- **strategy**: Update strategy (default: `alive`).

```typescript
import { fusion } from '@alaq/nucl'

const double = fusion(v => v * 2, [sourceNucl])
```

### Strategies
- **`alive`**: Updates only when all sources are "truthy" (not null/undefined). Efficient for data chains.
- **`any`**: Updates when ANY source changes, regardless of value.
- **`lazy`**: Updates only when read (Pull-based).

---

## Plugin System

### `defineKind(name, ...plugins)`
Defines a reusable "Kind" (preset) of plugins.

> **Note:** Kinds should be defined during application bootstrap, before creating instances.

```typescript
import { defineKind, stdPlugin } from '@alaq/nucl'

defineKind('list', stdPlugin)

// usage
const list = Nu({ kind: 'list', value: [] })
```

### Available Plugins
- **`stdPlugin`**: Standard helpers.
- **`deepStatePlugin`**: Deep reactivity (Proxies).
- **`fusionPlugin`**: Enables computed capabilities (usually implicit).
