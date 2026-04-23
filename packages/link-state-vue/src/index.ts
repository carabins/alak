/**
 * @alaq/link-state-vue — Vue 3 adapter for @alaq/link-state.
 *
 * Exposes composables that bridge ISyncNode<T> into Vue's reactivity:
 *   - useNode(node)               → Ref<T | undefined>
 *   - useNodeWithDefault(node, d) → Ref<T>
 *   - toRefNoScope(node)          → { ref, release } for non-Vue contexts
 *
 * Plus a provide/inject pair for sharing a SyncStore across a component tree:
 *   - provideStore(store)
 *   - useStore()
 *
 * For extreme DX, see magic.ts (global proxy-less reactivity).
 */

export { useNode, useNodeWithDefault, toRefNoScope } from './use-node'
export { provideStore, useStore, SYNC_STORE_KEY } from './use-store'
export { VueNuclearPlugin, setupMagicVue } from './magic'
export type { ScopedNodeRef, Ref, ISyncNode } from './types'
