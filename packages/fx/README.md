# @alaq/fx

> **Zero-dependency**, framework-agnostic reactive effects system for managing side effects, async flows, and timing.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**fx** provides a fluent, chainable API to transform data streams into actions. It is designed to work seamlessly with `@alaq/quark`, `@alaq/nucl`, or any object implementing the `Subscribable` interface.

[🇷🇺 Читать на русском](./README.ru.md)

## Features

- 🎯 **Agnostic**: Works with any state manager (Quark, Nucleon, Atom, or custom).
- ⛓️ **Fluent API**: Chainable operators (`map`, `filter`, `debounce`, `async`).
- ⏱️ **Timing Control**: Built-in `debounce` and `delay` with automatic cleanup.
- ⚡ **Async Handling**: First-class support for `AbortSignal` and race condition handling (switch map behavior).
- 🪶 **Tiny**: Zero runtime dependencies.

## Installation

```bash
npm install @alaq/fx
# or
bun add @alaq/fx
```

## Quick Start

```typescript
import { fx } from '@alaq/fx';
import { Qv } from '@alaq/quark'; // or any subscribable

const searchQuery = Qv('');

fx(searchQuery)
  .map(q => q.trim())           // 1. Transform
  .filter(q => q.length >= 3)   // 2. Gate
  .debounce(300)                // 3. Wait for silence
  .async(async (q, signal) => { // 4. Async with AbortSignal
     const res = await fetch(`/api/search?q=${q}`, { signal });
     return res.json();
  })
  .up(results => {              // 5. Subscribe & Act
    console.log('Results:', results);
  });
```

## Philosophy

Reactive primitives (like Atoms or Signals) hold **State**.
**fx** manages the **Flow** and **Side Effects** resulting from state changes.

Instead of imperative `subscribe` callbacks filled with `clearTimeout` and race condition checks, `fx` lets you declare *what* should happen and *when*.

## Documentation

- [Full API Reference](./docs/en/API.md)

## License

MIT
