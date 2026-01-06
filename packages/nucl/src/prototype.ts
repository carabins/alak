import quarkProto from '@alaq/quark/prototype'
import INucleusQuark from "./core";

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
    return this._value
  },
  set(value) {
    if (this._value !== value) {
      this._value = value
      this(value)
    }
  },
  enumerable: true,
  configurable: true
})

