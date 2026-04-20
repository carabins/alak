/**
 * Browser-side test harness for @alaq/plugin-idb.
 *
 * Bundled by build.ts into bundle.js, loaded by harness.html, driven from
 * playwright smoke tests via `page.evaluate` calling `window.__harness.*`.
 *
 * Deliberately uses the REAL browser IndexedDB — the whole point is to
 * find discrepancies against the in-memory fake-idb used in bun tests.
 */

import { createNu } from '@alaq/nucl/createNu'
import { idbPlugin, __resetIdbRuntime } from '../src/plugin'

interface HarnessState {
  atoms: Record<string, any>
  lastError: { id: string; message: string; name: string } | null
}

const state: HarnessState = {
  atoms: {},
  lastError: null,
}

// Capture unhandled rejections (DataCloneError etc. can surface here).
window.addEventListener('unhandledrejection', (ev) => {
  const err = ev.reason as any
  state.lastError = {
    id: '<unhandledrejection>',
    name: err?.name ?? 'UnknownError',
    message: err?.message ?? String(err),
  }
  // Prevent default to avoid noisy console errors in Playwright
  ev.preventDefault()
})

window.addEventListener('error', (ev) => {
  state.lastError = {
    id: '<error>',
    name: ev.error?.name ?? 'Error',
    message: ev.message ?? String(ev),
  }
})

;(window as any).__harness = {
  /** For debugging — so the test can see our harness is alive. */
  ping() {
    return 'pong'
  },

  createKv(id: string, defaultValue: any, realm = 'app', debounceMs = 20) {
    // Each call re-arms the plugin with fresh config. (Plugin runtime is
    // module-global and last call wins — same pattern as bun tests.)
    const plugin = idbPlugin({ debounceMs })
    const nuq: any = createNu({
      realm,
      id,
      value: defaultValue,
      plugins: [plugin],
    })
    state.atoms[id] = nuq
    return { id, created: true }
  },

  createCollection(
    id: string,
    primaryKey = 'id',
    indexes: string[] = [],
    realm = 'app',
    debounceMs = 20,
  ) {
    const plugin = idbPlugin({ debounceMs })
    const nuq: any = createNu({
      realm,
      id,
      value: [],
      collection: { primaryKey, indexes },
      plugins: [plugin],
    } as any)
    state.atoms[id] = nuq
    return { id, created: true }
  },

  get(id: string) {
    return state.atoms[id]?._value
  },

  set(id: string, value: any) {
    const a = state.atoms[id]
    if (!a) throw new Error(`no atom ${id}`)
    a(value)
  },

  ready(id: string): boolean {
    return !!state.atoms[id]?.$ready?.value
  },

  saved(id: string): boolean {
    return !!state.atoms[id]?.$saved?.value
  },

  insert(id: string, record: any) {
    state.atoms[id].insert(record)
  },
  update(id: string, key: any, patch: any) {
    state.atoms[id].update(key, patch)
  },
  remove(id: string, key: any) {
    state.atoms[id].remove(key)
  },
  query(id: string, q?: any) {
    return state.atoms[id].query(q)
  },

  /** Poll until the condition is true — returns true on success, false on timeout. */
  async waitFor(id: string, prop: 'ready' | 'saved', want: boolean, timeoutMs = 2000): Promise<boolean> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      const a = state.atoms[id]
      const v = prop === 'ready' ? a?.$ready?.value : a?.$saved?.value
      if (!!v === want) return true
      await new Promise((r) => setTimeout(r, 10))
    }
    return false
  },

  async sleep(ms: number) {
    await new Promise((r) => setTimeout(r, ms))
  },

  getLastError() {
    return state.lastError
  },

  clearLastError() {
    state.lastError = null
  },

  /** Reset in-memory runtime but leave IDB data on disk (reload simulation within same page). */
  resetRuntime() {
    __resetIdbRuntime()
    state.atoms = {}
  },

  /** Delete the actual IndexedDB database — for beforeEach isolation. */
  async clearIdb(realm = 'app'): Promise<void> {
    __resetIdbRuntime()
    state.atoms = {}
    const dbName = `alaq:${realm || '_default'}`
    await new Promise<void>((ok, fail) => {
      const req = indexedDB.deleteDatabase(dbName)
      req.onsuccess = () => ok()
      req.onerror = () => fail(req.error)
      req.onblocked = () => {
        // In Chromium, onblocked fires if another connection keeps the DB
        // open. We close via __resetIdbRuntime above, so this is unusual.
        fail(new Error('deleteDatabase blocked'))
      }
    })
  },

  /** List IDB databases (Chromium-only API). */
  async listDbs(): Promise<Array<{ name: string; version: number }>> {
    const anyIdb = indexedDB as any
    if (typeof anyIdb.databases !== 'function') return []
    const list = await anyIdb.databases()
    return list.map((d: any) => ({ name: d.name, version: d.version }))
  },

  /**
   * Low-level direct IDB read — bypasses the plugin entirely.
   * Useful to verify actual bytes on disk after a write.
   */
  async rawKvGet(key: string, realm = 'app'): Promise<any> {
    const dbName = `alaq:${realm || '_default'}`
    const db: IDBDatabase = await new Promise((ok, fail) => {
      const req = indexedDB.open(dbName)
      req.onsuccess = () => ok(req.result)
      req.onerror = () => fail(req.error)
    })
    try {
      const tx = db.transaction('__kv__', 'readonly')
      const store = tx.objectStore('__kv__')
      const val = await new Promise((ok, fail) => {
        const r = store.get(key)
        r.onsuccess = () => ok(r.result)
        r.onerror = () => fail(r.error)
      })
      return { hit: val !== undefined, value: val }
    } finally {
      db.close()
    }
  },
}

// Mark harness as ready so Playwright knows the bundle loaded.
;(window as any).__harnessReady = true
