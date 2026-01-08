import { INucleonPlugin } from '../INucleonPlugin'
import { createState } from "@alaq/deep-state"
import { TrackTypes, TriggerOpTypes, DeepOptions } from "@alaq/deep-state/types"
import { INucleonCore } from '../INucleon'


function setupDeepState(n: INucleonCore, options: any, reg: any) {
  n._watcher = createState((value, from) => {
      reg.handleWatch(n, from)
      
      if (typeof n.notify === 'function') {
        n.notify()
      }
    },
    
    options
  )
  n._isDeep = true
}


export function createDeepPlugin(config: DeepOptions = {}): INucleonPlugin {
  return {
    name: 'deep-state',
    symbol: Symbol('deep-state'),
    
    
    order: 100,

    onCreate(n: INucleonCore) {
      setupDeepState(n, config, n._reg)
    },

    onBeforeChange(n: INucleonCore, newValue: any) {
      if (n._isDeep) {
         const isObject = typeof newValue === 'object' && newValue !== null
         const oldValue = n._value 

         if (isObject) {
           n._state = n._watcher.deepWatch(newValue)
         } else {
           n._state = newValue
         }

         
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
          
          
          this(value)
        },
        enumerable: true,
        configurable: true
      }
    }
  }
}


export const deepStatePlugin = createDeepPlugin()