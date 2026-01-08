# Deep Reactivity Plugin (`deep-state`)

The `deep-state` plugin allows a nucleon to track changes inside complex objects and arrays using Proxies. This makes state management feel like Vue or MobX.

## Installation
```typescript
import '@alaq/nucl/presets/deep';
// Or manually
const n = Nv({ a: 1 }, { plugins: [deepStatePlugin] });
```

## How It Works

Normally, changing a property inside an object (e.g., `n.value.count++`) doesn't notify the nucleon because the object reference remains the same. The `deep-state` plugin wraps the value in a Proxy and:

1.  **Automatically notifies subscribers** (`.up()`, `fusion`) when any nested property changes.
2.  **Enables mutations**: You don't need to manually clone the entire object for simple updates.

```typescript
const user = Nv({ name: 'John', stats: { age: 25 } }, { kind: 'deep' });

user.up(val => console.log('Data changed:', val));

// This triggers .up()
user.value.stats.age = 26;
```

## Features

- **Raw Data**: If you need the original object without the Proxy (e.g., to pass to an external library), call the nucleon as a function without arguments: `const raw = n()`. The `n.value` property always returns a Proxy.
- **Performance**: Using Proxies adds slight overhead to property access. Use this plugin only where deep reactivity is truly needed.
- **Fusion Integration**: The plugin communicates GET/SET operations to Nucl internals, enabling high-precision Fusion updates.
- **Immutable Events**: Even though you can mutate the object, the change event still follows reactive stream rules.
