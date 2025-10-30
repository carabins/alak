# Fusion - Computed Values & Reactive Composition

**Entry point:** `@alaq/nucl/fusion`

Fusion allows you to create computed values that automatically update when their source Nucl instances change.

## Quick Start

```bash
bun add @alaq/nucl
```

```typescript
import { Nucl } from '@alaq/nucl'
import { Fusion } from '@alaq/nucl/fusion'

const firstName = Nucl('John')
const lastName = Nucl('Doe')

// Create computed value
const fullName = Fusion(firstName, lastName, (first, last) => {
  return `${first} ${last}`
})

console.log(fullName.value)  // "John Doe"

firstName('Alice')
console.log(fullName.value)  // "Alice Doe" (updated automatically!)
```

---

## Three APIs

Fusion provides three different APIs for different use cases:

### 1. **Fusion** - Simple default (alive strategy)

Short syntax for most common cases. Recomputes only when sources are truthy.

```typescript
import { Fusion } from '@alaq/nucl/fusion'

const user = Nucl(null)
const settings = Nucl(null)

const profile = Fusion(user, settings, (u, s) => ({
  ...u,
  settings: s
}))

user(null)              // No recompute (falsy)
settings({ theme: 'dark' })  // → Recompute (truthy)
user({ id: 1 })         // → Recompute (truthy)
```

### 2. **NeoFusion** - Advanced strategies

Builder pattern for explicit control over recomputation strategy.

```typescript
import { NeoFusion } from '@alaq/nucl/fusion'

// .any() - Recompute on ALL changes (including falsy)
const isValid = NeoFusion(email, password).any((e, p) => {
  return e.length > 0 && p.length > 6
})

// .alive() - Recompute only when truthy (same as Fusion)
const active = NeoFusion(enabled, data).alive((e, d) => {
  return e ? d : null
})
```

### 3. **Utilities** - Side-effects only

For running effects without creating a new Nucl. Returns cleanup function.

```typescript
import { AliveFusion, AnyFusion } from '@alaq/nucl/fusion'

// Run effect when sources are truthy
const stop1 = AliveFusion([user, settings], (u, s) => {
  console.log('User settings:', u, s)
})

// Run effect on ANY change
const stop2 = AnyFusion([count], (c) => {
  document.title = `Count: ${c}`
})

// Cleanup
stop1()
stop2()
```

---

## API Reference

### Fusion(source1, source2, ..., fn)

Create a computed Nucl with `alive` strategy (default).

**Signature:**
```typescript
function Fusion<A, B, R>(
  a: Nucl<A>,
  b: Nucl<B>,
  fn: (a: A, b: B) => R
): Nucl<R>

// Supports up to 10 sources
function Fusion<A, B, C, D, E, R>(
  a: Nucl<A>,
  b: Nucl<B>,
  c: Nucl<C>,
  d: Nucl<D>,
  e: Nucl<E>,
  fn: (a: A, b: B, c: C, d: D, e: E) => R
): Nucl<R>
```

**Examples:**

```typescript
// Simple computation
const count = Nucl(5)
const double = Fusion(count, (c) => c * 2)

// Multiple sources
const price = Nucl(100)
const quantity = Nucl(5)
const tax = Nucl(0.2)

const total = Fusion(price, quantity, tax, (p, q, t) => {
  return p * q * (1 + t)
})

console.log(total.value)  // 600
price(200)
console.log(total.value)  // 1200
```

**alive strategy behavior:**

```typescript
const enabled = Nucl(false)
const data = Nucl(100)

const result = Fusion(enabled, data, (e, d) => e ? d : 0)

data(200)      // No recompute (enabled is false)
enabled(true)  // → Recompute (now truthy)
data(300)      // → Recompute (enabled still truthy)
```

---

### NeoFusion(sources...).strategy(fn)

Advanced fusion with explicit strategy selection.

#### `.any(fn)` - Recompute on ALL changes

Recomputes whenever **any** source changes, including falsy values.

```typescript
const email = Nucl('')
const password = Nucl('')

const isValid = NeoFusion(email, password).any((e, p) => {
  return e.length > 0 && p.length > 6
})

email('')     // → Recompute (even empty string matters)
password('')  // → Recompute
```

**Use cases:**
- Form validation (empty values matter)
- State machines (false/0 are valid states)
- Logging (need to track all changes)

#### `.alive(fn)` - Recompute when truthy

Recomputes only when sources are truthy. Same as `Fusion` default.

```typescript
const user = Nucl(null)
const posts = Nucl(null)

const userPosts = NeoFusion(user, posts).alive((u, p) => {
  return { user: u, posts: p }
})

user(null)              // No recompute
posts([1, 2, 3])        // → Recompute (truthy)
user({ id: 1 })         // → Recompute (truthy)
```

**Use cases:**
- Waiting for data to load
- Conditional logic
- Optional dependencies

---

### AliveFusion(sources, fn) → cleanup

Utility for side-effects. Runs only when sources are truthy.

**Signature:**
```typescript
function AliveFusion<A, B>(
  sources: [Nucl<A>, Nucl<B>],
  fn: (a: A, b: B) => void
): () => void
```

**Example:**

```typescript
const user = Nucl(null)
const theme = Nucl(null)

const stop = AliveFusion([user, theme], (u, t) => {
  console.log(`User ${u.id} prefers ${t}`)
})

user(null)                      // No effect
theme('dark')                   // → Effect runs
user({ id: 1 })                 // → Effect runs
theme('light')                  // → Effect runs

stop()  // Cleanup
```

---

### AnyFusion(sources, fn) → cleanup

Utility for side-effects. Runs on **any** change.

**Signature:**
```typescript
function AnyFusion<A, B>(
  sources: [Nucl<A>, Nucl<B>],
  fn: (a: A, b: B) => void
): () => void
```

**Example:**

```typescript
const route = Nucl('/home')
const user = Nucl(null)

const stop = AnyFusion([route, user], (r, u) => {
  console.log(`Navigation: ${r}, User: ${u?.id || 'anonymous'}`)
})

route('/about')  // → Effect runs (even if user is null)
user(null)       // → Effect runs (null matters)
user({ id: 1 })  // → Effect runs

stop()  // Cleanup
```

---

## Strategies

### alive (default for Fusion)

Recomputes only when sources are **truthy**.

**Skips:**
- `null`
- `undefined`
- `false`
- `0`
- `''` (empty string)
- `NaN`

**Use when:**
- Waiting for async data to load
- Conditional computations
- Optional dependencies

```typescript
const data = Nucl(null)
const config = Nucl({ x: 1 })

// Won't compute until data is truthy
const result = Fusion(data, config, (d, c) => process(d, c))

data(null)           // Skipped
config({ x: 2 })     // Skipped (data still null)
data({ value: 10 })  // → Computed!
```

### any

Recomputes on **every** change, including falsy values.

**Includes:**
- All values from `alive`
- Plus: `null`, `undefined`, `false`, `0`, `''`, `NaN`

**Use when:**
- Form validation (empty = invalid)
- State machines (false is a state)
- Logging everything
- Falsy values are meaningful

```typescript
const agreed = Nucl(false)
const email = Nucl('')

// Must validate even when false/empty
const canSubmit = NeoFusion(agreed, email).any((a, e) => {
  return a === true && e.length > 0
})

agreed(false)  // → Recomputed (false matters)
email('')      // → Recomputed (empty matters)
```

---

## Advanced Features

### Unpacked Values

Fusion automatically unpacks values - no need for `.value`:

```typescript
const a = Nucl(5)
const b = Nucl(10)

// ❌ Without Fusion (manual)
const sum = Nucl(a.value + b.value)
a.up(() => sum(a.value + b.value))
b.up(() => sum(a.value + b.value))

// ✅ With Fusion (automatic, unpacked)
const sum = Fusion(a, b, (av, bv) => av + bv)
// av and bv are unpacked automatically!
```

### Lazy Evaluation

Fusion uses lazy evaluation - computes only when `.value` is accessed:

```typescript
const heavy = Fusion(a, b, c, (av, bv, cv) => {
  console.log('Computing...')
  return expensiveCalculation(av, bv, cv)
})

a(10)  // No computation yet
b(20)  // No computation yet

console.log(heavy.value)  // → "Computing..." (computed now)
console.log(heavy.value)  // Uses cached result
```

### Chaining Fusions

Fusions can depend on other fusions:

```typescript
const firstName = Nucl('John')
const lastName = Nucl('Doe')

const fullName = Fusion(firstName, lastName, (f, l) => `${f} ${l}`)

const greeting = Fusion(fullName, (name) => `Hello, ${name}!`)

console.log(greeting.value)  // "Hello, John Doe!"

firstName('Alice')
console.log(greeting.value)  // "Hello, Alice Doe!" (cascaded update)
```

### Auto-cleanup on Decay

When any source is destroyed, the fusion automatically cleans up:

```typescript
const a = Nucl(1)
const b = Nucl(2)
const sum = Fusion(a, b, (av, bv) => av + bv)

a.decay()  // Destroy source

// sum automatically:
// - Unsubscribes from all sources
// - Becomes stale
// - Prevents memory leaks
```

---

## TypeScript Support

Full type inference from sources to result:

```typescript
const count = Nucl(5)         // Nucl<number>
const name = Nucl('John')     // Nucl<string>
const enabled = Nucl(true)    // Nucl<boolean>

// TypeScript infers result type automatically
const info = Fusion(count, name, enabled, (c, n, e) => {
  // c: number, n: string, e: boolean (inferred!)
  return { count: c, name: n, enabled: e }
})
// info: Nucl<{ count: number, name: string, enabled: boolean }>

info.value.count  // ✅ Typed correctly
```

---

## Comparison

### Fusion vs NeoFusion

| Feature | Fusion | NeoFusion |
|---------|--------|-----------|
| Syntax | `Fusion(a, b, fn)` | `NeoFusion(a, b).strategy(fn)` |
| Default strategy | `alive` | Explicit choice |
| Use case | 90% of cases | Advanced control |
| Extensibility | Fixed | Can add strategies |

### Fusion vs Utilities

| Feature | Fusion/NeoFusion | AliveFusion/AnyFusion |
|---------|------------------|----------------------|
| Returns | New `Nucl<R>` | Cleanup function `() => void` |
| Purpose | Computed values | Side-effects |
| Can chain | ✅ Yes | ❌ No |
| Lazy eval | ✅ Yes | ❌ No (runs immediately) |

---

## Performance Tips

### 1. Use alive when possible

`alive` strategy skips computation for falsy values:

```typescript
// Better: skips null/undefined
const profile = Fusion(user, settings, (u, s) => merge(u, s))

// Slower: computes even for null
const profile = NeoFusion(user, settings).any((u, s) => merge(u, s))
```

### 2. Batch source updates

Update multiple sources together to avoid multiple recomputations:

```typescript
const a = Nucl(1)
const b = Nucl(2)
const c = Nucl(3)

const sum = Fusion(a, b, c, (av, bv, cv) => av + bv + cv)

// ❌ Bad: 3 recomputations
a(10)
b(20)
c(30)

// ✅ Better: batch with silent
a.silent(10)
b.silent(20)
c(30)  // Only this triggers recomputation
```

### 3. Use dedup on sources

Avoid unnecessary recomputations with dedup:

```typescript
const count = Nucl(0).dedup(true)
const double = Fusion(count, (c) => c * 2)

count(0)  // No change → no recomputation
count(0)  // No change → no recomputation
count(5)  // Changed → recomputation
```

---

## Tree-Shaking

Import only what you need:

```typescript
// Minimal: only Fusion (~2KB)
import { Fusion } from '@alaq/nucl/fusion'

// Advanced: add NeoFusion (~+1KB)
import { Fusion, NeoFusion } from '@alaq/nucl/fusion'

// Utilities: add side-effect helpers (~+0.5KB)
import { AliveFusion, AnyFusion } from '@alaq/nucl/fusion'
```

Unused exports are automatically removed by bundlers.

---

## Examples

### User Profile

```typescript
const user = Nucl(null)
const avatar = Nucl(null)
const settings = Nucl(null)

// Compute profile only when all data is loaded
const profile = Fusion(user, avatar, settings, (u, a, s) => ({
  ...u,
  avatar: a,
  theme: s.theme
}))

user({ id: 1, name: 'John' })  // Not computed yet (avatar null)
avatar('/img.jpg')             // → Computed!
settings({ theme: 'dark' })    // → Recomputed
```

### Form Validation

```typescript
const email = Nucl('')
const password = Nucl('')
const terms = Nucl(false)

// Validate even when empty/false
const isValid = NeoFusion(email, password, terms).any((e, p, t) => {
  return e.includes('@') && p.length >= 6 && t === true
})

const canSubmit = NeoFusion(isValid, submitting).any((v, s) => {
  return v && !s
})
```

### Real-time Dashboard

```typescript
const metrics = Nucl(null)
const filters = Nucl({ range: '7d' })

// Update chart when data or filters change
const chartData = Fusion(metrics, filters, (m, f) => {
  return processMetrics(m, f.range)
})

// Side-effect: render chart
AliveFusion([chartData], (data) => {
  renderChart(data)
})
```

---

## See Also

- [Nucleus](./NUCLEUS.md) - Universal and type-specific plugins
- [Core API](../README.md) - Base Nucl functionality
- [Plugin System](./PLUGINS.md) - Extending Nucl
