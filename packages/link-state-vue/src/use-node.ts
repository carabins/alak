import { shallowRef, onScopeDispose, getCurrentScope, type Ref } from 'vue'
import type { ISyncNode } from '@alaq/link-state'
import type { ScopedNodeRef } from './types'

/**
 * Converts an ISyncNode into a Vue Ref. The ref updates when the node's value changes.
 * Automatically unsubscribes when the current component / effect scope is disposed.
 *
 * Must be called inside a Vue component `setup()` or an explicit `effectScope()`.
 * If no scope is active, throws — use {@link toRefNoScope} instead for ad-hoc/non-Vue usage.
 *
 * @example
 * ```ts
 * const player = store.get('player')
 * const playerRef = useNode(player) // Ref<Player | undefined>
 * ```
 */
export function useNode<T>(node: ISyncNode<T>): Ref<T | undefined> {
  if (!getCurrentScope()) {
    throw new Error(
      '[link-state-vue] useNode() called outside a Vue component / effect scope. ' +
      'Call it inside setup() or an effectScope(), or use toRefNoScope() for manual lifecycle.'
    )
  }

  const r = shallowRef<T | undefined>(node.value)

  const unsub = node.up((newVal: T) => {
    r.value = newVal
  })

  onScopeDispose(() => {
    unsub()
  })

  return r
}

/**
 * Same as {@link useNode} but returns a guaranteed-defined Ref: if the node is currently
 * ghost / pending / undefined, the ref reads `defaultValue` instead.
 *
 * Useful in templates where you don't want to deal with `?.` everywhere.
 *
 * @example
 * ```ts
 * const hp = useNodeWithDefault(store.get('player.hp'), 100)
 * // hp.value is always number — 100 while pending, then real HP
 * ```
 */
export function useNodeWithDefault<T>(node: ISyncNode<T>, defaultValue: T): Ref<T> {
  if (!getCurrentScope()) {
    throw new Error(
      '[link-state-vue] useNodeWithDefault() called outside a Vue component / effect scope.'
    )
  }

  const initial = node.value
  const r = shallowRef<T>(node.$meta.isGhost || initial === undefined || initial === null
    ? defaultValue
    : (initial as T))

  const unsub = node.up((newVal: T) => {
    r.value = node.$meta.isGhost || newVal === undefined || newVal === null
      ? defaultValue
      : newVal
  })

  onScopeDispose(() => {
    unsub()
  })

  return r
}

/**
 * Creates a Ref bound to a SyncNode without requiring a Vue scope.
 * The caller is responsible for invoking the returned `release()` to stop the subscription.
 *
 * Use this in plain JS contexts (services, workers, test setup) where Vue's
 * scope machinery isn't available.
 */
export function toRefNoScope<T>(node: ISyncNode<T>): ScopedNodeRef<T> {
  const r = shallowRef<T | undefined>(node.value)
  const unsub = node.up((newVal: T) => {
    r.value = newVal
  })
  return {
    ref: r,
    release: unsub,
  }
}

