import { track, trigger, TrackOpTypes, TriggerOpTypes } from '@vue/reactivity'
import { defineKind } from '@alaq/nucl'
import type { INucleonPlugin } from '@alaq/nucl/INucleonPlugin'

/**
 * @alaq/link-state-vue — Magic Mode
 *
 * ⚠️ WARNING: ONE-WAY ROCKET ZONE ⚠️
 *
 * This plugin globally patches Alaq nucleons (atoms) to act as native Vue 3 Refs.
 * It uses Vue's internal `track()` and `trigger()` functions.
 *
 * PROS:
 * - Ultimate DX: use atoms in Vue templates directly, without .value or useNode().
 * - No boilerplate.
 *
 * CONS:
 * - High overhead on high-frequency state updates.
 * - Tight coupling with Vue internals.
 * - Potential memory leaks if not managed carefully.
 *
 * USE ONLY IF YOU KNOW WHAT YOU ARE DOING.
 */

export const VueNuclearPlugin: INucleonPlugin = {
  name: 'vue',
  order: 100, // Run late to ensure value is already set

  onCreate(nucl: any) {
    // Mark as a Vue Ref so it's unwrapped in templates and pass isRef checks
    nucl.__v_isRef = true
    nucl.__v_isShallow = true

    // Intercept notifications to trigger Vue's reactivity system
    // 1. Patch notify() for manual calls and compatibility
    const originalNotify = nucl.notify
    nucl.notify = function (this: any, ...args: any[]) {
      originalNotify.apply(this, args)
      trigger(this, TriggerOpTypes.SET, 'value')
    }

    // 2. Add a listener via up() to catch all updates (including setValue)
    // This is the most robust way to ensure Vue knows about the change.
    nucl.up(() => {
      trigger(nucl, TriggerOpTypes.SET, 'value')
    })
  },

  properties: {
    value: {
      get(this: any) {
        // console.log('DEBUG: get', this.id || 'unknown')
        // Collect dependency for Vue
        track(this, TrackOpTypes.GET, 'value')

        // SyncNode (link-state) ghost handling
        if (this.$meta?.isGhost) return undefined

        // Standard Nucleon value resolution (matches NuclearProto)
        if (!this._isDeep) return this._value
        return this._state !== undefined ? this._state : this._value
      },
      set(this: any, newValue: any) {
        // console.log('DEBUG: set', this.id || 'unknown', newValue)
        // Update the underlying private field
        this._value = newValue
        // Use the nucleon function itself to update (handles all logic/validation/cascades)
        this(newValue)
      },
      enumerable: true,
      configurable: true,
    },
  },
}

/**
 * Globally enables Vue 3 magic reactivity for Alaq.
 * Call this once in your main.ts before any atoms are created.
 */
export function setupMagicVue(options: { global?: boolean; kinds?: string[] } = { global: true }) {
  if (options.global) {
    // Standard kinds in v6
    defineKind('+', VueNuclearPlugin)
    defineKind('atom', VueNuclearPlugin)
    defineKind('nucleon', VueNuclearPlugin)
  }

  if (options.kinds) {
    for (const kind of options.kinds) {
      defineKind(kind, VueNuclearPlugin)
    }
  }
}
