import { AtomPlugin } from '../types'
import { fusion } from '@alaq/nucl'
import { Nu } from '@alaq/nucl'

export const ComputedPlugin: AtomPlugin = {
  name: 'computed',

  onInit(atom) {
    const context = atom.$ as any
    const nuclMap = context._nucl


    let proto = Object.getPrototypeOf(atom)

    // Keep track of processed keys to avoid overriding child getters with parent ones
    const processedKeys = new Set<string>()

    while (proto && proto !== Object.prototype) {
      const descriptors = Object.getOwnPropertyDescriptors(proto)

      Object.entries(descriptors).forEach(([key, desc]) => {
        if (processedKeys.has(key)) return

        // Find getters (excluding internal ones)
        if (desc.get && !key.startsWith('$') && key !== 'constructor') {
          processedKeys.add(key)

          // Analyze dependencies
          const deps = new Set<string>()
          context._tracking(deps)

          try {
            desc.get.call(atom)
          } catch (e) {
            // TODO: Error swallowing warning
          } finally {
            context._tracking(null)
          }

          //@ts-ignore Create Fusion
          if (deps.size > 0) {
            const sourceNucls = Array.from(deps).map(k => nuclMap.get(k))
            const f = fusion(...sourceNucls).alive(() => desc.get!.call(atom))
            nuclMap.set(key, f)
          } else {
            const staticValue = desc.get!.call(atom)
            nuclMap.set(key, Nu({ value: staticValue }))
          }
        }
      })

      proto = Object.getPrototypeOf(proto)
    }
  }
}
