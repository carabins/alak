import quarkProto from '@alaq/quark/prototype'
import INucleusQuark from "./core";
import {PluginDeepChangeHandler} from "@alaq/nucl/INucleonPlugin";
import {TrackTypes, TriggerOpTypes} from "@alaq/deep-state/types";
import {firstWatch} from "@alaq/nucl/deep-state";

export const NuclearProto = Object.assign({
  decay(this: INucleusQuark<any>) {
    for (const h of this._reg.decayHooks) {
      h(this)
    }
    return quarkProto.decay.call(this)
  }
}, quarkProto)


// Define value getter for Nucl
Object.defineProperty(NuclearProto, 'value', {
  get() {
    if (this._isDeep) {
      this._reg.handleWatch(this, {
        value: this._value,
        type: TrackTypes.GET,
        target: this._state
      })
      return this._state
    }
    return this._value
  },
  set(value) {
    if (this._value != value) {
      if (this._isDeep) {
        const isObject = typeof value === 'object'
        this._isObject = isObject
        if (isObject) {
          this._state = this._watcher.deepWatch(value)
        } else {
          this._state = value
        }
        this._reg.handleWatch(this,
          {
            value,
            oldValue: this._value,
            type: TriggerOpTypes.SET,
            target: this._state
          }
        )
      }
      this._value = value
      this(value)
    }
  },
  enumerable: true,
  configurable: true
})

