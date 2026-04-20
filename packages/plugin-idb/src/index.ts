/**
 * @alaq/plugin-idb — persistent state in IndexedDB for Nucl.
 *
 * Two modes:
 *   - `kind: 'idb'`            — single-value KV (one entry per nucl).
 *   - `kind: 'idb-collection'` — record store with insert/update/remove/query.
 *
 * Semantics: optimistic sync. `nuq(value)` is synchronous; writes land in
 * IDB via a debounced background queue. Companions:
 *   - `nuc.$ready` — `false` while initial rehydrate is in flight.
 *   - `nuc.$saved` — `false` while writes are pending.
 *
 * See CONCEPT.md for architecture and design notes.
 */

export { idbPlugin, __resetIdbRuntime } from './plugin'
export { createFakeIDB, __resetFakeIDB } from './mock/fake-idb'

export type {
  IdbPluginConfig,
  IdbOptions,
  CollectionSchema,
  CollectionQuery,
  CollectionMethods,
  IdbCompanions,
  IDBFactoryLike,
  IDBDatabaseLike,
  IDBTransactionLike,
  IDBObjectStoreLike,
  IDBRequestLike,
  IDBIndexLike,
} from './types'
