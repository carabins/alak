/**
 * Minimal in-memory IndexedDB emulation for Bun tests.
 *
 * Covers only what this plugin uses:
 *   - open(name, version) → onupgradeneeded (once, on version bump)
 *     + onsuccess with db proxy
 *   - db.createObjectStore(name, { keyPath })
 *   - db.transaction(stores, mode) → .objectStore(name)
 *   - store.put/get/getAll/delete/clear
 *   - store.createIndex / store.index(name).getAll
 *   - db.close()
 *
 * Async semantics emulated via queueMicrotask — good enough for test timing;
 * request callbacks fire after the current stack clears, like real IDB.
 *
 * Everything is synchronous in storage terms; real IDB's ACID semantics are
 * not reproduced. For the plugin's testing purposes that is fine.
 */

import type {
  IDBFactoryLike, IDBOpenDBRequestLike, IDBDatabaseLike, IDBTransactionLike,
  IDBObjectStoreLike, IDBRequestLike, IDBIndexLike,
} from '../types'

interface StoreData {
  records: Map<any, any>
  keyPath?: string
  indexNames: string[]
  indexes: Map<string, string> // index name -> keyPath
}

interface DbData {
  name: string
  version: number
  stores: Map<string, StoreData>
}

// DB registry (persists across open/close in the same process, like real IDB).
const dbs: Map<string, DbData> = new Map()

function mkReq<T>(): IDBRequestLike {
  const r: any = { onsuccess: null, onerror: null, result: undefined, error: null }
  return r as IDBRequestLike
}

function settle(req: IDBRequestLike, value?: any, err?: Error) {
  queueMicrotask(() => {
    if (err) {
      ;(req as any).error = err
      if (req.onerror) req.onerror({ target: req })
    } else {
      ;(req as any).result = value
      if (req.onsuccess) req.onsuccess({ target: req })
    }
  })
}

function wrapStringList(items: string[]): any {
  const out = {
    contains(n: string) { return items.includes(n) },
    get length() { return items.length },
    item(i: number) { return items[i] ?? null },
  }
  return out
}

function wrapIndex(store: StoreData, name: string): IDBIndexLike {
  return {
    getAll(query?: any): IDBRequestLike {
      const req = mkReq()
      const keyPath = store.indexes.get(name)
      if (!keyPath) {
        settle(req, undefined, new Error(`index not found: ${name}`))
        return req
      }
      const results: any[] = []
      for (const rec of store.records.values()) {
        if (query === undefined || rec?.[keyPath] === query) results.push(rec)
      }
      settle(req, results)
      return req
    },
  }
}

function wrapStore(store: StoreData, mode: 'readonly' | 'readwrite'): IDBObjectStoreLike {
  const guardWrite = () => {
    if (mode !== 'readwrite') throw new Error('store is readonly')
  }
  return {
    get indexNames() { return wrapStringList(store.indexNames) },
    put(value: any, key?: any): IDBRequestLike {
      const req = mkReq()
      try {
        guardWrite()
        let k = key
        if (k === undefined && store.keyPath) k = value?.[store.keyPath]
        if (k === undefined) {
          settle(req, undefined, new Error('no key for put'))
          return req
        }
        store.records.set(k, value)
        settle(req, k)
      } catch (e: any) {
        settle(req, undefined, e instanceof Error ? e : new Error(String(e)))
      }
      return req
    },
    get(key: any): IDBRequestLike {
      const req = mkReq()
      settle(req, store.records.get(key))
      return req
    },
    getAll(): IDBRequestLike {
      const req = mkReq()
      settle(req, Array.from(store.records.values()))
      return req
    },
    delete(key: any): IDBRequestLike {
      const req = mkReq()
      try {
        guardWrite()
        store.records.delete(key)
        settle(req, undefined)
      } catch (e: any) {
        settle(req, undefined, e)
      }
      return req
    },
    clear(): IDBRequestLike {
      const req = mkReq()
      try {
        guardWrite()
        store.records.clear()
        settle(req, undefined)
      } catch (e: any) {
        settle(req, undefined, e)
      }
      return req
    },
    createIndex(name: string, keyPath: string | string[]): IDBIndexLike {
      const kp = Array.isArray(keyPath) ? keyPath[0] : keyPath
      if (!store.indexNames.includes(name)) store.indexNames.push(name)
      store.indexes.set(name, kp)
      return wrapIndex(store, name)
    },
    index(name: string): IDBIndexLike {
      return wrapIndex(store, name)
    },
  }
}

function wrapDb(db: DbData): IDBDatabaseLike {
  let closed = false
  const storeNames: string[] = Array.from(db.stores.keys())
  const ref: IDBDatabaseLike = {
    get name() { return db.name },
    get version() { return db.version },
    get objectStoreNames() { return wrapStringList(Array.from(db.stores.keys())) },
    createObjectStore(name: string, options?: { keyPath?: string | string[]; autoIncrement?: boolean }): IDBObjectStoreLike {
      if (closed) throw new Error('db closed')
      if (db.stores.has(name)) throw new Error(`store exists: ${name}`)
      const keyPath = options?.keyPath
        ? (Array.isArray(options.keyPath) ? options.keyPath[0] : options.keyPath)
        : undefined
      const s: StoreData = { records: new Map(), keyPath, indexNames: [], indexes: new Map() }
      db.stores.set(name, s)
      storeNames.push(name)
      return wrapStore(s, 'readwrite')
    },
    deleteObjectStore(name: string): void {
      db.stores.delete(name)
    },
    transaction(stores: string | string[], mode: 'readonly' | 'readwrite' = 'readonly'): IDBTransactionLike {
      if (closed) throw new Error('db closed')
      const names = Array.isArray(stores) ? stores : [stores]
      const tx: IDBTransactionLike = {
        oncomplete: null,
        onerror: null,
        onabort: null,
        objectStore(n: string) {
          const s = db.stores.get(n)
          if (!s) throw new Error(`store missing: ${n}`)
          return wrapStore(s, mode)
        },
      }
      // Fire oncomplete after the current microtask burst — real IDB does this
      // after all settled requests within the same transaction. We only queue
      // a single microtask which runs after all settled requests have resolved,
      // since queueMicrotask processes FIFO.
      queueMicrotask(() => {
        queueMicrotask(() => {
          if (tx.oncomplete) tx.oncomplete({ target: tx })
        })
      })
      return tx
    },
    close(): void { closed = true },
  }
  return ref
}

export function createFakeIDB(): IDBFactoryLike {
  return {
    open(name: string, version?: number): IDBOpenDBRequestLike {
      const req: any = {
        onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null,
        result: undefined as any, error: null,
      }
      queueMicrotask(() => {
        let existing = dbs.get(name)
        const targetVersion = version ?? existing?.version ?? 1
        const isNew = !existing
        const needsUpgrade = isNew || (existing && targetVersion > existing.version)

        if (isNew) {
          existing = { name, version: targetVersion, stores: new Map() }
          dbs.set(name, existing)
        } else if (needsUpgrade) {
          existing!.version = targetVersion
        }

        const db = wrapDb(existing!)
        req.result = db

        if (needsUpgrade && req.onupgradeneeded) {
          try {
            req.onupgradeneeded({ target: req, oldVersion: isNew ? 0 : (existing!.version - 1), newVersion: targetVersion })
          } catch (e: any) {
            req.error = e instanceof Error ? e : new Error(String(e))
            if (req.onerror) req.onerror({ target: req })
            return
          }
        }
        if (req.onsuccess) req.onsuccess({ target: req })
      })
      return req as IDBOpenDBRequestLike
    },
  }
}

/** For tests: wipe all emulated DBs. */
export function __resetFakeIDB(): void {
  dbs.clear()
}

/** For debugging. */
export function __fakeIDBStats(): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [name, db] of dbs.entries()) {
    for (const [storeName, store] of db.stores.entries()) {
      out[`${name}/${storeName}`] = store.records.size
    }
  }
  return out
}
