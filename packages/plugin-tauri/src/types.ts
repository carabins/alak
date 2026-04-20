/**
 * Plugin contract types for @alaq/plugin-tauri.
 *
 * Two modes:
 *   - kind 'tauri'         — nucl represents a Rust-side state value. Read on
 *                            init via `invoke(read)`, optional push updates via
 *                            `listen(event)`, optional write via `invoke(write)`.
 *   - kind 'tauri-command' — nucl stores the last result of `invoke(command)`.
 *                            Caller drives updates via `.invoke(args)`.
 *
 * Both modes share optimistic-sync semantics and two companion nucls:
 *   nuc.$ready  — false until initial read settles (success or error).
 *   nuc.$saved  — false while an IPC call is in flight, true when idle.
 *   nuc.$error  — last error message (string) or null.
 */

import type { INucleonCore } from '@alaq/nucl/INucleon'

/**
 * Minimal Tauri IPC interface. Implementations:
 *   - prod: lazy-loaded wrapper around @tauri-apps/api/core + /event.
 *   - tests: `createFakeIPC({ invoke, events })`.
 */
export interface TauriIPC {
  invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T>
  listen<T = unknown>(
    event: string,
    handler: (payload: T) => void,
  ): Promise<() => void>
}

/** Per-plugin runtime config, set by `tauriPlugin(config)`. */
export interface TauriPluginConfig {
  /**
   * Inject an IPC. When omitted, the plugin tries to auto-detect Tauri v2
   * (presence of `window.__TAURI_INTERNALS__`) and lazy-loads the real
   * `@tauri-apps/api`. If neither is available, degradation mode kicks in.
   */
  ipc?: TauriIPC
}

/** Options extending INuOptions for `kind: 'tauri'` (state mode). */
export interface TauriStateConfig {
  /** Rust command invoked once on create to fetch initial value. Required. */
  read: string
  /** Rust command invoked on every TS-side write. Optional; omit for read-only. */
  write?: string
  /** Tauri event name — push updates from Rust → nucl. Optional. */
  listen?: string
}

/** Options extending INuOptions for `kind: 'tauri-command'` (command mode). */
export interface TauriCommandConfig {
  /** Rust command name invoked via `.invoke(args)`. Required. */
  command: string
}

/**
 * Union of nucl-options additions for tauri kinds. Either field is present
 * depending on the selected kind.
 */
export interface TauriOptions {
  /** Present for kind: 'tauri'. */
  tauri?: TauriStateConfig
  /** Present for kind: 'tauri-command'. */
  tauriCommand?: TauriCommandConfig
}

/**
 * Companion nucls attached to every tauri-kind nucl.
 */
export interface TauriCompanions<T = unknown> {
  $ready: INucleonCore
  $saved: INucleonCore
  $error: INucleonCore
}

/**
 * Methods attached to `kind: 'tauri-command'` nucls.
 */
export interface TauriCommandMethods<R = unknown, A = Record<string, unknown>> {
  /**
   * Invoke the configured Rust command with `args`. The returned promise
   * resolves to the command result. On success, the nucl's in-memory value
   * is set to the result and `$saved` flips back to true. On error, `$error`
   * is set and the promise rejects.
   */
  invoke(args?: A): Promise<R>
}
