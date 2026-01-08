# Plugins and Kinds

Nucleons (`Nu`, `Nv`) are extended using a plugin system. Plugins can add new methods, properties, and intercept value change lifecycles.

## 1. Using Built-in Plugins

### Via Presets (Recommended)
Presets are pre-configured sets of plugins registered under a specific name (Kind). They also provide automatic typing.

**Combining Kinds**: You can combine multiple kinds by listing them with spaces. Nucl will merge all methods from these plugins.

```typescript
import { Nv } from '@alaq/nucl';
import '@alaq/nucl/presets/std';
import '@alaq/nucl/presets/deep';

// Merging standard helpers and deep reactivity
const list = Nv([1, 2], { kind: 'std deep' });

list.push(3);           // Method from 'std'
list.value[0] = 10;     // Reactivity from 'deep'
```

### Via `defineKind` (Manual Registration)
You can register a plugin under your own name. To make TypeScript aware of the new kind, you need to extend the `NuclearKindRegistry` interface.

```typescript
import { Nv, defineKind } from '@alaq/nucl';
import { stdPlugin } from '@alaq/nucl/std';

// 1. Register logic
defineKind('my-list', stdPlugin);

// 2. Add typing (in a .d.ts file or project entry point)
declare module '@alaq/nucl' {
  export interface NuclearKindRegistry {
    'my-list': any; // The key is the kind name
  }
}

const n = Nv([], { kind: 'my-list' });
```

---

## 2. Creating Custom Plugins

A plugin is an object that can contain lifecycle hooks and new methods.

### Plugin Structure
```typescript
import { INucleonPlugin } from '@alaq/nucl';

const myLogPlugin: INucleonPlugin = {
  name: 'logger',
  
  // Called when every nucleon is created
  onCreate(n) {
    console.log('Nucleon created with id:', n.id);
  },

  // Called before a value change
  onBeforeChange(n, newValue) {
    console.log(`Changing value to: ${newValue}`);
  },

  // Adding methods to the instance
  methods: {
    logValue() {
      // 'this' refers to the nucleon instance
      console.log('Current value:', this.value);
    }
  }
};
```

### Applying Local Plugins
If a plugin is only needed for a single instance, pass it via the `plugins` option:

```typescript
const n = Nv(10, { plugins: [myLogPlugin] });
(n as any).logValue();
```
