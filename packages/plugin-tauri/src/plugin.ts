/**
 * The Tauri nucl plugin.
 *
 * Flow per nucl:
 *
 *   kind: 'tauri' (state mode):
 *     onCreate:
 *       1. Attach `$ready`, `$saved`, `$error` companions.
 *       2. If IPC available:
 *            a. invoke(tauri.read) → set _value, $ready(true).
 *            b. listen(tauri.listen) if specified → forward payload to nucl.
 *          Else: $ready(true) + emit lifecycle frame `tauri:unavailable`.
 *     onBeforeChange (if tauri.write set):
 *       - Mark $saved(false), invoke(tauri.write, { value }) async.
 *       - On success: $saved(true). On error: $error(msg), keep $saved=false.
 *     onDecay:
 *       - Unsubscribe listener.
 *
 *   kind: 'tauri-command' (command mode):
 *     onCreate:
 *       1. Attach `$ready`, `$saved`, `$error` companions.
 *       2. $ready(true) immediately (no initial read).
 *       3. Attach `.invoke(args)` method.
 *     invoke(args):
 *       1. $saved(false)
 *       2. ipc.invoke(command, args)
 *       3. On success → value = result, $saved(true). On error → $error(msg), reject.
 *
 * Both modes degrade gracefully in a non-Tauri environment.
 */

import type { INucleonPlugin } from '@alaq/nucl/INucleonPlugin'
import type { INucleonCore } from '@alaq/nucl/INucleon'
import type { INuOptions } from '@alaq/nucl/options'
import { createNu } from '@alaq/nucl/createNu'
import type {
  TauriIPC, TauriPluginConfig, TauriOptions, TauriStateConfig, TauriCommandConfig,
} from './types'
import { hasTauri } from './ipc/detect'
import { createRealIPC } from './ipc/real'
import { logTauri } from './logi-bridge'

// -------------------------------------------------------------------------
// Runtime (module-global, matches plugin-logi / plugin-idb pattern).

interface RuntimeState {
  /** Resolved IPC — either user-provided, real, or null if degradation. */
  ipc: TauriIPC | null
}

let runtime: RuntimeState | null = null

function getRuntime(): RuntimeState {
  if (!runtime) runtime = defaultRuntime()
  return runtime
}

function defaultRuntime(): RuntimeState {
  // Auto-detect Tauri. If absent, null — plugin degrades gracefully.
  return { ipc: hasTauri() ? createRealIPC() : null }
}

export function tauriPlugin(config: TauriPluginConfig = {}): INucleonPlugin & {
  __setIpc(ipc: TauriIPC | null): void
} {
  const rt = getRuntime()
  if (config.ipc !== undefined) rt.ipc = config.ipc

  const plugin: INucleonPlugin & { __setIpc(ipc: TauriIPC | null): void } = {
    name: 'tauri',
    order: 20,

    onCreate(core: INucleonCore, options?: INuOptions) {
      initNucl(core, options)
    },

    onBeforeChange(core: INucleonCore, nextValue: unknown) {
      const st = coreState(core)
      if (!st || st.mode !== 'state') return
      if (st.skipNextOnBeforeChange) {
        st.skipNextOnBeforeChange = false
        return
      }
      // Only state mode with `write` configured sends to Rust.
      if (!st.config.write) return
      void writeState(core, st, nextValue)
    },

    onDecay(core: INucleonCore) {
      const st = coreState(core)
      if (!st) return
      if (st.mode === 'state' && st.unlisten) {
        try { st.unlisten() } catch { /* ignore */ }
        st.unlisten = null
      }
    },

    methods: {
      /** Command-mode method: invoke the configured Rust command. */
      invoke(this: any, args?: Record<string, unknown>): Promise<any> {
        const st = coreState(this)
        if (!st || st.mode !== 'command') {
          return Promise.reject(
            new TypeError('invoke() requires kind: tauri-command'),
          )
        }
        return invokeCommand(this, st, args)
      },
    },

    __setIpc(ipc: TauriIPC | null) {
      getRuntime().ipc = ipc
    },
  }

  return plugin
}

// -------------------------------------------------------------------------
// Per-nucl state (WeakMap — doesn't pollute the nucl object).

interface StateModeState {
  mode: 'state'
  realm: string
  id: string
  atomSegment: string
  propSegment: string
  config: TauriStateConfig
  $ready: any
  $saved: any
  $error: any
  unlisten: (() => void) | null
  /** Skip the implicit initial-value write after onCreate. */
  skipNextOnBeforeChange: boolean
}

interface CommandModeState {
  mode: 'command'
  realm: string
  id: string
  atomSegment: string
  propSegment: string
  config: TauriCommandConfig
  $ready: any
  $saved: any
  $error: any
  skipNextOnBeforeChange: boolean
}

type NuclState = StateModeState | CommandModeState

const stateByCore = new WeakMap<INucleonCore, NuclState>()

function coreState(core: INucleonCore): NuclState | undefined {
  return stateByCore.get(core)
}

// -------------------------------------------------------------------------
// onCreate handler.

function initNucl(core: INucleonCore, options?: INuOptions): void {
  const opts = options as (INuOptions & TauriOptions) | undefined
  const realm: string = (core as any).realm ?? opts?.realm ?? ''
  const id: string = (core as any).id ?? opts?.id ?? ''
  const kindStr: string = (options?.kind ?? '') as string
  const kinds = kindStr.split(/\s+/).filter(Boolean)

  const { atom, prop } = splitId(id)

  const stateCfg = opts?.tauri
  const commandCfg = opts?.tauriCommand

  const isCommandMode = !!commandCfg ||
    (kinds.includes('tauri-command') && !stateCfg)
  const isStateMode = !!stateCfg ||
    (kinds.includes('tauri') && !commandCfg)

  // If neither config is supplied, do nothing — the user included the plugin
  // but didn't configure this nucl. Be permissive; let the nucl behave as a
  // plain reactive value.
  if (!isStateMode && !isCommandMode) return

  const $ready = createNu<boolean>({ value: false, id: `${id}.$ready`, realm })
  const $saved = createNu<boolean>({ value: true, id: `${id}.$saved`, realm })
  const $error = createNu<string | null>({ value: null, id: `${id}.$error`, realm })
  try { (core as any).$ready = $ready } catch { /* ignore */ }
  try { (core as any).$saved = $saved } catch { /* ignore */ }
  try { (core as any).$error = $error } catch { /* ignore */ }

  if (isCommandMode) {
    const cfg = commandCfg ?? { command: '' }
    const st: CommandModeState = {
      mode: 'command',
      realm, id,
      atomSegment: atom, propSegment: prop,
      config: cfg,
      $ready, $saved, $error,
      skipNextOnBeforeChange: options?.value !== undefined,
    }
    stateByCore.set(core, st)

    const rt = getRuntime()
    if (!rt.ipc) {
      logTauri({
        realm, atom, prop,
        kind: 'lifecycle', message: 'tauri:unavailable',
      })
    } else {
      logTauri({
        realm, atom, prop,
        kind: 'lifecycle', message: 'tauri:open',
      })
    }
    // Command mode is always "ready" — there's no initial fetch to wait on.
    $ready(true)
  } else {
    // state mode
    const cfg = stateCfg!
    const st: StateModeState = {
      mode: 'state',
      realm, id,
      atomSegment: atom, propSegment: prop,
      config: cfg,
      $ready, $saved, $error,
      unlisten: null,
      skipNextOnBeforeChange: options?.value !== undefined,
    }
    stateByCore.set(core, st)

    const rt = getRuntime()
    if (!rt.ipc) {
      logTauri({
        realm, atom, prop,
        kind: 'lifecycle', message: 'tauri:unavailable',
      })
      // Graceful: ready immediately, default value stays.
      $ready(true)
      return
    }

    logTauri({
      realm, atom, prop,
      kind: 'lifecycle', message: 'tauri:open',
    })
    void readInitial(core, st, rt.ipc)
    if (cfg.listen) {
      void attachListener(core, st, rt.ipc)
    }
  }
}

// -------------------------------------------------------------------------
// State mode: initial read.

async function readInitial(
  core: INucleonCore,
  st: StateModeState,
  ipc: TauriIPC,
): Promise<void> {
  const began = Date.now()
  logTauri({
    realm: st.realm, atom: st.atomSegment, prop: st.propSegment,
    kind: 'lifecycle', message: 'tauri:invoke:begin',
    extra: { command: st.config.read },
  })
  try {
    const value = await ipc.invoke(st.config.read)
    directAssign(core, value)
    logTauri({
      realm: st.realm, atom: st.atomSegment, prop: st.propSegment,
      kind: 'lifecycle', message: 'tauri:invoke:end',
      duration_ms: Date.now() - began,
      extra: { command: st.config.read },
    })
  } catch (e) {
    const msg = describeError(e)
    st.$error(msg)
    logTauri({
      realm: st.realm, atom: st.atomSegment, prop: st.propSegment,
      kind: 'error', message: 'tauri:invoke:error',
      extra: {
        command: st.config.read,
        error_type: 'tauri:invoke',
        error: msg,
      },
    })
  } finally {
    st.$ready(true)
  }
}

// -------------------------------------------------------------------------
// State mode: listen push updates from Rust.

async function attachListener(
  core: INucleonCore,
  st: StateModeState,
  ipc: TauriIPC,
): Promise<void> {
  const ev = st.config.listen!
  try {
    const un = await ipc.listen(ev, (payload) => {
      // Received push update — write into nucl without feeding back to Rust.
      directAssign(core, payload)
      logTauri({
        realm: st.realm, atom: st.atomSegment, prop: st.propSegment,
        kind: 'lifecycle', message: 'tauri:listen:recv',
        extra: { event: ev },
      })
    })
    st.unlisten = un
    logTauri({
      realm: st.realm, atom: st.atomSegment, prop: st.propSegment,
      kind: 'lifecycle', message: 'tauri:listen:attach',
      extra: { event: ev },
    })
  } catch (e) {
    const msg = describeError(e)
    logTauri({
      realm: st.realm, atom: st.atomSegment, prop: st.propSegment,
      kind: 'error', message: 'tauri:listen:error',
      extra: {
        event: ev,
        error_type: 'tauri:listen',
        error: msg,
      },
    })
  }
}

// -------------------------------------------------------------------------
// State mode: write.

async function writeState(
  core: INucleonCore,
  st: StateModeState,
  value: unknown,
): Promise<void> {
  const rt = getRuntime()
  if (!rt.ipc) {
    // No IPC — in-memory only. Leave $saved alone.
    return
  }
  const cmd = st.config.write!
  st.$saved(false)
  st.$error(null)
  const began = Date.now()
  logTauri({
    realm: st.realm, atom: st.atomSegment, prop: st.propSegment,
    kind: 'lifecycle', message: 'tauri:invoke:begin',
    extra: { command: cmd },
  })
  try {
    await rt.ipc.invoke(cmd, { value })
    logTauri({
      realm: st.realm, atom: st.atomSegment, prop: st.propSegment,
      kind: 'lifecycle', message: 'tauri:invoke:end',
      duration_ms: Date.now() - began,
      extra: { command: cmd },
    })
    st.$saved(true)
  } catch (e) {
    const msg = describeError(e)
    st.$error(msg)
    logTauri({
      realm: st.realm, atom: st.atomSegment, prop: st.propSegment,
      kind: 'error', message: 'tauri:invoke:error',
      extra: {
        command: cmd,
        error_type: 'tauri:invoke',
        error: msg,
      },
    })
    // Leave $saved false — caller observes the failure via $error.
  }
}

// -------------------------------------------------------------------------
// Command mode: invoke.

async function invokeCommand(
  core: INucleonCore,
  st: CommandModeState,
  args?: Record<string, unknown>,
): Promise<any> {
  const rt = getRuntime()
  const cmd = st.config.command
  if (!rt.ipc) {
    const msg = 'tauri unavailable'
    st.$error(msg)
    throw new Error(msg)
  }
  st.$saved(false)
  st.$error(null)
  const began = Date.now()
  logTauri({
    realm: st.realm, atom: st.atomSegment, prop: st.propSegment,
    kind: 'lifecycle', message: 'tauri:invoke:begin',
    extra: { command: cmd },
  })
  try {
    const result = await rt.ipc.invoke(cmd, args)
    directAssign(core, result)
    logTauri({
      realm: st.realm, atom: st.atomSegment, prop: st.propSegment,
      kind: 'lifecycle', message: 'tauri:invoke:end',
      duration_ms: Date.now() - began,
      extra: { command: cmd },
    })
    st.$saved(true)
    return result
  } catch (e) {
    const msg = describeError(e)
    st.$error(msg)
    logTauri({
      realm: st.realm, atom: st.atomSegment, prop: st.propSegment,
      kind: 'error', message: 'tauri:invoke:error',
      extra: {
        command: cmd,
        error_type: 'tauri:invoke',
        error: msg,
      },
    })
    throw e
  }
}

// -------------------------------------------------------------------------
// Helpers.

/**
 * Write a value to the nucl's internal state without triggering our
 * onBeforeChange. Same technique as plugin-idb — we're applying a value
 * that came from Rust, not a user mutation, so we must NOT loop it back.
 */
function directAssign(core: INucleonCore, value: any): void {
  const q = core as any
  q._value = value
  if (q._flags !== undefined) q._flags &= ~1
  if (q._edges) {
    for (let i = 0; i < q._edges.length; i++) {
      try { q._edges[i](value, core) } catch { /* ignore */ }
    }
  }
}

function splitId(id: string | undefined): { atom: string; prop: string } {
  if (!id) return { atom: '', prop: '' }
  const dot = id.indexOf('.')
  if (dot < 0) return { atom: '', prop: id }
  return { atom: id.slice(0, dot), prop: id.slice(dot + 1) }
}

function describeError(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`
  try { return String(e) } catch { return 'unknown error' }
}

// -------------------------------------------------------------------------
// Test utilities.

export function __resetTauriRuntime(): void {
  runtime = null
}

export function __getTauriRuntime(): RuntimeState | null {
  return runtime
}
