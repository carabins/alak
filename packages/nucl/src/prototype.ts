import quarkProto from '@alaq/quark/prototype'
import {INucleonCore} from "./INucleon";

// 1. Base prototype as a PLAIN OBJECT.
// Since we are flattening properties onto the function instance, we don't need inheritance chain to Function.prototype here.
const BaseProto = {}

// 2. Mixin Quark methods (up, down, pipe, silent, etc.)
Object.assign(BaseProto, quarkProto)

// 3. Define Smart Value Accessor
Object.defineProperty(BaseProto, 'value', {
  get(this: INucleonCore) {
    if (!this._isDeep) return this._value
    return this._state !== undefined ? this._state : this._value
  },
  set(this: INucleonCore, newValue: any) {
    if (this._value === newValue) return
    this._value = newValue
    this(newValue) 
  },
  enumerable: true,
  configurable: true
})

// 4. Override decay
Object.defineProperty(BaseProto, 'decay', {
  value: function(this: INucleonCore) {
    if (this._reg && this._reg.onDecay) {
        this._reg.onDecay(this)
    }
    return quarkProto.decay.call(this)
  },
  writable: true,
  configurable: true
})

// 5. Add notify
Object.defineProperty(BaseProto, 'notify', {
  value: function(this: INucleonCore) {
    const q = this as any
    // Notify direct listeners (stored in _edges in Quark)
    if (q._edges) {
      for (let i = 0; i < q._edges.length; i++) {
        q._edges[i](q._value)
      }
    }
    // Notify bus if enabled (checking EMIT_CHANGES flag 0b1000 - bit 3)
  },
  writable: true,
  configurable: true
})

export const NuclearProto = BaseProto