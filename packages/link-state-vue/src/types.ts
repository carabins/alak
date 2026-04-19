import type { Ref } from 'vue'
import type { ISyncNode } from '@alaq/link-state'

/**
 * Options for {@link useNode} and friends.
 */
export interface UseNodeOptions {
  /**
   * When true, keeps subscribing even if the initial value is a ghost.
   * Defaults to true — SyncStore emits the real value once it arrives.
   */
  immediate?: boolean
}

/**
 * A scope-independent binding of an ISyncNode to a Vue Ref.
 * Returned by {@link toRefNoScope} for use outside component/effect scope.
 */
export interface ScopedNodeRef<T> {
  ref: Ref<T | undefined>
  release: () => void
}

export type { Ref, ISyncNode }
