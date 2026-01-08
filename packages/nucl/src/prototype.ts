import quarkProto from '@alaq/quark/prototype'
import {INucleonCore} from "./INucleon";



const BaseProto = {}


Object.assign(BaseProto, quarkProto)


Object.defineProperty(BaseProto, 'up', {
  value: function(this: INucleonCore, listener: any) {
    
    const q = this as any
    if (!q._edges) {
      q._edges = []
      q._flags |= 1 
    }
    q._edges.push(listener)

    
    if (q._value !== undefined) {
      listener(this.value, this)
    }
    return this
  },
  writable: true,
  configurable: true
})


Object.defineProperty(BaseProto, 'value', {
  get(this: INucleonCore) {
    if (!this._isDeep) return this._value
    return this._state !== undefined ? this._state : this._value
  },
  set(this: INucleonCore, newValue: any) {
    
    
    this._value = newValue
    const q = this as any
    if (q._flags) {
        q._flags &= ~8 
    }
    
    
    this(newValue)
  },
  enumerable: true,
  configurable: true
})


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
