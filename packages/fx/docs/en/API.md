# API Reference

## Core

### `fx(source)`

Creates a new effect chain from a subscribable source.

**Arguments:**
- `source`: An object implementing the `Subscribable<T>` interface.

**Returns:**
- `Fx<T>` builder instance.

**Example:**
```typescript
import { fx } from '@alaq/fx';
fx(myAtom).up(val => console.log(val));
```

### `.up(handler)`

Subscribes to the effect chain and activates it. This is the terminal operation.

**Arguments:**
- `handler`: `(value: T) => void` - The function to execute when the effect triggers.

**Returns:**
- `Unsubscribe`: A function to stop the effect and clean up resources (timers, listeners).

**Example:**
```typescript
const stop = fx(count).up(c => console.log(c));
// Later
stop();
```

---

## Transformations

### `.map(fn)`

Transforms the value passing through the chain.

**Arguments:**
- `fn`: `(value: T) => R` - Projection function.

**Returns:**
- `Fx<R>`

**Example:**
```typescript
fx(user).map(u => u.name).up(updateHeader);
```

### `.with(otherSource)`

Samples the current value of another source without subscribing to its changes.
Useful for attaching additional context (payload) to an event.

**Arguments:**
- `otherSource`: `Subscribable<S>`

**Returns:**
- `Fx<[T, S]>` - Tuple of [originalValue, otherValue]

**Example:**
```typescript
fx(submitClick)
  .with(formData)
  .up(([_, data]) => submitForm(data));
```

---

## Filters (Gates)

### `.filter(predicate)` / `.when(predicate)`

Stops propagation if the predicate returns `false`.

**Arguments:**
- `predicate`: `(value: T) => boolean`

**Returns:**
- `Fx<T>`

**Example:**
```typescript
fx(age).when(a => a >= 18).up(grantAccess);
```

### `.skip(n)`

Skips the first `n` emissions.

**Example:**
```typescript
fx(source).skip(1).up(fn); // Ignore initial value
```

### `.take(n)`

Takes only the first `n` emissions and then stops (effectively unsubscribing).

**Example:**
```typescript
fx(source).take(1).up(fn); // Behaves like .once()
```

---

## Timing

### `.debounce(ms)`

Delays the emission until the source has been silent for `ms` milliseconds.
Useful for handling rapid user input (typing, window resize).

**Arguments:**
- `ms`: `number` - milliseconds to wait.

**Example:**
```typescript
fx(input).debounce(300).up(saveToDb);
```

### `.delay(ms)`

Shifts the emission by `ms` milliseconds.
If the source emits a new value while waiting, the previous pending emission is cancelled.
Useful for preventing UI flickering (e.g., showing a loader only if a request takes too long).

**Arguments:**
- `ms`: `number`

**Example:**
```typescript
fx(loading).when(v => v).delay(500).up(showSpinner);
```

---

## Async

### `.async(handler)`

Executes an asynchronous operation.
Handles **concurrency** automatically: if a new value arrives while the previous async operation is pending, the previous one is **aborted** (Switch Map behavior).

**Arguments:**
- `handler`: `(value: T, signal: AbortSignal) => Promise<R>`

**Returns:**
- `Fx<R>` - The stream continues with the result of the promise.

**Example:**
```typescript
fx(userId)
  .async(async (id, signal) => {
    // signal.aborted will be true if userId changes again
    const response = await fetch(`/users/${id}`, { signal });
    return response.json();
  })
  .up(userData => renderProfile(userData));
```

## Interface `Subscribable<T>`

To make any object compatible with `fx`, it must implement:

```typescript
interface Subscribable<T> {
  up(listener: (val: T) => void): any;   // Subscribe
  down(listener: (val: T) => void): void; // Unsubscribe
  value: T;                               // Current value access
}
```
