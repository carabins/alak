/**
 * @alaq/plugin-tauri — Tauri v2 IPC bridge for Nucl.
 *
 * Two modes:
 *   - `kind: 'tauri'`         — nucl = Rust-side state (read/write/listen).
 *   - `kind: 'tauri-command'` — nucl = last result of `.invoke(args)`.
 *
 * Semantics: optimistic sync. `nuq(value)` is synchronous; a background
 * `invoke(write, { value })` carries it to Rust. Companions:
 *   - `nuc.$ready` — `false` until initial read settles.
 *   - `nuc.$saved` — `false` while an IPC call is in flight.
 *   - `nuc.$error` — last error message (string) or null.
 *
 * See CONCEPT.md for architecture and design notes.
 */

export { tauriPlugin, __resetTauriRuntime, __getTauriRuntime } from './plugin'
export { createFakeIPC } from './mock/fake-ipc'
export { hasTauri } from './ipc/detect'
export { createRealIPC, __resetRealIpcCache } from './ipc/real'

export type {
  TauriIPC,
  TauriPluginConfig,
  TauriOptions,
  TauriStateConfig,
  TauriCommandConfig,
  TauriCompanions,
  TauriCommandMethods,
} from './types'

export type { FakeIPCConfig, FakeIPCHandle } from './mock/fake-ipc'
