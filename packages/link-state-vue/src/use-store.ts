import { provide, inject, type InjectionKey } from 'vue'
import type { SyncStore } from '@alaq/link-state'

/**
 * InjectionKey for SyncStore. Exported so advanced users can pass their own key,
 * but the default flow is just `provideStore(store)` / `useStore()`.
 */
export const SYNC_STORE_KEY: InjectionKey<SyncStore> = Symbol.for('alaq.link-state.store')

/**
 * Provides a SyncStore to the descendant component tree via Vue's provide/inject.
 * Call this inside the root component's `setup()`.
 */
export function provideStore(store: SyncStore): void {
  provide(SYNC_STORE_KEY, store)
}

/**
 * Retrieves the SyncStore provided by an ancestor component.
 * Throws if no store was provided — this is an app-wiring bug, not a user error.
 */
export function useStore(): SyncStore {
  const store = inject(SYNC_STORE_KEY, null as SyncStore | null)
  if (!store) {
    throw new Error(
      '[link-state-vue] No SyncStore provided. Call provideStore(store) in a parent component (typically in your root App.vue setup).'
    )
  }
  return store
}
