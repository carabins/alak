/**
 * Promise-wrapped IDB open with per-realm singleton caching.
 *
 * Lifecycle:
 *   - One DB per realm, shared across all nucls in that realm.
 *   - On demand, `ensureStores()` re-opens the DB at (version+1) to add
 *     any missing object stores. This is the only schema change we do —
 *     no migrations; if a collection schema changed we just log and
 *     keep the old store as-is.
 */

import type {
  IDBFactoryLike, IDBDatabaseLike, CollectionSchema,
} from '../types'

interface DbEntry {
  dbName: string
  db: IDBDatabaseLike | null
  opening: Promise<IDBDatabaseLike> | null
  version: number
  knownStores: Set<string>
}

const entries: Map<string, DbEntry> = new Map()

function hasStore(db: IDBDatabaseLike, name: string): boolean {
  const list: any = db.objectStoreNames
  if (Array.isArray(list)) return list.includes(name)
  if (list && typeof list.contains === 'function') return list.contains(name)
  return false
}

function iterStores(db: IDBDatabaseLike): string[] {
  const list: any = db.objectStoreNames
  if (Array.isArray(list)) return list.slice()
  if (list && typeof list.item === 'function') {
    const out: string[] = []
    for (let i = 0; i < list.length; i++) {
      const n = list.item(i)
      if (n) out.push(n)
    }
    return out
  }
  return []
}

function openOnce(
  factory: IDBFactoryLike,
  name: string,
  version: number,
  upgrade: (db: IDBDatabaseLike, oldVersion: number) => void,
): Promise<IDBDatabaseLike> {
  return new Promise((resolve, reject) => {
    const req = factory.open(name, version)
    req.onupgradeneeded = (ev: any) => {
      try {
        const old = ev?.oldVersion ?? 0
        upgrade(req.result, old)
      } catch (e) {
        reject(e)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('idb open error'))
  })
}

/**
 * Ensure the DB for this realm is open and contains all required stores.
 *
 * - `kvStore` — the shared KV store name; created on first open.
 * - `collectionStores` — each with its primaryKey + optional indexes.
 *
 * Returns the opened DB. Safe to call repeatedly; re-opens with version+1
 * only when stores are missing.
 */
export async function ensureDB(
  factory: IDBFactoryLike,
  realm: string,
  minVersion: number,
  kvStore: string,
  collectionStores: Map<string, CollectionSchema>,
): Promise<IDBDatabaseLike> {
  const dbName = `alaq:${realm || '_default'}`
  let entry = entries.get(dbName)
  if (!entry) {
    entry = { dbName, db: null, opening: null, version: Math.max(minVersion, 1), knownStores: new Set() }
    entries.set(dbName, entry)
  }

  // Build the list of required stores.
  const required = new Set<string>()
  required.add(kvStore)
  for (const n of collectionStores.keys()) required.add(n)

  // First open (or re-open after close).
  if (!entry.db && !entry.opening) {
    const targetVersion = entry.version
    entry.opening = openOnce(factory, entry.dbName, targetVersion, (db) => {
      // Create missing stores.
      if (!hasStore(db, kvStore)) db.createObjectStore(kvStore)
      for (const [storeName, schema] of collectionStores.entries()) {
        if (!hasStore(db, storeName)) {
          const store = db.createObjectStore(storeName, { keyPath: schema.primaryKey })
          for (const idx of schema.indexes ?? []) {
            store.createIndex?.(idx, idx)
          }
        }
      }
    }).then(db => {
      entry!.db = db
      entry!.opening = null
      for (const n of iterStores(db)) entry!.knownStores.add(n)
      return db
    })
    await entry.opening
  } else if (entry.opening) {
    await entry.opening
  }

  const db = entry.db!

  // Check if any required stores are missing; if so, bump version and re-open.
  const missing: string[] = []
  for (const r of required) if (!hasStore(db, r)) missing.push(r)

  if (missing.length === 0) return db

  // Missing stores — close, bump version, re-open with upgrade.
  db.close()
  entry.db = null
  entry.version += 1
  entry.opening = openOnce(factory, entry.dbName, entry.version, (newDb) => {
    if (!hasStore(newDb, kvStore)) newDb.createObjectStore(kvStore)
    for (const [storeName, schema] of collectionStores.entries()) {
      if (!hasStore(newDb, storeName)) {
        const store = newDb.createObjectStore(storeName, { keyPath: schema.primaryKey })
        for (const idx of schema.indexes ?? []) {
          store.createIndex?.(idx, idx)
        }
      }
    }
  }).then(newDb => {
    entry!.db = newDb
    entry!.opening = null
    for (const n of iterStores(newDb)) entry!.knownStores.add(n)
    return newDb
  })

  return entry.opening
}

/** For tests. */
export function __resetDbCache(): void {
  for (const e of entries.values()) {
    try { e.db?.close() } catch { /* ignore */ }
  }
  entries.clear()
}
