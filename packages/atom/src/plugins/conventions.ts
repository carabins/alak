import { AtomPlugin } from '../types'

export const ConventionsPlugin: AtomPlugin = {
  name: 'conventions',

  onInit(atom) {
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
           // Subscribing to Nucl updates is handled by Nucl internal mechanism,
           // but technically Nucl listeners are usually cleaned up on Nucl decay automatically.
           // However, let's verify if we need to track this.
           // Nucl.up returns unsubscribe function.
           const unsub = nucl.up((val: any) => method.call(atom, val))
           atom.$.addDisposer(unsub)
        }
        return
      }

      // 2. Bus: _on_EVENT(payload)
      const onMatch = key.match(/^_on_(.+)$/)
      if (onMatch) {
        const eventName = onMatch[1]
        // @ts-ignore
        const method = atom[key]
        
        if (typeof method === 'function') {
          // Use the safe subscription method from context that auto-cleans on decay
          atom.$.on(eventName, (payload: any) => method.call(atom, payload))
        }
      }
    })
  }
}