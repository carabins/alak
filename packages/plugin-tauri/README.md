# @alaq/plugin-tauri

Tauri v2 IPC bridge for Nucl. Nucl atoms backed by Rust-side state (`invoke` / `listen`) with `$ready`/`$saved`/`$error` companions, and transparent integration with `@alaq/plugin-logi` for AI-observable IPC.

**Status:** 6.0.0-alpha. Works in Tauri v2 apps; Bun/Node tests use the bundled fake IPC.

## Quickstart

### State mode — nucl = Rust-side state

```typescript
import '@alaq/plugin-tauri/presets/tauri'
import { Nu } from '@alaq/nucl'

const deviceId = Nu({
  kind: 'tauri',
  value: null,
  realm: 'app',
  id: 'sys.deviceId',
  tauri: {
    read:   'get_device_id',     // Rust command — fetch initial value
    write:  'set_device_id',     // optional — omit for read-only
    listen: 'device:changed',    // optional — Tauri event for push updates
  },
})

deviceId.$ready.up(r => r && console.log('loaded:', deviceId.value))
deviceId('new-id')   // sync update; write invoked in background
```

### Command mode — nucl = result of a parameterised call

```typescript
import '@alaq/plugin-tauri/presets/tauri-command'
import { Nu } from '@alaq/nucl'

const calcDistance = Nu({
  kind: 'tauri-command',
  value: null,
  realm: 'geo',
  id: 'calc.distance',
  tauriCommand: { command: 'calc_distance' },
})

await calcDistance.invoke({ lat1, lon1, lat2, lon2 })
// calcDistance.value holds the result.
```

## Companions

Every tauri-kind nucl gets three companions:

- `nuc.$ready` — `false` until the initial read settles. In command mode, `true` immediately.
- `nuc.$saved` — `false` while an IPC call is in flight, `true` once idle.
- `nuc.$error` — last error message (string) or `null`.

## Graceful degradation

If the plugin can't detect Tauri v2 (no `window.__TAURI_INTERNALS__`) and no explicit `ipc` is injected, it degrades:

- State-mode nucls keep their default value and flip `$ready(true)` immediately.
- Command-mode `invoke()` rejects with `"tauri unavailable"` and sets `$error`.
- In both cases a single `tauri:unavailable` lifecycle frame is emitted for observability.

This is the normal state in SSR, unit tests, and plain-browser builds — no crash, no blocking.

## Logi integration

If `@alaq/plugin-logi` is configured, every IPC operation emits a `LogiFrame`:

| Event | kind | message | extras |
|---|---|---|---|
| Create (state / cmd) | `lifecycle` | `tauri:open` | — |
| Create (no tauri) | `lifecycle` | `tauri:unavailable` | — |
| Invoke start | `lifecycle` | `tauri:invoke:begin` | `command` |
| Invoke success | `lifecycle` | `tauri:invoke:end` | `command`, `duration_ms` |
| Invoke error | `error` | `tauri:invoke:error` | `command`, `error_type`, `error` |
| Listen attached | `lifecycle` | `tauri:listen:attach` | `event` |
| Listen received | `lifecycle` | `tauri:listen:recv` | `event` |
| Listen error | `error` | `tauri:listen:error` | `event`, `error_type`, `error` |

No code change required — `emitFrame()` is a no-op if logi isn't wired, and a real frame dispatch if it is. Fingerprint format: `${realm}.${atom}.${prop}`, same as other alaq plugins.

## Tests

```bash
bun test packages/plugin-tauri
```

Uses `createFakeIPC({ invoke, events })` as the IPC stand-in. Injected via `tauriPlugin({ ipc: fake })`.
