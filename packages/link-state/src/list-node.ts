// @alaq/link-state — SyncListNode: per-index reactive accessor over a list path.
//
// Wraps an underlying `ISyncNode<T[]>` and augments it with:
//   - `item(index)`  → reactive node for the element at that index. Used by
//     Vue components that want to subscribe to a single row instead of the
//     whole array. The returned node's shape is chosen by the caller via
//     `itemFactory` so this helper stays agnostic of whether the element is
//     a scalar, a record, another list, or a map.
//   - `at(index)`    → snapshot value at index, no node allocation.
//   - `length`       → snapshot length. Reactive to version bumps since it
//     reads through the base node's getter on every access.
//
// The augmentation is in-place on the underlying node object. That keeps the
// public `ISyncNode<T[]>` surface (value, $status, $meta, up/down, _get,
// _node, $release, call-as-function) intact, so existing consumers of the
// flat list accessor keep working.

import { isGhost } from '@alaq/deep-state'
import type { ISyncNode } from './types'

export interface SyncListNode<T, N = ISyncNode<T>> extends ISyncNode<T[]> {
  /** Reactive node for the element at `index`. Stable for a given index. */
  item(index: number): N
  /** Snapshot element at `index`. Does not create a node. */
  at(index: number): T | undefined
  /** Current snapshot length of the list (0 if the value is missing). */
  readonly length: number
}

/**
 * Wrap an `ISyncNode<T[]>` in a `SyncListNode<T, N>`.
 *
 * @param store         the SyncStore used to resolve child paths
 * @param path          full path to the list itself (e.g. `room.abc.players`)
 * @param itemFactory   builds a typed child node from a full child path
 *                      (e.g. `room.abc.players.0`). For record items this
 *                      is the generated `createXNode`; for scalars it's
 *                      `(p) => store.get(p)`.
 */
export function createListNode<T, N>(
  store: any,
  path: string,
  itemFactory: (itemPath: string) => N,
): SyncListNode<T, N> {
  const base = store.get(path) as ISyncNode<T[]>

  // The base node already carries everything from ISyncNode<T[]>. We only
  // need to decorate it with the three list-specific helpers. Decorating in
  // place (rather than wrapping) avoids breaking identity checks and lets
  // Vue-side watchers keep their reference stable across rerenders.
  const anyBase = base as any

  if (typeof anyBase.item !== 'function') {
    Object.defineProperty(anyBase, 'item', {
      value: (index: number): N => itemFactory(`${path}.${index}`),
      configurable: true,
    })
  }

  if (typeof anyBase.at !== 'function') {
    Object.defineProperty(anyBase, 'at', {
      value: (index: number): T | undefined => {
        const arr = base.value as any
        if (arr == null || isGhost(arr)) return undefined
        const v = arr[index]
        if (isGhost(v)) return undefined
        return v as T
      },
      configurable: true,
    })
  }

  // `anyBase` is a callable function (SyncNode is `function(value?: T)`), so
  // it ships with a builtin `length` (arity). Force-override to the dynamic
  // snapshot length.
  const lenDesc = Object.getOwnPropertyDescriptor(anyBase, 'length')
  if (!lenDesc || lenDesc.writable !== false || !lenDesc.get) {
    Object.defineProperty(anyBase, 'length', {
      get() {
        const arr = base.value as any
        if (arr == null || isGhost(arr)) return 0
        // `arr` is a deep-state proxy over an Array. The handler exposes
        // `length` as a direct passthrough to the underlying array.
        const len = arr.length
        return typeof len === 'number' ? len : 0
      },
      configurable: true,
    })
  }

  return anyBase as SyncListNode<T, N>
}
