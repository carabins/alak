# Standard Helpers Plugin (`std`)

The `std` plugin adds convenient methods for working with arrays, objects, and checking state status.

## Installation
```typescript
import '@alaq/nucl/presets/std';
// Or manually
defineKind('std', stdPlugin);
```

## Getters (Properties)

- **`.isEmpty`** — `true` if the value is empty.
  ```typescript
  const n = Nv([], { kind: 'std' });
  console.log(n.isEmpty); // true
  n([1]);
  console.log(n.isEmpty); // false
  ```
- **`.size`** — Array length.
  ```typescript
  const n = Nv([10, 20], { kind: 'std' });
  console.log(n.size); // 2
  ```
- **`.keys`** / **`.values`** — Object keys and values.
  ```typescript
  const user = Nv({ id: 1, name: 'John' }, { kind: 'std' });
  console.log(user.keys);   // ['id', 'name']
  console.log(user.values); // [1, 'John']
  ```

---

## Universal Methods

### `.upSome(listener)`
A subscription that ignores empty values.
```typescript
const n = Nv(null, { kind: 'std' });
n.upSome(v => console.log('Data:', v));

n(null);      // Nothing happens
n(undefined); // Nothing happens
n('Hello');   // Logs: Data: Hello
```

### `.injectTo(obj)` / `.injectAs(key, obj)`
Binds the nucleon value to a property of an external object via getter/setter.
```typescript
const config = { theme: 'dark' };
const theme = Nv('light', { kind: 'std' });

theme.injectAs('theme', config);

console.log(config.theme); // 'light'
config.theme = 'dark';     // Updates 'theme' nucleon
console.log(theme.value);  // 'dark'
```

---

## Array Methods
*All methods create a new array copy to maintain reference immutability.*

```typescript
const list = Nv([1, 2], { kind: 'std' });

list.push(3, 4);      // value is now [1, 2, 3, 4]
const last = list.pop(); // value is now [1, 2, 3], last = 4

const item = list.find(v => v > 1); // 2
const second = list.at(1);          // 2
```

---

## Object Methods

```typescript
const settings = Nv({ volume: 50, bright: 10 }, { kind: 'std' });

settings.set('volume', 60); // value is now { volume: 60, bright: 10 }
const v = settings.get('volume'); // 60

// Pick specific fields
const subset = settings.pick('volume'); // { volume: 60 }
```
