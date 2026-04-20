# @alaq/plugin-logi

Observability plugin for Nucl/Atom that streams state mutations to a self-hosted Logi endpoint. **AI-first**: fingerprints, causal traces, and release+reload tracking built-in, so an AI agent can understand what happened in a running app via Logi's MCP tools.

**Status:** 0.1.0-alpha. Core works; integration with `@alaq/atom` action-wrapping requires a one-line hook in the atom factory.

## Quickstart

**Default dev endpoint.** If you omit `endpoint`/`token`, the plugin assumes a locally-running Logi from `A:/source/logi/docker-compose.yml` at `http://localhost:8080` with project token `demo_project_token`. To run one:

```bash
cd A:/source/logi && docker compose up -d
```

Then the plugin "just works" in dev — no boilerplate:

```typescript
import { logiPlugin } from '@alaq/plugin-logi'

logiPlugin()   // → localhost:8080, demo_project_token, release auto-tagged
```

```typescript
import { logiPlugin } from '@alaq/plugin-logi'
import { Atom } from '@alaq/atom'

// 1. Configure once on app bootstrap (production)
logiPlugin({
  endpoint: 'https://logi.mycompany.dev',
  token: 'project-xyz',
  version: '1.0.0',
  build: __ALAQ_BUILD__,    // injected by your bundler
  debugValues: import.meta.env.DEV,
})

// 2. Attach to atoms
class CounterStore {
  count = 0
  increment() { this.count++ }
}

const Counter = Atom.define(CounterStore, {
  realm: 'app',
  name: 'counter',
  plugins: [logiPlugin()],
})
```

## Concepts

See **[CONCEPT.md](./CONCEPT.md)** — explains fingerprints, traces, release/reload, and what the AI can do with the resulting data via `logi_*` MCP tools.

## Tests

```bash
cd A:/source/alak && bun test packages/plugin-logi
```

Includes an **integration test** (`test/integration.test.ts`) that sends real frames to `http://localhost:8080/ingest/v1/json`. Auto-skips if Logi is not reachable — run `docker compose up -d` in `A:/source/logi` first to enable it.

**Verified live:** frames sent through the plugin are retrievable by fingerprint via Logi's MCP (`logi_search_events`), and the full causal chain (`action:begin → change → action:end`) is reconstructible via `logi_get_trace`.
