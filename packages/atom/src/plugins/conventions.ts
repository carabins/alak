import { AtomPlugin } from '../types'

export const ConventionsPlugin: AtomPlugin = {
  name: 'conventions',

  onAnalyze({ model, schema }) {
    let proto = model.prototype
    const processedKeys = new Set<string>()

    while (proto && proto !== Object.prototype) {
      Object.getOwnPropertyNames(proto).forEach(key => {
        if (processedKeys.has(key)) return
        processedKeys.add(key)

        // 1. Reactivity: _prop_up(val)
        const upMatch = key.match(/^_(.+)_up$/)
        if (upMatch) {
          schema.hooks.push({ methodKey: key, type: 'up', target: upMatch[1] })
          return
        }

        // 2. Bus: _on_EVENT(payload)
        if (key.startsWith('_on_')) {
          schema.hooks.push({ methodKey: key, type: 'on', target: key.slice(4) })
        }
      })
      proto = Object.getPrototypeOf(proto)
    }
  }
}