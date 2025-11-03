# @alaq/deep-state

Lightweight deep state tracking with proxy reuse optimization.

## Features

- 🚀 **Proxy Reuse** - Existing proxies update values instead of recreation
- ⚡ **Performance Optimized** - String concatenation 4.6x faster than array.join()
- 🎯 **Zero Dependencies** - Fully standalone, no external dependencies
- 🔍 **Deep Tracking** - Track nested object and array changes
- 💾 **Memory Efficient** - Child proxies properly cleared on parent replacement
- 🌳 **Tree-Shakeable** - Import only what you need

## Installation

```bash
bun add @alaq/deep-state
```

## Usage

```typescript
import { createState } from '@alaq/deep-state'

// 1. Create deep state instance
const state = createState((value, { path, type, target, oldValue }) => {
  console.log(`Changed: ${path}`)
}, {
  deepArrays: true,   // Deep tracking for array elements (default: true)
  deepObjects: true   // Deep tracking for objects (default: true)
})

// 2. Start tracking an object
const proxy = state.deepWatch({
  user: { name: 'Alice' },
  items: [1, 2, 3]
})

// 3. Changes are automatically tracked
proxy.user.name = 'Bob'        // ✅ notify called
proxy.items.push(4)             // ✅ notify called
```

## API

### `createState(notify, options?)`

Creates a deep state instance.

**Parameters:**
- `notify: NotifyFn` - Callback called on changes
- `options?: DeepOptions` - Configuration options

**Returns:** State instance with `deepWatch()` method

### `state.deepWatch(value)`

Start deep tracking of an object.

**Parameters:**
- `value: any` - Object to track

**Returns:** Proxy wrapping the value

## Options

```typescript
interface DeepOptions {
  deepArrays?: boolean    // Deep reactivity for array elements (default: true)
  deepObjects?: boolean   // Deep reactivity for objects (default: true)
}
```

## Performance

Benchmarks show significant performance advantages:

- **String concatenation**: 37ms (✅ fastest)
- **Array + join**: 168ms (4.6x slower)
- **Proxy reuse**: Prevents unnecessary object creation

See `benchmark/` directory for detailed benchmarks.

## How It Works

### Proxy Reuse Optimization

When you replace a nested object, the existing proxy is reused:

```typescript
const state = createState(() => {})
const proxy = state.deepWatch({ nested: { a: 1 } })

const ref = proxy.nested
proxy.nested = { b: 2 }

// ref is the same proxy, but now points to new value
console.log(ref === proxy.nested)  // true ✅
console.log(ref.b)                  // 2 ✅
```

### Path Tracking

Changes include the full path to the modified property:

```typescript
const state = createState((value, { path, type }) => {
  console.log(`${type} at ${path}`)
})

const proxy = state.deepWatch({ user: { profile: { age: 25 } } })
proxy.user.profile.age = 30  // "set at user.profile.age"
```

## License

MIT
