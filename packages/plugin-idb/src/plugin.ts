/**
 * The IDB nucl plugin.
 *
 * Flow per nucl:
 *
 *   onCreate:
 *     1. Attach `$ready` and `$saved` companion nucls (initial: false / true).
 *     2. Kick off async rehydrate: open DB → get current value → nuq(value).
 *     3. For collection mode, also inject `insert/update/remove/query`.
 *
 *   onBeforeChange (single-value mode):
 *     1. Stage the next value; mark `$saved(false)`.
 *     2. Schedule a debounced flush → kvPut(db, id, staged).
 *     3. On success → `$saved(true)`. On error → rollback + error frame.
 *
 *   Collection methods:
 *     - Compute new array in memory, call nuq(newArr) (which goes through
 *       onBeforeChange on the in-memory side).
 *     - Simultaneously enqueue an op in the per-nucl collection-ops buffer.
 *     - Debounced flush writes all ops in one readwrite transaction.
 */

import type { INucleonPlugin } from '@alaq/nucl/INucleonPlugin'
import type { INucleonCore } from '@alaq/nucl/INucleon'
import type { INuOptions } from '@alaq/nucl/options'
import { createNu } from '@alaq/nucl/createNu'
import type {
  IdbPluginConfig, IdbOptions, IDBFactoryLike, CollectionSchema,
  IDBDatabaseLike, CollectionQuery,
} from './types'
import { ensureDB, __resetDbCache } from './driver/open-db'
import { KV_STORE_NAME, kvGet, kvPut } from './driver/kv'
import { collGetAll, collFlush, type CollectionOp } from './driver/collection'
import { WriteQueue, __cancelAllQueues } from './queue'
import { logIdb } from './logi-bridge'

// -------------------------------------------------------------------------
// Runtime (module-global, matches plugin-logi pattern).

interface RuntimeState {
  factory: IDBFactoryLike | null
  debounceMs: number
  minVersion: number
  /** realm -> set of collection store names registered so far. */
  collectionsByRealm: Map<string, Map<string, CollectionSchema>>
}

let runtime: RuntimeState | null = null

function getRuntime(): RuntimeState {
  if (!runtime) runtime = defaultRuntime()
  return runtime
}

function defaultRuntime(): RuntimeState {
  const g = globalThis as any
  const factory: IDBFactoryLike | null =
    g.indexedDB ?? null
  return {
    factory,
    debounceMs: 100,
    minVersion: 1,
    collectionsByRealm: new Map(),
  }
}

export function idbPlugin(config: IdbPluginConfig = {}): INucleonPlugin & { __setFactory(f: IDBFactoryLike): void } {
  const rt = getRuntime()
  if (config.factory !== undefined) rt.factory = config.factory
  if (config.debounceMs !== undefined) rt.debounceMs = config.debounceMs
  if (config.version !== undefined) rt.minVersion = Math.max(rt.minVersion, config.version)

  const plugin: INucleonPlugin & { __setFactory(f: IDBFactoryLike): void } = {
    name: 'idb',
    order: 20,

    onCreate(core: INucleonCore, options?: INuOptions) {
      initNucl(core, options)
    },

    onBeforeChange(core: INucleonCore, nextValue: unknown) {
      const st = coreState(core)
      if (!st || st.mode !== 'kv') return
      // Skip the initial value-set that `createNu` performs right after
      // onCreate (see createNu.ts: nuq.value = options.value). That's the
      // default the caller provided, not a user mutation — we don't want
      // to persist it before rehydrate even runs.
      if (st.skipNextOnBeforeChange) {
        st.skipNextOnBeforeChange = false
        return
      }
      // External mutation; stage the new value for flush.
      scheduleKvFlush(core, st, nextValue)
    },

    onDecay(core: INucleonCore) {
      // Flush any pending writes synchronously-enough (don't await).
      const st = coreState(core)
      if (!st) return
      if (st.mode === 'kv') {
        void st.queue.flushNow()
      } else {
        void st.queue.flushNow()
      }
    },

    methods: {
      // Collection methods — noop/throw if not a collection nucl.
      insert(this: any, record: any): void {
        const st = coreState(this)
        if (!st || st.mode !== 'collection') {
          throw new TypeError('insert() requires kind: idb-collection')
        }
        const pk = st.schema!.primaryKey
        const key = record?.[pk]
        if (key === undefined || key === null) {
          throw new TypeError(`insert(): record missing primaryKey "${pk}"`)
        }
        const cur: any[] = Array.isArray(this._value) ? this._value : []
        const idx = cur.findIndex((r: any) => r?.[pk] === key)
        const next = idx >= 0
          ? cur.slice(0, idx).concat([record], cur.slice(idx + 1))
          : cur.concat([record])
        st.ops.push({ t: 'put', value: record })
        scheduleCollFlush(this, st)
        ;(this as Function)(next)
      },
      update(this: any, key: any, patch: any): void {
        const st = coreState(this)
        if (!st || st.mode !== 'collection') {
          throw new TypeError('update() requires kind: idb-collection')
        }
        const pk = st.schema!.primaryKey
        const cur: any[] = Array.isArray(this._value) ? this._value : []
        const idx = cur.findIndex((r: any) => r?.[pk] === key)
        if (idx < 0) return
        const merged = { ...cur[idx], ...patch, [pk]: key }
        const next = cur.slice(0, idx).concat([merged], cur.slice(idx + 1))
        st.ops.push({ t: 'put', value: merged })
        scheduleCollFlush(this, st)
        ;(this as Function)(next)
      },
      remove(this: any, key: any): void {
        const st = coreState(this)
        if (!st || st.mode !== 'collection') {
          throw new TypeError('remove() requires kind: idb-collection')
        }
        const pk = st.schema!.primaryKey
        const cur: any[] = Array.isArray(this._value) ? this._value : []
        const next = cur.filter((r: any) => r?.[pk] !== key)
        st.ops.push({ t: 'delete', key })
        scheduleCollFlush(this, st)
        ;(this as Function)(next)
      },
      query(this: any, q?: CollectionQuery): any[] {
        const st = coreState(this)
        if (!st || st.mode !== 'collection') {
          throw new TypeError('query() requires kind: idb-collection')
        }
        const cur: any[] = Array.isArray(this._value) ? this._value : []
        if (!q || q.where === undefined) return cur.slice()
        return cur.filter((r: any) => r?.[q.where!] === q.equals)
      },
    },

    __setFactory(f: IDBFactoryLike) {
      getRuntime().factory = f
    },
  }

  return plugin
}

// -------------------------------------------------------------------------
// Per-nucl state (attached via WeakMap so we don't pollute the nucl object).

interface KvState {
  mode: 'kv'
  key: string
  realm: string
  queue: WriteQueue
  stagedValue: any
  hasStaged: boolean
  lastSaved: any
  $ready: any
  $saved: any
  atomSegment: string
  propSegment: string
  /** Skip the implicit initial value write that createNu performs. */
  skipNextOnBeforeChange: boolean
}

interface CollState {
  mode: 'collection'
  storeName: string
  realm: string
  schema: CollectionSchema
  queue: WriteQueue
  ops: CollectionOp[]
  $ready: any
  $saved: any
  atomSegment: string
  propSegment: string
}

type NuclState = KvState | CollState

const stateByCore = new WeakMap<INucleonCore, NuclState>()

function coreState(core: INucleonCore): NuclState | undefined {
  return stateByCore.get(core)
}

// -------------------------------------------------------------------------
// onCreate handler.

function initNucl(core: INucleonCore, options?: INuOptions): void {
  const rt = getRuntime()
  const idbOpts = options as (INuOptions & IdbOptions) | undefined
  const realm: string = (core as any).realm ?? idbOpts?.realm ?? ''
  const id: string = (core as any).id ?? idbOpts?.id ?? ''
  const kindStr: string = (options?.kind ?? '') as string
  const isCollection = idbOpts?.collection !== undefined ||
    kindStr.split(/\s+/).includes('idb-collection')

  const { atom, prop } = splitId(id)

  // Create companion nucls.
  // NOTE: we create them without the idb kind to avoid recursion.
  const $ready = createNu<boolean>({ value: false, id: `${id}.$ready`, realm })
  const $saved = createNu<boolean>({ value: true, id: `${id}.$saved`, realm })
  try { (core as any).$ready = $ready } catch { /* ignore */ }
  try { (core as any).$saved = $saved } catch { /* ignore */ }

  const debounceMs = idbOpts?.debounceMs ?? rt.debounceMs

  if (isCollection) {
    const schema = idbOpts?.collection ?? { primaryKey: 'id' }
    // Register collection in realm map.
    let map = rt.collectionsByRealm.get(realm)
    if (!map) { map = new Map(); rt.collectionsByRealm.set(realm, map) }
    map.set(id, schema)

    const st: CollState = {
      mode: 'collection',
      storeName: id,
      realm,
      schema,
      queue: new WriteQueue(debounceMs),
      ops: [],
      $ready, $saved,
      atomSegment: atom, propSegment: prop,
    }
    stateByCore.set(core, st)

    logIdb({ realm, atom, prop, kind: 'lifecycle', message: 'idb:open' })
    void rehydrateCollection(core, st, rt)
  } else {
    const st: KvState = {
      mode: 'kv',
      key: id,
      realm,
      queue: new WriteQueue(debounceMs),
      stagedValue: undefined,
      hasStaged: false,
      lastSaved: (core as any)._value,
      $ready, $saved,
      atomSegment: atom, propSegment: prop,
      // The createNu flow fires onBeforeChange once for the initial default
      // value, right after onCreate returns. We ignore that first call.
      skipNextOnBeforeChange: options?.value !== undefined,
    }
    stateByCore.set(core, st)

    logIdb({ realm, atom, prop, kind: 'lifecycle', message: 'idb:open' })
    void rehydrateKv(core, st, rt)
  }
}

async function rehydrateKv(core: INucleonCore, st: KvState, rt: RuntimeState): Promise<void> {
  if (!rt.factory) {
    // No IDB available at all — mark ready with default, log.
    st.$ready(true)
    logIdb({
      realm: st.realm, atom: st.atomSegment, prop: st.propSegment,
      kind: 'error', message: 'idb:unavailable',
      extra: { error_type: 'idb:unavailable' },
    })
    return
  }
  const started = Date.now()
  try {
    const collections = rt.collectionsByRealm.get(st.realm) ?? new Map()
    const db = await ensureDB(rt.factory, st.realm, rt.minVersion, KV_STORE_NAME, collections)
    const { hit, value } = await kvGet(db, st.key)
    const duration = Date.now() - started
    if (hit) {
      // Bypass onBeforeChange (would trigger a re-save loop). Direct state write.
      directAssign(core, value)
      st.lastSaved = value
      logIdb({
        realm: st.realm, atom: st.atomSegment, prop: st.propSegment,
        kind: 'lifecycle', message: 'idb:get:hit',
        duration_ms: duration,
      })
    } else {
      logIdb({
        realm: st.realm, atom: st.atomSegment, prop: st.propSegment,
        kind: 'lifecycle', message: 'idb:get:miss',
        duration_ms: duration,
      })
    }
  } catch (e) {
    logIdb({
      realm: st.realm, atom: st.atomSegment, prop: st.propSegment,
      kind: 'error', message: 'idb:get:error',
      extra: { error_type: 'idb:get', error: describeError(e) },
    })
  } finally {
    st.$ready(true)
  }
}

async function rehydrateCollection(core: INucleonCore, st: CollState, rt: RuntimeState): Promise<void> {
  if (!rt.factory) {
    st.$ready(true)
    logIdb({
      realm: st.realm, atom: st.atomSegment, prop: st.propSegment,
      kind: 'error', message: 'idb:unavailable',
      extra: { error_type: 'idb:unavailable' },
    })
    return
  }
  const started = Date.now()
  try {
    const collections = rt.collectionsByRealm.get(st.realm) ?? new Map()
    const db = await ensureDB(rt.factory, st.realm, rt.minVersion, KV_STORE_NAME, collections)
    const arr = await collGetAll(db, st.storeName)
    const duration = Date.now() - started
    if (arr.length > 0) {
      directAssign(core, arr)
      logIdb({
        realm: st.realm, atom: st.atomSegment, prop: st.propSegment,
        kind: 'lifecycle', message: 'idb:get:hit',
        duration_ms: duration,
        numeric: { result_count: arr.length },
      })
    } else {
      logIdb({
        realm: st.realm, atom: st.atomSegment, prop: st.propSegment,
        kind: 'lifecycle', message: 'idb:get:miss',
        duration_ms: duration,
      })
    }
  } catch (e) {
    logIdb({
      realm: st.realm, atom: st.atomSegment, prop: st.propSegment,
      kind: 'error', message: 'idb:get:error',
      extra: { error_type: 'idb:get', error: describeError(e) },
    })
  } finally {
    st.$ready(true)
  }
}

// -------------------------------------------------------------------------
// KV flush.

function scheduleKvFlush(core: INucleonCore, st: KvState, nextValue: any): void {
  st.stagedValue = nextValue
  st.hasStaged = true
  st.$saved(false)
  st.queue.schedule(() => flushKv(core, st))
}

async function flushKv(core: INucleonCore, st: KvState): Promise<void> {
  const rt = getRuntime()
  if (!rt.factory) {
    // Can't persist; but we already updated in-memory. Mark saved=true to
    // unblock listeners — caller has nothing to do.
    st.$saved(true)
    return
  }
  if (!st.hasStaged) { st.$saved(true); return }
  const value = st.stagedValue
  st.hasStaged = false
  st.stagedValue = undefined

  const began = Date.now()
  logIdb({
    realm: st.realm, atom: st.atomSegment, prop: st.propSegment,
    kind: 'lifecycle', message: 'idb:put:begin',
  })

  try {
    const collections = rt.collectionsByRealm.get(st.realm) ?? new Map()
    const db = await ensureDB(rt.factory, st.realm, rt.minVersion, KV_STORE_NAME, collections)
    await kvPut(db, st.key, value)
    st.lastSaved = value
    logIdb({
      realm: st.realm, atom: st.atomSegment, prop: st.propSegment,
      kind: 'lifecycle', message: 'idb:put:end',
      duration_ms: Date.now() - began,
    })
    // If nothing else got staged in the meantime, we're saved.
    if (!st.hasStaged) st.$saved(true)
  } catch (e) {
    // Rollback: restore in-memory value to last known good.
    directAssign(core, st.lastSaved)
    logIdb({
      realm: st.realm, atom: st.atomSegment, prop: st.propSegment,
      kind: 'error', message: 'idb:put:error',
      extra: { error_type: idbErrorType(e), error: describeError(e) },
    })
    // leave $saved as false — caller can still observe it and retry.
  }
}

// -------------------------------------------------------------------------
// Collection flush.

function scheduleCollFlush(core: INucleonCore, st: CollState): void {
  st.$saved(false)
  st.queue.schedule(() => flushColl(core, st))
}

async function flushColl(core: INucleonCore, st: CollState): Promise<void> {
  const rt = getRuntime()
  if (!rt.factory) { st.$saved(true); return }
  if (st.ops.length === 0) { st.$saved(true); return }

  const ops = st.ops.splice(0, st.ops.length)
  const began = Date.now()
  logIdb({
    realm: st.realm, atom: st.atomSegment, prop: st.propSegment,
    kind: 'lifecycle', message: 'idb:put:begin',
    numeric: { op_count: ops.length },
  })
  try {
    const collections = rt.collectionsByRealm.get(st.realm) ?? new Map()
    const db = await ensureDB(rt.factory, st.realm, rt.minVersion, KV_STORE_NAME, collections)
    await collFlush(db, st.storeName, ops)
    logIdb({
      realm: st.realm, atom: st.atomSegment, prop: st.propSegment,
      kind: 'lifecycle', message: 'idb:put:end',
      duration_ms: Date.now() - began,
      numeric: { op_count: ops.length },
    })
    if (st.ops.length === 0) st.$saved(true)
  } catch (e) {
    logIdb({
      realm: st.realm, atom: st.atomSegment, prop: st.propSegment,
      kind: 'error', message: 'idb:put:error',
      extra: { error_type: idbErrorType(e), error: describeError(e) },
    })
    // Don't rollback collection (partial failure is ambiguous) — leave $saved false.
  }
}

// -------------------------------------------------------------------------
// Helpers.

/**
 * Write a value to a nucl's internal state without triggering our onBeforeChange.
 *
 * The nucl call signature is `nuc(newValue)` which goes through the registry's
 * onBeforeChange. To avoid re-scheduling a save during rehydrate, we mirror
 * the essential bits of setValue ourselves: set `_value`, clear IS_EMPTY,
 * notify listeners.
 */
function directAssign(core: INucleonCore, value: any): void {
  const q = core as any
  const prev = q._value
  q._value = value
  // Clear IS_EMPTY (bit 1).
  if (q._flags !== undefined) q._flags &= ~1
  // Fire edges (listeners subscribed via .up).
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

function idbErrorType(e: unknown): string {
  if (e instanceof Error) {
    if (e.name === 'QuotaExceededError') return 'idb:quota_exceeded'
    if (e.name === 'DataCloneError') return 'idb:data_clone'
    if (e.name === 'ConstraintError') return 'idb:constraint'
    return `idb:${e.name}`
  }
  return 'idb:unknown'
}

// -------------------------------------------------------------------------
// Test utilities.

export function __resetIdbRuntime(): void {
  __cancelAllQueues()
  runtime = null
  __resetDbCache()
}

export function __getIdbRuntime(): RuntimeState | null {
  return runtime
}
