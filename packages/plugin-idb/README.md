# @alaq/plugin-idb

Persistent state in IndexedDB for Nucl. Optimistic sync, debounced writes, first-class `$ready`/`$saved` companions, and transparent integration with `@alaq/plugin-logi` for AI-observable persistence.

**Status:** 0.1.0-alpha. Works in browsers; Node/Bun tests use the bundled in-memory fake.

## Quickstart

### Single-value store

```typescript
import '@alaq/plugin-idb/presets/idb'
import { Nu } from '@alaq/nucl'

const settings = Nu({
  kind: 'idb',
  value: { theme: 'dark' },
  realm: 'app',
  id: 'user.settings',
})

settings.$ready.up(r => r && console.log('loaded from IDB'))
settings.$saved.up(s => s && console.log('committed to IDB'))

settings({ theme: 'light' })   // sync update; flushed after debounce
```

### Collection

```typescript
import '@alaq/plugin-idb/presets/idb-collection'
import { Nu } from '@alaq/nucl'

interface Todo { id: string; title: string; done: boolean }

const todos = Nu<Todo[]>({
  kind: 'idb-collection',
  value: [],
  realm: 'app',
  id: 'app.todos',
  collection: { primaryKey: 'id', indexes: ['done'] },
})

todos.insert({ id: '1', title: 'buy milk', done: false })
todos.update('1', { done: true })
todos.remove('1')
todos.query({ where: 'done', equals: false })
```

## Concepts

See **[CONCEPT.md](./CONCEPT.md)** — explains the optimistic-sync model, `$ready`/`$saved`, DB layout, and why we don't do migrations.

## Logi integration

If `@alaq/plugin-logi` is configured, every IDB operation emits a `LogiFrame` (`idb:open`, `idb:get:hit`, `idb:get:miss`, `idb:put:begin`, `idb:put:end`, and errors as `idb:put:error` with `error_type`). No code change required — `emitFrame()` is a noop if logi isn't wired, and a real frame dispatch if it is. That means an AI wielding Logi MCP tools can see persistence timing and fingerprints directly.

## Tests

```bash
cd A:/source/alak && bun test packages/plugin-idb
```

Tests run under Bun using a minimal in-memory `fake-idb` emulation. No real browser required.
