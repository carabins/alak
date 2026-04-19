// @alaq/link-state — SyncMapNode: per-entry reactive accessor over a map path.
//
// Maps on the wire are `Record<K, V>` (see @alaq/graph-link-state/utils.ts).
// Client code typically wants two things:
//   1. Subscribe to a single entry by key (`$roundVotes.get('r1')`) — a
//      reactive node whose shape depends on the value type. Scalars give
//      `ISyncNode<V>`; records give `<Record>Node`; nested maps give
//      another `SyncMapNode<...>`. Nesting is the caller's job via
//      `valueFactory`.
//   2. Enumerate keys / entries for iteration (vote tallies, role tables,
//      etc.) without paying for node allocation.
//
// Storage path convention: `${mapPath}.${String(key)}`. Numeric keys are
// stringified so the SyncStore's dotted-path model keeps working uniformly.

import { isGhost } from '@alaq/deep-state'
import type { ISyncNode } from './types'

export interface SyncMapNode<K extends string | number, V, N = ISyncNode<V>>
  extends ISyncNode<Record<K, V>> {
  /** Reactive node for the entry at `key`. */
  get(key: K): N
  /** Snapshot value by key. Does not create a node. */
  peek(key: K): V | undefined
  /** Snapshot key list. Empty when the map is missing. */
  keys(): K[]
  /** Snapshot `[key, value]` pairs. Empty when the map is missing. */
  entries(): Array<[K, V]>
}

/**
 * Wrap an `ISyncNode<Record<K, V>>` in a `SyncMapNode<K, V, N>`.
 *
 * @param store         the SyncStore used to resolve child paths
 * @param path          full path to the map itself
 * @param valueFactory  builds a typed child node from a full entry path.
 *                      For scalar values: `(p) => store.get(p)`. For records:
 *                      the generated `createXNode`. For nested maps: another
 *                      `createMapNode` call.
 */
export function createMapNode<K extends string | number, V, N>(
  store: any,
  path: string,
  valueFactory: (valuePath: string) => N,
): SyncMapNode<K, V, N> {
  const base = store.get(path) as ISyncNode<Record<K, V>>
  const anyBase = base as any

  if (typeof anyBase.get !== 'function' || anyBase.__syncMap !== true) {
    Object.defineProperty(anyBase, 'get', {
      value: (key: K): N => valueFactory(`${path}.${String(key)}`),
      configurable: true,
    })
    Object.defineProperty(anyBase, 'peek', {
      value: (key: K): V | undefined => {
        const m = base.value as Record<K, V> | undefined
        if (!m || isGhost(m)) return undefined
        const v = (m as any)[key]
        // Missing keys produce a ghost proxy in deep-state mode. Callers
        // asking for a snapshot expect `undefined` on miss, not a ghost.
        if (isGhost(v)) return undefined
        return v
      },
      configurable: true,
    })
    Object.defineProperty(anyBase, 'keys', {
      value: (): K[] => {
        const m = base.value as Record<K, V> | undefined
        if (!m || isGhost(m)) return []
        // `Reflect.ownKeys` works through the deep-state proxy's `ownKeys`
        // trap (it returns the real target's keys). `Object.keys` doesn't,
        // because the proxy lacks `getOwnPropertyDescriptor`.
        return Reflect.ownKeys(m as object).filter(
          (k) => typeof k === 'string',
        ) as K[]
      },
      configurable: true,
    })
    Object.defineProperty(anyBase, 'entries', {
      value: (): Array<[K, V]> => {
        const m = base.value as Record<K, V> | undefined
        if (!m || isGhost(m)) return []
        const keys = Reflect.ownKeys(m as object).filter(
          (k) => typeof k === 'string',
        ) as K[]
        return keys.map((k) => [k, (m as any)[k]] as [K, V])
      },
      configurable: true,
    })
    Object.defineProperty(anyBase, '__syncMap', {
      value: true,
      configurable: true,
    })
  }

  return anyBase as SyncMapNode<K, V, N>
}
