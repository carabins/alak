/**
 * Plugin contract types for @alaq/plugin-idb.
 *
 * Two modes:
 *   - kind 'idb'            — single-value KV store, one key per nucl in a shared object store.
 *   - kind 'idb-collection' — record store, one object store per nucl; entries keyed by primaryKey.
 *
 * Both modes share the optimistic-sync semantics: nuq(value) returns immediately
 * and writes are flushed in a debounced background queue. Two companion nucls
 * (`$ready` and `$saved`) expose the persistence state to listeners.
 */

import type { INucleonCore } from '@alaq/nucl/INucleon'

/** Minimal subset of IDBFactory we rely on. */
export interface IDBFactoryLike {
  open(name: string, version?: number): IDBOpenDBRequestLike
}

export interface IDBOpenDBRequestLike {
  onsuccess: ((ev: any) => void) | null
  onerror: ((ev: any) => void) | null
  onupgradeneeded: ((ev: any) => void) | null
  onblocked?: ((ev: any) => void) | null
  readonly result: IDBDatabaseLike
  readonly error: Error | null
}

export interface IDBDatabaseLike {
  readonly name: string
  readonly version: number
  readonly objectStoreNames: { contains(name: string): boolean; readonly length: number; item(i: number): string | null } | string[]
  createObjectStore(name: string, options?: { keyPath?: string | string[]; autoIncrement?: boolean }): IDBObjectStoreLike
  deleteObjectStore?(name: string): void
  transaction(stores: string | string[], mode?: 'readonly' | 'readwrite'): IDBTransactionLike
  close(): void
}

export interface IDBTransactionLike {
  objectStore(name: string): IDBObjectStoreLike
  oncomplete: ((ev: any) => void) | null
  onerror: ((ev: any) => void) | null
  onabort: ((ev: any) => void) | null
}

export interface IDBObjectStoreLike {
  put(value: any, key?: any): IDBRequestLike
  get(key: any): IDBRequestLike
  getAll(query?: any): IDBRequestLike
  delete(key: any): IDBRequestLike
  clear(): IDBRequestLike
  createIndex?(name: string, keyPath: string | string[], options?: { unique?: boolean }): IDBIndexLike
  index?(name: string): IDBIndexLike
  readonly indexNames: { contains(name: string): boolean; readonly length: number; item(i: number): string | null } | string[]
}

export interface IDBIndexLike {
  getAll(query?: any): IDBRequestLike
}

export interface IDBRequestLike {
  onsuccess: ((ev: any) => void) | null
  onerror: ((ev: any) => void) | null
  readonly result: any
  readonly error: Error | null
}

/** Schema for collection mode. */
export interface CollectionSchema {
  /** Property name used as primary key. Required. */
  primaryKey: string
  /** Secondary index properties. Optional. */
  indexes?: string[]
}

/**
 * Per-plugin runtime config, set by `idbPlugin(config)`.
 * Global (module-level) — last call wins, matches plugin-logi pattern.
 */
export interface IdbPluginConfig {
  /**
   * Inject an IDBFactory. In browser defaults to `globalThis.indexedDB`.
   * In tests, pass a fake. If undefined and global indexedDB is missing,
   * the plugin degrades to an in-memory store (no persistence, but no crash).
   */
  factory?: IDBFactoryLike
  /** Debounce window in ms for batching writes. Default 100. */
  debounceMs?: number
  /**
   * Database version. The plugin ensures the DB is opened at this version.
   * Bump manually when you add a new collection kind.
   * Default: 1. Migrations are NOT supported — if schema changes break,
   * the plugin logs and leaves the existing DB.
   */
  version?: number
}

/** Options extending INuOptions for idb/idb-collection kinds. */
export interface IdbOptions<T = any> {
  /** Realm — maps to IDB DB name `alaq:${realm}`. Required in practice. */
  realm?: string
  /** Key inside the KV store (for 'idb') or object store name (for 'idb-collection'). */
  id?: string
  /** Collection schema. Required for 'idb-collection'. */
  collection?: CollectionSchema
  /** Per-nucl override of debounceMs. */
  debounceMs?: number
}

/** Query DSL for collection mode. */
export interface CollectionQuery {
  where?: string      // index name (or primary key)
  equals?: any
}

/**
 * Companion nucls attached to every idb-kind nucl:
 *   nuc.$ready  — false until initial rehydrate completes.
 *   nuc.$saved  — false while writes are pending; true once queue drains.
 *
 * Plus, for collection mode:
 *   nuc.insert(record)    — upsert by primaryKey.
 *   nuc.update(key, patch)— partial patch by primaryKey.
 *   nuc.remove(key)       — delete by primaryKey.
 *   nuc.query(q)          — filtered read from current in-memory array.
 */
export interface IdbCompanions<T = any> {
  $ready: INucleonCore
  $saved: INucleonCore
}

export interface CollectionMethods<E = any> {
  insert(record: E): void
  update(key: any, patch: Partial<E>): void
  remove(key: any): void
  query(q?: CollectionQuery): E[]
}
