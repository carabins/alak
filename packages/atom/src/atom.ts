/**
 * @alaq/atom - Core Orchestrator
 */

import { quantumBus } from '@alaq/quark/quantum-bus'
import { Nu, combineKinds } from '@alaq/nucl'
import { kind, isOrbit, Orbit } from './orbit'
import { AtomInstance, AtomOptions, AtomPlugin, AtomContext } from './types'

// Global shared tracking context
let activeTrackingSet: Set<string> | null = null

// Unique ID counter for anonymous/clashing models
let atomUid = 0

// Helper to merge and resolve kind strings using Nucl's combineKinds
function getFinalKind(global: string | undefined, local: string): string {
  if (!global) return local
  
  const gParts = global.split(' ').filter(Boolean)
  const lParts = local.split(' ').filter(Boolean)
  
  // Check duplicates
  const duplicates = lParts.filter(p => gParts.includes(p))
  if (duplicates.length > 0) {
    console.warn(`[Atom] Warning: Duplicate kinds detected: "${duplicates.join(', ')}". Global: "${global}", Local: "${local}"`)
  }
  
  const allParts = Array.from(new Set([...gParts, ...lParts]))
  
  // combineKinds ensures all plugins are merged into a single registry
  // and returns a stable composite key (e.g. "a|b")
  return combineKinds(...allParts)
}

export function Atom<T extends new (...args: any[]) => any>(
  model: T,
  options: AtomOptions<InstanceType<T>> = {}
): AtomInstance<InstanceType<T>> {
  const baseName = options.name || model.name || 'Atom'
  const modelName = options.name ? baseName : `${baseName}#${++atomUid}`

  const realm = options.realm || 'root'
  const bus = quantumBus.getRealm(realm)
  
  const constructorArgs = options.constructorArgs || []
  const instance = new model(...constructorArgs)
  
  const nuclMap = new Map<string, any>()
  const methodCache = new Map<string, Function>()
  const disposers = new Set<() => void>()
  
  const context: AtomContext & { _tracking: (deps: Set<string> | null) => void } = {
    bus,
    options,
    _nucl: nuclMap,
    _tracking: (deps) => { activeTrackingSet = deps },
    
    addDisposer(fn: () => void) {
      disposers.add(fn)
    },

    on(event: string, listener: (data: any) => void) {
      bus.on(event, listener)
      const off = () => {
        bus.off(event, listener)
        disposers.delete(off)
      }
      disposers.add(off)
      return off
    },

    decay() {
      // 1. Run explicit disposers (including bus listeners)
      disposers.forEach(d => d())
      disposers.clear()

      // 2. Decay all properties
      nuclMap.forEach(n => n.decay?.())
      nuclMap.clear()
      methodCache.clear()

      // 3. Notify plugins (optional cleanup)
      if (options.plugins) {
        options.plugins.forEach(p => p.onDecay?.(proxy as any))
      }
    }
  }

  // 2. Initialize properties
  const allKeys = new Set<string>(Object.getOwnPropertyNames(instance))
  
  let proto = model.prototype
  while (proto && proto !== Object.prototype) {
    Object.getOwnPropertyNames(proto).forEach(k => allKeys.add(k))
    proto = Object.getPrototypeOf(proto)
  }

  allKeys.forEach(key => {
    if (key === 'constructor' || (typeof key === 'string' && key[0] === '$')) return

    let descriptor = Object.getOwnPropertyDescriptor(instance, key)
    let currentProto = model.prototype
    while (!descriptor && currentProto && currentProto !== Object.prototype) {
      descriptor = Object.getOwnPropertyDescriptor(currentProto, key)
      currentProto = Object.getPrototypeOf(currentProto)
    }

    if (descriptor?.get) return
    if (typeof instance[key] === 'function') return

    const initialValue = instance[key]
    
    // Determine Kind and Value
    let finalKind: string
    let finalValue: any
    let finalOptions: any = {}

    if (isOrbit(initialValue)) {
      finalValue = initialValue.value
      finalOptions = initialValue.options
      finalKind = getFinalKind(options.nuclearKind, initialValue.kind)
    } else {
      finalValue = initialValue
      finalKind = getFinalKind(options.nuclearKind, 'nucleus')
    }

    const eventName = options.emitChanges
      ? (options.emitChangeName || `${modelName}.${key}`)
      : undefined

    const nucl = Nu({
      kind: finalKind,
      value: finalValue,
      realm: realm,
      id: `${modelName}.${key}`,
      emitChanges: options.emitChanges,
      emitChangeName: eventName,
      ...finalOptions
    })

    nuclMap.set(key, nucl)

    Object.defineProperty(instance, key, {
      enumerable: !key.startsWith('_'),
      configurable: true,
      get() {
        if (activeTrackingSet) activeTrackingSet.add(key)
        return nucl.value
      },
      set(val) {
        nucl(val)
      }
    })
  })

  // 3. Create the Proxy
  const proxy = new Proxy(instance, {
    get(target, key: string) {
      if (typeof key !== 'string') return Reflect.get(target, key)
      if (key === '$') return context
      if (key[0] === '$') return nuclMap.get(key.slice(1))

      if (key in target) {
        const val = Reflect.get(target, key)
        if (typeof val === 'function') {
          if (methodCache.has(key)) return methodCache.get(key)
          const bound = val.bind(proxy)
          methodCache.set(key, bound)
          return bound
        }
        return val
      }
      return Reflect.get(target, key)
    },
    set(target, key, value) {
      return Reflect.set(target, key, value)
    }
  })

  // 4. Run Plugins
  const plugins = options.plugins !== undefined ? options.plugins : getDefaultPlugins()
  plugins.forEach(p => p.onInit?.(proxy as any))

  return proxy as any
}

function getDefaultPlugins(): AtomPlugin[] {
  const { ConventionsPlugin } = require('./plugins/conventions')
  const { ComputedPlugin } = require('./plugins/computed')
  return [ComputedPlugin, ConventionsPlugin]
}