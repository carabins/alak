/**
 * In-memory Tauri IPC fake for tests.
 *
 * Configuration:
 *   - `invoke`: map from command name → handler `(args) => result | Promise<result>`.
 *               Unknown commands reject with `Error('no handler: <cmd>')`.
 *   - `events`: map from event name → setup fn that receives an `emit(payload)`
 *               callback and returns an unlisten fn (or void). Setup runs once
 *               per `listen()` call, so the same event can have many independent
 *               subscribers.
 *
 * Handlers fire on a microtask so semantics approximate real Tauri (awaited
 * promises, not sync returns).
 */

import type { TauriIPC } from '../types'

export interface FakeIPCConfig {
  invoke?: Record<string, (args?: Record<string, unknown>) => unknown | Promise<unknown>>
  events?: Record<string, (emit: (payload: unknown) => void) => (() => void) | void>
}

export interface FakeIPCHandle extends TauriIPC {
  /** Emit a Tauri event programmatically. Fires all listeners attached to `name`. */
  emit(name: string, payload: unknown): void
  /** Number of active listeners for an event. */
  listenerCount(name: string): number
  /** Reset internal listener registry. Handlers (invoke, events) preserved. */
  reset(): void
}

export function createFakeIPC(config: FakeIPCConfig = {}): FakeIPCHandle {
  const invokeHandlers = { ...(config.invoke ?? {}) }
  const eventFactories = { ...(config.events ?? {}) }
  /** name -> set of per-listener handler fns (registered via listen). */
  const listeners: Map<string, Set<(payload: unknown) => void>> = new Map()

  function emit(name: string, payload: unknown): void {
    const set = listeners.get(name)
    if (!set) return
    for (const h of set) {
      try { h(payload) } catch { /* ignore */ }
    }
  }

  const ipc: FakeIPCHandle = {
    async invoke(cmd: string, args?: Record<string, unknown>): Promise<any> {
      const h = invokeHandlers[cmd]
      if (!h) {
        throw new Error(`no handler: ${cmd}`)
      }
      // Yield to microtask so caller observes async-ness.
      await Promise.resolve()
      return await h(args)
    },
    async listen(name: string, handler: (payload: any) => void): Promise<() => void> {
      let set = listeners.get(name)
      if (!set) { set = new Set(); listeners.set(name, set) }
      set.add(handler)
      // If a factory is configured for this event, run it so the test can
      // drive `emit` callbacks on demand. We ignore the factory's returned
      // unlisten in favour of our own — caller will get a single unlisten
      // that removes `handler` from our set.
      const factory = eventFactories[name]
      if (factory) {
        try {
          factory((payload: unknown) => emit(name, payload))
        } catch { /* ignore */ }
      }
      return () => {
        set!.delete(handler)
      }
    },
    emit,
    listenerCount(name: string): number {
      return listeners.get(name)?.size ?? 0
    },
    reset(): void {
      listeners.clear()
    },
  }
  return ipc
}
