/**
 * ViewMarkerPlugin - Selective Vue reactivity using view() marker
 *
 * Only properties marked with view() become Vue refs
 * Optimal performance - only reactive what you need
 *
 * @packageDocumentation
 */

import { customRef } from 'vue'
import type { AtomPlugin } from '@alaq/atom'

const VIEW_MARKER = Symbol.for('atom:view')
const IS_VIEW_REF = Symbol('atom:view:isRef')

/**
 * Marker for Vue-reactive properties
 *
 * @example
 * ```ts
 * class Counter {
 *   count = view(0)        // Vue reactive
 *   internal = 100         // Not reactive
 * }
 *
 * const counter = Atom(Counter)
 * // counter.view.count - Vue ref
 * // counter.state.internal - plain value
 * ```
 */
export function view(initialValue: any) {
  return {
    _marker: VIEW_MARKER,
    value: initialValue
  }
}

/**
 * Check if value has view marker
 */
export function isView(value: any): boolean {
  return value?._marker === VIEW_MARKER
}

/**
 * Makes only marked properties Vue-reactive
 *
 * Creates atom.view namespace with Vue refs for marked properties
 * Unmarked properties remain in atom.state without Vue overhead
 */
export const ViewMarkerPlugin: AtomPlugin = {
  symbol: Symbol.for('vue-view-marker'),
  name: 'vue-view-marker',

  detectMarker(value) {
    return isView(value)
  },

  onCreate(atom) {
    // Create .view namespace
    atom.view = {}
  },

  onQuarkProperty({ atom, quark, key, markers }) {
    // Check for view() marker
    const hasViewMarker = markers?.some(m => m._marker === VIEW_MARKER)

    if (!hasViewMarker) return

    // Skip if already transformed
    if (quark[IS_VIEW_REF]) return

    // Mark as view ref
    quark[IS_VIEW_REF] = true

    // Create Vue ref using customRef
    const vueRef = customRef((track, trigger) => {
      return {
        get() {
          track() // Tell Vue to track this access
          return quark.value
        },
        set(newValue: any) {
          quark(newValue) // Update quark
          trigger() // Notify Vue
        }
      }
    })

    // Add to atom.view namespace
    atom.view[key] = vueRef
  },

  onDecay(atom) {
    // Clear view namespace
    if (atom.view) {
      Object.keys(atom.view).forEach(key => {
        const quark = atom.core[key]
        if (quark && quark[IS_VIEW_REF]) {
          delete quark[IS_VIEW_REF]
        }
      })
      delete atom.view
    }
  }
}
