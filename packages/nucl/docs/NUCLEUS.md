# Nucleus - Universal Plugins for Nucl

**Entry point:** `@alaq/nucl/nucleus`

This preset includes universal utilities and basic type-specific plugins that cover 90% of use cases.

## What's Included

When you import from `@alaq/nucl/nucleus`, you get:

- **Universal Plugin** - Works with any type
- **Array Plugin** - Methods for `Nucl<T[]>`
- **Object Plugin** - Methods for `Nucl<Record<K, V>>`

## Installation

```bash
bun add @alaq/nucl
```

## Usage

```typescript
import { Nucl } from '@alaq/nucl/nucleus'

// Universal methods work on any type
const name = Nucl('John')
console.log(name.isEmpty)  // false

// Array methods work on arrays
const items = Nucl([1, 2, 3])
items.push(4)
console.log(items.value)  // [1, 2, 3, 4]

// Object methods work on objects
const user = Nucl({ name: 'John', age: 30 })
user.set('age', 31)
console.log(user.get('age'))  // 31
```

---

## Universal Plugin

Methods that work with **any type** of Nucl.

### `.isEmpty` (getter)

Check if value is empty (null, undefined, '', [], {}, 0, false, NaN).

```typescript
const name = Nucl('')
console.log(name.isEmpty)  // true

name('John')
console.log(name.isEmpty)  // false

const items = Nucl([])
console.log(items.isEmpty)  // true

items.push(1)
console.log(items.isEmpty)  // false
```

### `.upSome(fn)`

Subscribe to changes, but only trigger when value is truthy.

```typescript
const count = Nucl(0)

count.upSome(value => {
  console.log('Positive:', value)
})

count(0)   // No trigger (falsy)
count(5)   // → "Positive: 5"
count(10)  // → "Positive: 10"
count(0)   // No trigger (falsy)
```

**Signature:**
```typescript
upSome(fn: (value: T) => void): this
```

### `.injectTo(obj)`

Inject this Nucl into an object as a reactive property.

```typescript
const count = Nucl(0)
const state = {}

count.injectTo(state)
// Creates reactive getter/setter on state

console.log(state.count)  // 0
state.count = 5
console.log(count.value)  // 5
```

**Signature:**
```typescript
injectTo(obj: any): this
```

### `.injectAs(key, obj)`

Inject this Nucl into an object under a specific key.

```typescript
const name = Nucl('John')
const state = {}

name.injectAs('userName', state)

console.log(state.userName)  // 'John'
state.userName = 'Alice'
console.log(name.value)  // 'Alice'
```

**Signature:**
```typescript
injectAs(key: string, obj: any): this
```

---

## Array Plugin

Methods available only when `T extends Array<U>`.

### `.push(...items)`

Add items to the end of the array.

```typescript
const items = Nucl([1, 2, 3])

items.push(4)
console.log(items.value)  // [1, 2, 3, 4]

items.push(5, 6, 7)
console.log(items.value)  // [1, 2, 3, 4, 5, 6, 7]
```

**Signature:**
```typescript
push(...items: U[]): this
```

### `.pop()`

Remove and return the last item.

```typescript
const items = Nucl([1, 2, 3])

const last = items.pop()
console.log(last)  // 3
console.log(items.value)  // [1, 2]
```

**Signature:**
```typescript
pop(): U | undefined
```

### `.map(fn)`

Transform array and return a **new Nucl** with mapped values.

```typescript
const numbers = Nucl([1, 2, 3])

const doubled = numbers.map(n => n * 2)
console.log(doubled.value)  // [2, 4, 6]

// Original unchanged
console.log(numbers.value)  // [1, 2, 3]

// Reactive: when numbers change, doubled updates
numbers.push(4)
console.log(doubled.value)  // [2, 4, 6, 8]
```

**Signature:**
```typescript
map<R>(fn: (item: U) => R): Nucl<R[]>
```

### `.filter(fn)`

Filter array and return a **new Nucl** with filtered values.

```typescript
const numbers = Nucl([1, 2, 3, 4, 5])

const evens = numbers.filter(n => n % 2 === 0)
console.log(evens.value)  // [2, 4]

// Reactive
numbers.push(6)
console.log(evens.value)  // [2, 4, 6]
```

**Signature:**
```typescript
filter(fn: (item: U) => boolean): Nucl<U[]>
```

### `.find(fn)`

Find first matching item.

```typescript
const users = Nucl([
  { id: 1, name: 'John' },
  { id: 2, name: 'Alice' }
])

const user = users.find(u => u.id === 2)
console.log(user)  // { id: 2, name: 'Alice' }
```

**Signature:**
```typescript
find(fn: (item: U) => boolean): U | undefined
```

### `.at(index)`

Get item at index (supports negative indexing).

```typescript
const items = Nucl(['a', 'b', 'c'])

console.log(items.at(0))   // 'a'
console.log(items.at(-1))  // 'c'
console.log(items.at(10))  // undefined
```

**Signature:**
```typescript
at(index: number): U | undefined
```

### `.length` (getter)

Get array length.

```typescript
const items = Nucl([1, 2, 3])

console.log(items.length)  // 3

items.push(4)
console.log(items.length)  // 4
```

**Signature:**
```typescript
get length(): number
```

---

## Object Plugin

Methods available only when `T extends Record<string, any>`.

### `.set(key, value)`

Set a property value.

```typescript
const user = Nucl({ name: 'John', age: 30 })

user.set('age', 31)
console.log(user.value)  // { name: 'John', age: 31 }

user.set('email', 'john@example.com')
console.log(user.value)  // { name: 'John', age: 31, email: '...' }
```

**Signature:**
```typescript
set<K extends keyof T>(key: K, value: T[K]): this
```

### `.get(key)`

Get a property value.

```typescript
const user = Nucl({ name: 'John', age: 30 })

console.log(user.get('name'))  // 'John'
console.log(user.get('age'))   // 30
```

**Signature:**
```typescript
get<K extends keyof T>(key: K): T[K]
```

### `.pick(...keys)`

Pick specific keys and return a **new Nucl** with subset.

```typescript
const user = Nucl({
  name: 'John',
  age: 30,
  email: 'john@example.com',
  password: 'secret'
})

const safe = user.pick('name', 'email')
console.log(safe.value)  // { name: 'John', email: '...' }

// Reactive: when user changes, safe updates
user.set('name', 'Alice')
console.log(safe.value)  // { name: 'Alice', email: '...' }
```

**Signature:**
```typescript
pick<K extends keyof T>(...keys: K[]): Nucl<Pick<T, K>>
```

### `.omit(...keys)`

Omit specific keys and return a **new Nucl** with remaining properties.

```typescript
const user = Nucl({
  name: 'John',
  age: 30,
  password: 'secret'
})

const safe = user.omit('password')
console.log(safe.value)  // { name: 'John', age: 30 }
```

**Signature:**
```typescript
omit<K extends keyof T>(...keys: K[]): Nucl<Omit<T, K>>
```

### `.keys()` (getter)

Get object keys as array.

```typescript
const user = Nucl({ name: 'John', age: 30 })

console.log(user.keys)  // ['name', 'age']
```

**Signature:**
```typescript
get keys(): (keyof T)[]
```

### `.values()` (getter)

Get object values as array.

```typescript
const user = Nucl({ name: 'John', age: 30 })

console.log(user.values)  // ['John', 30]
```

**Signature:**
```typescript
get values(): T[keyof T][]
```

---

## TypeScript Support

All methods are fully typed and support conditional types:

```typescript
const num = Nucl(42)
// num.push(1)  // ❌ Error: number is not an array

const arr = Nucl([1, 2, 3])
arr.push(4)  // ✅ OK
// arr.set('x', 1)  // ❌ Error: array is not an object

const obj = Nucl({ x: 1 })
obj.set('x', 2)  // ✅ OK
// obj.push(1)  // ❌ Error: object is not an array
```

## Tree-Shaking

The `nucleus` preset bundles all common plugins into one for better performance:

```typescript
// Recommended: Use the nucleus preset
import { Nucl } from '@alaq/nucl/nucleus'
// nucleusPlugin auto-installed (universal + array + object)

// Alternative: Manual installation (same result)
import { Nucl, use } from '@alaq/nucl'
import { nucleusPlugin } from '@alaq/nucl/nucleus'
use(nucleusPlugin)
```

**Why one plugin instead of many?**
- ✅ Faster initialization (1 `use()` call vs 3)
- ✅ Less overhead (1 prototype extension vs 3)
- ✅ Smaller bundle (no duplicate code)
- ✅ Better performance (less registry lookups)

If you need even more granular control, you can import individual method collections (advanced):

```typescript
import { Nucl } from '@alaq/nucl'
import { universalMethods } from '@alaq/nucl/plugins/universal'
import { arrayMethods } from '@alaq/nucl/plugins/array'

// Create custom plugin with only what you need
Object.assign(Nucl.prototype, universalMethods)
```

But for most cases, just use `@alaq/nucl/nucleus` - it's optimized and includes everything you need.

---

## See Also

- [Fusion](./FUSION.md) - Computed values and reactive composition
- [Core API](../README.md) - Base Nucl functionality
- [Plugins Guide](./PLUGINS.md) - Creating custom plugins
