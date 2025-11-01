/**
 * @alaq/nucl/vue-integration - Vue integration for Nucl
 * 
 * Provides seamless integration between Nucl and Vue's reactivity system
 * with optimal performance and minimal overhead.
 */

import { track, trigger, TrackOpTypes, TriggerOpTypes } from '@vue/reactivity'
import type { NuclPlugin } from '../types'

// Symbol for Vue integration plugin
const VUE_INTEGRATION_PLUGIN_SYMBOL = Symbol('nucl:vue-integration')

/**
 * Vue integration plugin options
 */
export interface VueIntegrationPluginOptions {
  /**
   * Whether to enable deep reactivity (default: true)
   */
  deep?: boolean
  
  /**
   * Custom equality function for deep comparisons
   */
  isEqual?: (a: any, b: any) => boolean
}

/**
 * Creates a Vue integration plugin for Nucl
 * 
 * This plugin makes Nucl instances fully compatible with Vue's reactivity system
 * by creating Vue-compatible proxies that properly track dependencies and notify
 * Vue when changes occur.
 * 
 * @param options - Configuration options for Vue integration
 * @returns A NuclPlugin that integrates with Vue's reactivity system
 * 
 * @example
 * ```ts
 * import { Nucl } from '@alaq/nucl'
 * import { vueIntegrationPlugin } from '@alaq/nucl/vue-integration'
 * 
 * const nucl = Nucl({ 
 *   value: { count: 0 },
 *   plugins: [vueIntegrationPlugin()] 
 * })
 * 
 * // Now Vue effects will properly track and respond to nucl changes
 * ```
 */
export const vueIntegrationPlugin = (options: VueIntegrationPluginOptions = {}): NuclPlugin => {
  const { 
    deep = true, 
    isEqual = (a, b) => a === b 
  } = options

  return {
    symbol: VUE_INTEGRATION_PLUGIN_SYMBOL,
    
    /**
     * Called when a Nucl instance is created
     */
    onCreate(nucl: any) {
      // Initialize Vue integration metadata
      nucl._vueIntegration = {
        reactiveTargets: new Map<string, any>(), // Separate target for each property
        cache: new Map<string, any>(), // Cache for nested proxies
        deep,
        isEqual
      }
      
      // Subscribe to atom's bus to track changes made via atom.core
      const listener = ({ key, value }: { key: string, value: any }) => {
        // Trigger Vue reactivity when core value changes
        const reactiveTarget = nucl._vueIntegration.reactiveTargets.get(key)
        if (reactiveTarget) {
          trigger(reactiveTarget, TriggerOpTypes.SET, key, value, undefined)
        }
      }
      
      // Make sure bus is available before subscribing
      if (nucl.bus && typeof nucl.bus.on === 'function') {
        nucl.bus.on('NUCLEUS_CHANGE', listener)
      }

      // Store unsubscribe function to be used in onDecay
      (nucl as any)._unsubscribeBus = () => {
        if (nucl.bus && typeof nucl.bus.off === 'function') {
          nucl.bus.off('NUCLEUS_CHANGE', listener)
        }
      }
    },
    
    /**
     * Wrap the state to make it Vue-compatible
     */
    wrapState(originalState: any, atom: any) {
      // Get all keys from both properties and computed for processing
      const allKeys = [
        ...Object.keys(atom._internal.properties || {}),
        ...Object.keys(atom._internal.computed || {})
      ];
      
      const allKeysSet = new Set(allKeys)

      // Create a new Proxy that includes all necessary traps for proper functionality
      return new Proxy({}, {
        get(target, key: string | symbol) {
          // Vue internal flags
          if (key === '__v_isReactive') return true
          if (key === '__v_isReadonly') return false
          if (key === '__v_isShallow') return false
          if (key === '__v_raw') return originalState
          if (key === '__v_skip') return false

          // For regular properties, return from original state
          if (typeof key === 'string' && allKeysSet.has(key)) {
            // Create reactive target for this property if it doesn't exist
            if (!atom._vueIntegration.reactiveTargets.has(key)) {
              atom._vueIntegration.reactiveTargets.set(key, {})
            }
            const reactiveTarget = atom._vueIntegration.reactiveTargets.get(key)
            
            // For Vue reactivity tracking
            track(reactiveTarget, TrackOpTypes.GET, key)

            return originalState[key as string]
          }

          return undefined
        },

        set(target, key: string, newValue: any) {
          // Only handle known properties
          if (allKeysSet.has(key)) {
            // Get old value for Vue reactivity
            const oldValue = originalState[key as string]
            
            // Update original state
            originalState[key as string] = newValue
            
            // Update Nucl core
            atom.core[key](newValue)
            
            // Create reactive target for this property if it doesn't exist
            if (!atom._vueIntegration.reactiveTargets.has(key)) {
              atom._vueIntegration.reactiveTargets.set(key, {})
            }
            const reactiveTarget = atom._vueIntegration.reactiveTargets.get(key)
            
            // Trigger Vue reactivity
            trigger(reactiveTarget, TriggerOpTypes.SET, key, newValue, oldValue)
            
            return true
          }
          
          return false
        },

        has(target, key: string) {
          // Check if key exists in the atom's internal properties or computed
          const hasProperty = allKeysSet.has(key)

          if (hasProperty) {
            // Create reactive target for this property if it doesn't exist
            if (!atom._vueIntegration.reactiveTargets.has(key)) {
              atom._vueIntegration.reactiveTargets.set(key, {})
            }
            const reactiveTarget = atom._vueIntegration.reactiveTargets.get(key)
            
            track(reactiveTarget, TrackOpTypes.HAS, key)
          }
          
          return hasProperty
        },

        ownKeys(target) {
          // Track iteration dependency for all keys
          for (const key of allKeys) {
            // Create reactive target for this property if it doesn't exist
            if (!atom._vueIntegration.reactiveTargets.has(key)) {
              atom._vueIntegration.reactiveTargets.set(key, {})
            }
            const reactiveTarget = atom._vueIntegration.reactiveTargets.get(key)
            
            track(reactiveTarget, TrackOpTypes.ITERATE, key)
          }
          
          return allKeys
        },

        getOwnPropertyDescriptor(target, key: string) {
          // Required for Object.keys to work properly with Proxy
          if (allKeysSet.has(key as string)) {
            // Create reactive target for this property if it doesn't exist
            if (!atom._vueIntegration.reactiveTargets.has(key)) {
              atom._vueIntegration.reactiveTargets.set(key, {})
            }
            const reactiveTarget = atom._vueIntegration.reactiveTargets.get(key)
            
            track(reactiveTarget, TrackOpTypes.GET, key)
            
            return {
              value: originalState[key],
              enumerable: true,
              configurable: true
            }
          }
          return undefined
        }
      })
    },
    
    /**
     * Called when Nucl instance is disposed
     */
    onDecay(atom: any) {
      // Unsubscribe from bus to prevent memory leaks
      if (atom._unsubscribeBus && typeof atom._unsubscribeBus === 'function') {
        atom._unsubscribeBus()
      }
      
      // Clean up resources
      if (atom._vueIntegration) {
        atom._vueIntegration.reactiveTargets.clear()
        atom._vueIntegration.cache.clear()
        delete atom._vueIntegration
      }
      
      // Clean up unsubscribe function
      delete atom._unsubscribeBus
    }
  }
}