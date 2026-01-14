/**
 * StateReactivePlugin - Makes atom.state behave like Vue reactive()
 *
 * NO additional reactive instances created - uses Proxy to mimic Vue reactive behavior
 * Deep reactivity for objects and arrays with proper toRaw() support
 *
 * @packageDocumentation
 */

import { track, trigger, TrackOpTypes, TriggerOpTypes, toRaw, reactive, isReactive } from '@vue/reactivity'
import type { AtomPlugin } from '@alaq/atom'

const RAW_STATE_KEY = Symbol('atom:vue:rawState')
const SUBSCRIBERS_KEY = Symbol('atom:vue:subscribers')
const DEEP_REACTIVE_KEY = Symbol('atom:vue:deepReactive')

/**
 * Transform atom.state into Vue reactive proxy
 *
 * Features:
 * - Deep reactivity for nested objects/arrays
 * - toRaw() returns clean data (no Vue proxies)
 * - Works with Vue watch, computed, template
 * - No duplicate reactive objects
 */
export const StateReactivePlugin: AtomPlugin = {
  symbol: Symbol.for('vue-state-reactive'),
  name: 'vue-state-reactive',

  onCreate(atom) {
    const internal = atom._internal

    // Store raw state object (clean data)
    const rawState: any = {}
    internal[RAW_STATE_KEY] = rawState

    // Track subscriptions for cleanup
    const subscribers: Map<string, () => void> = new Map()
    internal[SUBSCRIBERS_KEY] = subscribers

    // Track which properties have deep reactive values
    const deepReactiveProps = new Set<string>()
    internal[DEEP_REACTIVE_KEY] = deepReactiveProps

    // Initialize all properties from atom.core
    // Properties will be initialized lazily on first access via Proxy.get

    function initializeProperty(key: string) {
      if (key in rawState) {
        return // Already initialized
      }

      const quark = atom.core[key]
      if (!quark) {
        return
      }

      const value = quark.value
      rawState[key] = value

      // If value is object/array, make it reactive
      if (isComplexValue(value)) {
        rawState[key] = reactive(value)
        deepReactiveProps.add(key)
      }

      // Subscribe to quark changes
      const unsubscribe = quark.up((newValue: any) => {
        const currentValue = rawState[key]

        // Handle deep reactive values
        if (deepReactiveProps.has(key)) {
          // If value is complex and changed, make it reactive
          if (isComplexValue(newValue) && currentValue !== newValue) {
            rawState[key] = reactive(newValue)
            trigger(rawState, TriggerOpTypes.SET, key, rawState[key], currentValue)
          } else if (!isComplexValue(newValue)) {
            // Value became primitive
            rawState[key] = newValue
            deepReactiveProps.delete(key)
            trigger(rawState, TriggerOpTypes.SET, key, newValue, currentValue)
          }
          // If complex value was mutated internally, Vue reactive already tracks it
        } else {
          // Simple value changed
          if (rawState[key] !== newValue) {
            rawState[key] = newValue
            trigger(rawState, TriggerOpTypes.SET, key, newValue, currentValue)
          }
        }
      })

      subscribers.set(key, unsubscribe)
    }

    // Create Proxy that mimics Vue reactive
    const reactiveState = new Proxy(rawState, {
      get(target, key: string | symbol) {
        // Vue internal flags
        if (key === '__v_isReactive') return true
        if (key === '__v_isReadonly') return false
        if (key === '__v_isShallow') return false
        if (key === '__v_raw') return rawState
        if (key === '__v_skip') return false

        // Skip symbols
        if (typeof key === 'symbol') return target[key]

        // Lazy initialize property if not yet in rawState
        if (!(key in target)) {
          initializeProperty(key as string)
        }

        // Track access for Vue reactivity
        track(target, TrackOpTypes.GET, key)

        return target[key]
      },

      set(target, key: string, newValue: any) {
        const oldValue = target[key]

        // Handle complex values (objects/arrays)
        if (isComplexValue(newValue)) {
          // Make new value reactive if not already
          if (!isReactive(newValue)) {
            newValue = reactive(newValue)
          }
          deepReactiveProps.add(key)
        } else {
          deepReactiveProps.delete(key)
        }

        // Update raw state
        target[key] = newValue

        // Update quark (with raw value, not reactive proxy)
        const quark = atom.core[key]
        if (quark) {
          const rawValue = toRaw(newValue)
          if (quark.value !== rawValue) {
            quark(rawValue)
          }
        }

        // Trigger Vue updates
        trigger(target, TriggerOpTypes.SET, key, newValue, oldValue)

        return true
      },

      deleteProperty(target, key: string) {
        const hadKey = key in target
        const oldValue = target[key]
        delete target[key]
        deepReactiveProps.delete(key)

        // Unsubscribe from quark changes
        const unsubscribe = subscribers.get(key)
        if (unsubscribe) {
          unsubscribe()
          subscribers.delete(key)
        }

        if (hadKey) {
          trigger(target, TriggerOpTypes.DELETE, key, undefined, oldValue)
        }

        return true
      },

      has(target, key: string) {
        const result = key in target
        track(target, TrackOpTypes.HAS, key)
        return result
      },

      ownKeys(target) {
        track(target, TrackOpTypes.ITERATE, Array.isArray(target) ? 'length' : Symbol.iterator as any)
        return Reflect.ownKeys(target)
      }
    })

    // Replace atom.state with reactive proxy
    Object.defineProperty(atom, 'state', {
      get() {
        return reactiveState
      },
      configurable: true,
      enumerable: true
    })

    // Add .rawState() method for clean data export
    atom.rawState = () => {
      const raw: any = {}
      Object.keys(rawState).forEach(key => {
        raw[key] = toRaw(rawState[key])
      })
      return raw
    }
  },

  onDecay(atom) {
    const internal = atom._internal

    // Unsubscribe from all quarks
    const subscribers = internal[SUBSCRIBERS_KEY] as Map<string, () => void>
    if (subscribers) {
      subscribers.forEach(unsubscribe => unsubscribe())
      subscribers.clear()
    }

    delete internal[RAW_STATE_KEY]
    delete internal[SUBSCRIBERS_KEY]
    delete internal[DEEP_REACTIVE_KEY]
  }
}

/**
 * Check if value is complex (object/array) and should be reactive
 */
function isComplexValue(value: any): boolean {
  return value !== null && typeof value === 'object'
}
