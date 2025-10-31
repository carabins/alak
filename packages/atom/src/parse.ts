/**
 * @alaq/atom - Model parsing utilities
 */

import type { ParsedModel, AtomPlugin } from './types'
import { extractMarkers } from './markers'

/**
 * Parse model into properties, methods, and getters
 *
 * Handles both class constructors and plain objects
 */
export function parseModel(
  model: any,
  plugins: AtomPlugin[],
  constructorArgs: any[] = []
): ParsedModel & { markedProperties: Record<string, any[]> } {
  const properties: Record<string, any> = {}
  const methods: Record<string, Function> = {}
  const getters: Record<string, Function> = {}
  const markedProperties: Record<string, any[]> = {}

  const isClass = typeof model === 'function'

  if (isClass) {
    // Create instance WITHOUT calling constructor
    const instance = Object.create(model.prototype)

    // IMPORTANT: Class fields are NOT on prototype - need to get defaults
    // Create instance with provided constructor args to get field initializers
    let tempInstance
    try {
      tempInstance = new model(...constructorArgs)
    } catch (e) {
      // Constructor might fail - create without calling constructor
      tempInstance = Object.create(model.prototype)
    }

    // Extract properties from temp instance (class fields)
    Object.keys(tempInstance).forEach(key => {
      const value = tempInstance[key]
      const parsed = parsePropertyValue(value, plugins)

      properties[key] = parsed.value
      if (parsed.markers.length > 0) {
        markedProperties[key] = parsed.markers
      }
    })

    // Extract methods and getters from prototype chain
    let proto = model.prototype
    while (proto && proto !== Object.prototype) {
      const protoKeys = Object.getOwnPropertyNames(proto)
      protoKeys.forEach(key => {
        if (key === 'constructor') return

        const descriptor = Object.getOwnPropertyDescriptor(proto, key)

        if (descriptor?.get) {
          // Getter
          if (!getters[key]) {
            getters[key] = descriptor.get
          }
        } else if (typeof proto[key] === 'function') {
          // Method
          if (!methods[key]) {
            methods[key] = proto[key]
          }
        }
      })

      proto = Object.getPrototypeOf(proto)
    }
  } else {
    // Plain object
    Object.keys(model).forEach(key => {
      const value = model[key]

      if (typeof value === 'function') {
        methods[key] = value
      } else {
        const parsed = parsePropertyValue(value, plugins)
        properties[key] = parsed.value
        if (parsed.markers.length > 0) {
          markedProperties[key] = parsed.markers
        }
      }
    })
  }

  return {
    properties,
    methods,
    getters,
    markedProperties
  }
}

/**
 * Parse property value - extract markers if present
 */
function parsePropertyValue(
  value: any,
  plugins: AtomPlugin[]
): { value: any; markers: any[] } {
  const markers = extractMarkers(value)

  if (markers.length > 0) {
    // Find actual value from markers
    let finalValue = undefined
    for (const marker of markers) {
      if (marker?.value !== undefined) {
        finalValue = marker.value
        break
      }
    }
    return { value: finalValue, markers }
  }

  // Check if single marker (not composition or array)
  for (const plugin of plugins) {
    if (plugin.detectMarker?.(value)) {
      return {
        value: value.value !== undefined ? value.value : value,
        markers: [value]
      }
    }
  }

  return { value, markers: [] }
}

/**
 * Analyze getter dependencies through tracking
 */
export function analyzeGetterDeps(
  getter: Function,
  propertyKeys: string[]
): string[] {
  const deps: string[] = []

  // Create tracking proxy
  const trackingProxy = new Proxy({}, {
    get(_, key: string) {
      if (typeof key === 'string' && propertyKeys.includes(key)) {
        if (!deps.includes(key)) {
          deps.push(key)
        }
      }
      return undefined // doesn't matter, we just track access
    }
  })

  // Call getter to track dependencies
  try {
    getter.call(trackingProxy)
  } catch (e) {
    // Ignore errors - deps already tracked
  }

  return deps
}

/**
 * Sort getters by dependency levels (topological sort)
 *
 * Returns array of levels: [[level0getters], [level1getters], ...]
 */
export function sortGettersByLevel(
  getters: Record<string, Function>,
  propertyKeys: string[]
): Array<{ key: string; getter: Function; deps: string[] }[]> {
  const allKeys = [...propertyKeys, ...Object.keys(getters)]

  // Analyze all getter dependencies
  const getterDeps = new Map<string, string[]>()
  Object.entries(getters).forEach(([key, getter]) => {
    const deps = analyzeGetterDeps(getter, allKeys)
    getterDeps.set(key, deps)
  })

  // Topological sort into levels
  const levels: Array<{ key: string; getter: Function; deps: string[] }[]> = []
  const processed = new Set<string>(propertyKeys) // properties are level 0
  const remaining = new Map(getterDeps)

  while (remaining.size > 0) {
    const currentLevel: Array<{ key: string; getter: Function; deps: string[] }> = []

    // Find getters whose deps are all processed
    for (const [key, deps] of remaining.entries()) {
      const allDepsProcessed = deps.every(dep => processed.has(dep))
      if (allDepsProcessed) {
        currentLevel.push({
          key,
          getter: getters[key],
          deps
        })
      }
    }

    if (currentLevel.length === 0) {
      // Circular dependency detected
      console.warn('[atom] Circular dependency in getters:', Array.from(remaining.keys()))
      break
    }

    // Mark as processed
    currentLevel.forEach(({ key }) => {
      processed.add(key)
      remaining.delete(key)
    })

    levels.push(currentLevel)
  }

  return levels
}
