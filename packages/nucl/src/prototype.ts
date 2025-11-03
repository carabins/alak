import {DEEP_TRACKING, quarkProto} from '@alaq/quark'
import INucleusQuark from "./types/core";

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
    return (this._flags & DEEP_TRACKING) ? this._value : this._proxy
  },
  set(value) {
    this._value = value
    if (this._flags & DEEP_TRACKING) {
      this._proxy = value
    }
  },
  enumerable: true,
  configurable: true
})
