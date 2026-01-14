/**
 * VueQuarkRefPlugin - Makes Quark behave like native Vue Ref
 *
 * Integrate Vue's reactivity system with quark by using Vue's customRef
 * This allows quark to function as a native Vue Ref while maintaining its own API
 *
 * @packageDocumentation
 */

import { customRef } from 'vue'
import type { AtomPlugin } from '@alaq/atom'

const IS_VUE_REF = Symbol('quark:vue:isRef')

/**
 * Transform Quark into native Vue Ref by integrating with customRef
 *
 * This plugin makes each Quark property directly usable in Vue templates:
 * - quark.value tracks in Vue components
 * - watch() and watchEffect() work automatically
 */
export const VueQuarkRefPlugin: AtomPlugin = {
  symbol: Symbol.for('vue-quark-ref'),
  name: 'vue-quark-ref',

  onQuarkProperty({ quark, key }) {
    // Skip if already transformed
    if (quark[IS_VUE_REF]) return

    // Store original properties 
    const originalIsRef = quark.__v_isRef
    const originalIsShallow = quark.__v_isShallow

    // Mark as transformed
    quark[IS_VUE_REF] = true
    // Store original values in quark to restore later
    quark.__originalIsRef = originalIsRef
    quark.__originalIsShallow = originalIsShallow

    // Create a Vue-compatible ref that connects with the quark
    // We'll implement a solution that properly integrates Vue's tracking
    // with the quark's subscription system
    let isUpdatingFromQuark = false  // Flag to prevent infinite loops
    
    const vueRef = customRef((track, trigger) => {
      // Subscribe to quark changes to notify Vue
      const unsubscribe = quark.up((newValue) => {
        // Skip update if we just set the value from Vue side
        if (!isUpdatingFromQuark) {
          trigger()  // Notify Vue that value has changed
        }
      })

      return {
        get() {
          track()  // Tell Vue to track this access
          return quark.value  // Return current value of quark
        },
        set(newValue) {
          if (quark.value !== newValue) {
            isUpdatingFromQuark = true
            try {
              quark(newValue)  // Update the quark
            } finally {
              isUpdatingFromQuark = false
            }
            trigger()  // Notify Vue that value has changed
          }
        }
      }
    })

    // Add Vue ref markers to quark
    quark.__v_isRef = vueRef.__v_isRef
    quark.__v_isShallow = vueRef.__v_isShallow

    // Replace .value property with Vue-tracked version
    const valueDescriptor = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(vueRef),
      'value'
    )

    if (valueDescriptor) {
      Object.defineProperty(quark, 'value', {
        get: valueDescriptor.get?.bind(vueRef),
        set: valueDescriptor.set?.bind(vueRef),
        enumerable: false,
        configurable: true
      })
    }
  },

  onDecay(atom) {
    // Cleanup Vue markers
    Object.values(atom.core).forEach((quark: any) => {
      if (quark[IS_VUE_REF]) {
        // Restore original values or remove if they were undefined
        if (quark.__originalIsRef !== undefined) {
          quark.__v_isRef = quark.__originalIsRef
        } else {
          delete quark.__v_isRef
        }
        
        if (quark.__originalIsShallow !== undefined) {
          quark.__v_isShallow = quark.__originalIsShallow
        } else {
          delete quark.__v_isShallow
        }
        
        delete quark.__originalIsRef
        delete quark.__originalIsShallow
        delete quark[IS_VUE_REF]
        
        // Remove the value property descriptor to restore original behavior
        delete quark.value
      }
    })
  }
}
