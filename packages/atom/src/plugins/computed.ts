import { AtomPlugin } from '../types'

export const ComputedPlugin: AtomPlugin = {
  name: 'computed',

  onAnalyze({ model, schema }) {
    let proto = model.prototype
    const processedKeys = new Set<string>()
    // Store groups of properties per prototype level
    const hierarchy: Array<Array<{ key: string, descriptor: PropertyDescriptor }>> = []

    while (proto && proto !== Object.prototype) {
      const levelProps: Array<{ key: string, descriptor: PropertyDescriptor }> = []
      const descriptors = Object.getOwnPropertyDescriptors(proto)

      Object.entries(descriptors).forEach(([key, desc]) => {
        if (processedKeys.has(key)) return
        processedKeys.add(key)

        // Find getters (excluding internal ones)
        if (desc.get && !key.startsWith('$') && key !== 'constructor') {
          levelProps.push({ key, descriptor: desc })
        }
      })
      
      if (levelProps.length > 0) {
        hierarchy.push(levelProps)
      }

      proto = Object.getPrototypeOf(proto)
    }
    
    // Add to schema in reverse order of hierarchy (Base -> Derived)
    // But keep order WITHIN each level (as defined in class)
    for (let i = hierarchy.length - 1; i >= 0; i--) {
      schema.computed.push(...hierarchy[i])
    }
  }
}
