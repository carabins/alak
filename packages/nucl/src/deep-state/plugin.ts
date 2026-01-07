import { INucleonPlugin } from '../INucleonPlugin'
import { createState } from "@alaq/deep-state"
import { TrackTypes, TriggerOpTypes, DeepOptions } from "@alaq/deep-state/types"
import { INucleonCore } from '../INucleon'

/**
 * Setup the deep state watcher on a Nucl instance
 */
function setupDeepState(n: INucleonCore, options: any, reg: any) {
  n._watcher = createState((value, from) => {
      reg.handleWatch(n, from)
      // Force update because object reference hasn't changed (dedup would block it)
      if (typeof n.notify === 'function') {
        n.notify()
      }
    },
    // Pass options to deep-state (e.g. deepArrays: false)
    options
  )
  n._isDeep = true
}

/**
 * Factory for creating a Deep State plugin with specific options.
 */
export function createDeepPlugin(config: DeepOptions = {}): INucleonPlugin {
  return {
    name: 'deep-state',
    symbol: Symbol('deep-state'),
    
    // High priority to wrap value ASAP
    order: 100,

    onCreate(n: INucleonCore) {
      setupDeepState(n, config, n._reg)
    },

    onBeforeChange(n: INucleonCore, newValue: any) {
      if (n._isDeep) {
         const isObject = typeof newValue === 'object' && newValue !== null
         const oldValue = n._value // access raw value directly

         if (isObject) {
           n._state = n._watcher.deepWatch(newValue)
         } else {
           n._state = newValue
         }

         // Notify that the root value is being replaced (SET operation)
         if (n._reg && n._reg.handleWatch) {
            n._reg.handleWatch(n, {
              value: newValue,
              oldValue: oldValue,
              type: TriggerOpTypes.SET,
              target: n._state
            })
         }
      }
    },

    properties: {
      value: {
        get(this: INucleonCore) {
          if (this._isDeep) {
            // Notify GET operation for tracking
            if (this._reg && this._reg.handleWatch) {
               this._reg.handleWatch(this, {
                 value: this._value,
                 type: TrackTypes.GET,
                 target: this._state
               })
            }
            return this._state !== undefined ? this._state : this._value
          }
          return this._value
        },
        set(this: INucleonCore, value: any) {
          this._value = value
          // Just call the function. onBeforeChange will handle state update.
          // @ts-ignore
          this(value)
        },
        enumerable: true,
        configurable: true
      }
    }
  }
}

/**
 * Default instance with default options (deepObjects: true, deepArrays: false usually)
 * Retained for backward compatibility.
 */
export const deepStatePlugin = createDeepPlugin()