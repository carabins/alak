import quarkProto from '@alaq/quark/prototype'
import {INucleonCore} from "./INucleon";

// 1. Base prototype as a PLAIN OBJECT.
// Since we are flattening properties onto the function instance, we don't need inheritance chain to Function.prototype here.
const BaseProto = {}

// 2. Mixin Quark methods (up, down, pipe, silent, etc.)
Object.assign(BaseProto, quarkProto)

// Override 'up' to ensure it works with Nucl's value/state
Object.defineProperty(BaseProto, 'up', {
  value: function(this: INucleonCore, listener: any) {
    // Initialize edges if needed (mimic Quark lazy init)
    const q = this as any
    if (!q._edges) {
      q._edges = []
      q._flags |= 1 // IS_AWAKE
    }
    q._edges.push(listener)

    // Immediate call if value exists
    if (q._value !== undefined) {
      listener(this.value, this)
    }
    return this
  },
  writable: true,
  configurable: true
})

// 3. Define Smart Value Accessor
Object.defineProperty(BaseProto, 'value', {
  get(this: INucleonCore) {
    if (!this._isDeep) return this._value
    return this._state !== undefined ? this._state : this._value
  },
  set(this: INucleonCore, newValue: any) {
    // Manually update _value and clear IS_EMPTY (8) to ensure state is correct
    // even if setValue returns early due to dedup logic.
    this._value = newValue
    const q = this as any
    if (q._flags) {
        q._flags &= ~8 // Clear IS_EMPTY
    }
    
    // Delegate to Nucl function call for full lifecycle (hooks, bus, etc.)
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
    if (q._edges) {
      for (let i = 0; i < q._edges.length; i++) {
        q._edges[i](q._value)
      }
    }
    if (q._flags & 8) {
       if (q._bus) {
         q._bus.safeEmit(q._changeEventName || 'change', { id: q.id, value: q._value })
       }
    }
  },
  writable: true,
  configurable: true
})

export const NuclearProto = BaseProto
