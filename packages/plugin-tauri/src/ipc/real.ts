/**
 * Real Tauri IPC — thin wrapper over `@tauri-apps/api/core` + `@tauri-apps/api/event`.
 *
 * The imports are resolved lazily via dynamic `import()` so that:
 *   - non-Tauri builds don't eagerly pull the module into their bundle;
 *   - test environments (Bun) can skip the package entirely;
 *   - graceful degradation is possible: if the module is missing, `invoke`
 *     and `listen` reject with a synthetic error instead of throwing at
 *     plugin-load time.
 *
 * The first `invoke` / `listen` call triggers the import; the promise is
 * cached so subsequent calls reuse the loaded module.
 */

import type { TauriIPC } from '../types'

let modPromise: Promise<{
  invoke: (cmd: string, args?: Record<string, unknown>) => Promise<any>
  listen: (event: string, handler: (e: { payload: any }) => void) => Promise<() => void>
}> | null = null

async function loadMod(): Promise<{
  invoke: (cmd: string, args?: Record<string, unknown>) => Promise<any>
  listen: (event: string, handler: (e: { payload: any }) => void) => Promise<() => void>
}> {
  if (!modPromise) {
    modPromise = (async () => {
      const core: any = await import('@tauri-apps/api/core')
      const ev: any = await import('@tauri-apps/api/event')
      return {
        invoke: core.invoke,
        listen: ev.listen,
      }
    })()
  }
  return modPromise
}

export function createRealIPC(): TauriIPC {
  return {
    async invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T> {
      const mod = await loadMod()
      return mod.invoke(cmd, args) as Promise<T>
    },
    async listen<T = unknown>(
      event: string,
      handler: (payload: T) => void,
    ): Promise<() => void> {
      const mod = await loadMod()
      // @tauri-apps/api passes Event { payload, id, event } — we flatten to payload.
      return mod.listen(event, (e) => handler(e?.payload as T))
    },
  }
}

export function __resetRealIpcCache(): void {
  modPromise = null
}
