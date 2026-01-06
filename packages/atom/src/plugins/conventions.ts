import { AtomPlugin } from '../types'

export const ConventionsPlugin: AtomPlugin = {
  name: 'conventions',

  onInit(atom) {
    // Collect all keys from instance and prototype chain
    const keys = new Set<string>()
    let obj = atom
    while (obj && obj !== Object.prototype) {
      Object.getOwnPropertyNames(obj).forEach(k => keys.add(k))
      obj = Object.getPrototypeOf(obj)
    }

    keys.forEach(key => {
      // 1. Reactivity: _prop_up(val)
      const upMatch = key.match(/^_(.+)_up$/)
      if (upMatch) {
        const propName = upMatch[1]
        // @ts-ignore
        const method = atom[key]
        
        // @ts-ignore
        const nucl = atom[`$${propName}`]
        
        if (nucl && typeof method === 'function') {
           nucl.up((val: any) => method.call(atom, val))
        }
        return
      }

      // 2. Bus: _on_EVENT(data)
      const onMatch = key.match(/^_on_(.+)$/)
      if (onMatch) {
        const eventName = onMatch[1]
        // @ts-ignore
        const method = atom[key]
        
        if (typeof method === 'function') {
          // Optimization: Strict unwrapping. 
          // QuantumBus guarantees { event, data } structure.
          const listener = (payload: any) => {
             // Direct access is faster and safer (no magic)
             const data = payload?.data
             method.call(atom, data)
          }
          atom.$.bus.on(eventName, listener)
        }
      }
    })
  }
}
