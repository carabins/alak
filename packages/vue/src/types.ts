/**
 * @alaq/vue - Type definitions for Vue plugins
 */

import type { Ref } from 'vue'
import type { AtomInstance } from '@alaq/atom'

/**
 * Atom enhanced with VueQuarkRefPlugin
 */
export interface VueQuarkRefAtom<T = any> extends AtomInstance<T> {
  core: Record<string, any & {
    __v_isRef: boolean
    __v_isShallow: boolean
    value: any
  }>
}

/**
 * Atom enhanced with StateReactivePlugin
 */
export interface StateReactiveAtom<T = any> extends AtomInstance<T> {
  state: T & {
    __v_isReactive: boolean
    __v_isReadonly: boolean
    __v_isShallow: boolean
    __v_raw: T
  }

  /** Get clean state without Vue proxies */
  rawState(): T
}

/**
 * Atom enhanced with ViewMarkerPlugin
 */
export interface ViewMarkerAtom<T = any> extends AtomInstance<T> {
  /** Vue refs for marked properties */
  view: Record<string, Ref<any>>
}

/**
 * View marker metadata
 */
export interface ViewMarker {
  _marker: symbol
  value: any
}
