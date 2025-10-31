/**
 * VueQuarkRefPlugin - Makes Quark behave like native Vue Ref
 *
 * NO additional ref instances created - uses Vue's customRef for direct integration
 * Quark becomes a true Vue Ref that works in templates and with watch()
 *
 * @packageDocumentation
 */

import { customRef, type Ref } from 'vue'
import type { AtomPlugin } from '@alaq/atom'

const IS_VUE_REF = Symbol('quark:vue:isRef')

/**
 * Transform Quark into native Vue Ref using customRef
 *
 * This plugin makes each Quark property directly usable in Vue templates:
 * - quark.value tracks in Vue components
 * - watch() and watchEffect() work automatically
 * - No wrapper objects, no double tracking
 */
export const VueQuarkRefPlugin: AtomPlugin = {
  name: 'vue-quark-ref',

  onQuarkProperty({ quark, key }) {
    // Skip if already transformed
    if (quark[IS_VUE_REF]) return

    // Mark as transformed
    quark[IS_VUE_REF] = true

    // Get current value
    let currentValue = quark.value

    // Create customRef that integrates with Vue's reactivity
    const vueRef = customRef((track, trigger) => {
      // Listen to quark changes
      quark.up((newValue: any) => {
        if (currentValue !== newValue) {
          currentValue = newValue
          trigger() // Notify Vue
        }
      })

      return {
        get() {
          track() // Tell Vue to track this access
          return currentValue
        },
        set(newValue: any) {
          if (currentValue !== newValue) {
            currentValue = newValue
            quark(newValue) // Update quark
            trigger() // Notify Vue
          }
        }
      }
    })

    // Copy Vue ref properties to quark
    // This makes quark look like a ref to Vue
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
        delete quark.__v_isRef
        delete quark.__v_isShallow
        delete quark[IS_VUE_REF]
      }
    })
  }
}
