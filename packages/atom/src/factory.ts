import { AtomInstance, AtomOptions, AtomPlugin, ModelSchema, AtomFactory, AtomContext, AtomicKindSelector } from './types'
import { Nu, combineKinds, fusion } from '@alaq/nucl'
import { quantumBus } from '@alaq/quark/quantum-bus'
import { CHANGE } from '@alaq/quark'
import { isOrbit } from './orbit'

// Global shared tracking context
let activeTrackingSet: Set<string> | null = null
let atomUid = 0

const schemaCache = new WeakMap<any, ModelSchema>()

// Helper to resolve plugins
function resolvePlugins(
  kindSelector: AtomicKindSelector | undefined, 
  localPlugins: AtomPlugin[] | undefined,
  registry: Map<string, AtomPlugin[]>,
  defaults: AtomPlugin[]
): AtomPlugin[] {
  let plugins = localPlugins
  
  if (!plugins && kindSelector) {
    const keys = kindSelector.split(' ').filter(Boolean)
    plugins = []
    for (const key of keys) {
      const p = registry.get(key)
      if (p) plugins.push(...p)
    }
  }
  
  return plugins || defaults
}

/**
 * Creates an optimized factory for a specific model class.
 * Performs static analysis (schema compilation) once.
 */
export function createAtomFactory<T extends new (...args: any[]) => any>(
  Model: T,
  compileOptions: AtomOptions<InstanceType<T>> & { 
    registry: Map<string, AtomPlugin[]>, 
    defaults: AtomPlugin[] 
  }
): AtomFactory<InstanceType<T>> {
  
  // 1. Resolve Plugins & Compile Schema
  const plugins = resolvePlugins(compileOptions.kind, compileOptions.plugins, compileOptions.registry, compileOptions.defaults)
  
  let schema = schemaCache.get(Model)
  if (!schema) {
    schema = { properties: [], computed: [], hooks: [] }
    // Run static analysis
    plugins.forEach(p => p.onAnalyze?.({ model: Model, schema: schema! }))
    schemaCache.set(Model, schema)
  }

  // 2. Return the optimized runtime constructor
  return function AtomConstructor(constructorArgs?: any[], runtimeOptions?: any) {
    const options = { ...compileOptions, ...runtimeOptions }
    const baseName = options.name || Model.name || 'Atom'
    const modelName = options.name ? baseName : `${baseName}#${++atomUid}`
    const realm = options.realm || 'root'
    const bus = quantumBus.getRealm(realm)
    
    // 2.1 Create Instance
    const instance = new Model(...(constructorArgs || options.constructorArgs || []))
    
    const nuclMap = new Map<string, any>()
    const methodCache = new Map<string, Function>()
    const disposers = new Set<() => void>()
    
    // 2.2 Create Context
    const context: AtomContext & { _tracking: (deps: Set<string> | null) => void } = {
      bus,
      options,
      _nucl: nuclMap,
      _tracking: (deps) => { activeTrackingSet = deps },
      addDisposer: (fn) => disposers.add(fn),
      on: (event, listener) => {
        bus.on(event, listener)
        const off = () => { bus.off(event, listener); disposers.delete(off) }
        disposers.add(off)
        return off
      },
      decay: () => {
        disposers.forEach(d => d())
        disposers.clear()
        nuclMap.forEach(n => n.decay?.())
        nuclMap.clear()
        methodCache.clear()
        plugins.forEach(p => p.onDecay?.(instance as any))
      }
    }

    // 2.3 Process Instance Properties (e.g. x = 0)
    const propDescriptors: PropertyDescriptorMap = {}
    
    // Scan keys created in constructor
    for (const key of Object.keys(instance)) {
      if (key.startsWith('$')) continue

      const initialValue = instance[key]
      let finalKind: string, finalValue: any, finalOptions: any = {}

      if (isOrbit(initialValue)) {
        finalValue = initialValue.value
        finalOptions = initialValue.options
        
        // Check for duplicates in kinds
        const globalKind = options.nuclearKind || 'nucleus'
        const localKind = initialValue.kind
        const gParts = globalKind.split(' ')
        const lParts = localKind.split(' ')
        const duplicates = lParts.filter(p => gParts.includes(p))
        if (duplicates.length > 0) {
           console.warn(`[Atom] Warning: Duplicate kinds detected: "${duplicates.join(', ')}". Global: "${globalKind}", Local: "${localKind}"`)
        }

        finalKind = combineKinds(globalKind, localKind)
      } else {
        finalValue = initialValue
        finalKind = options.nuclearKind || 'nucleus'
      }

      // If Lazy, we might skip creation here, but for now we do Eager for simplicity & speed
      const propScope = options.scope ? `${options.scope}.${key}` : undefined
      
      const nucl = Nu({
        kind: finalKind,
        value: finalValue,
        realm: realm,
        id: `${modelName}.${key}`,
        scope: propScope,
        emitChanges: options.emitChanges,
        ...finalOptions
      })

      nuclMap.set(key, nucl)

      // Define optimized getter/setter (Zero-Proxy)
      propDescriptors[key] = {
        enumerable: !key.startsWith('_'),
        configurable: true,
        get() {
          if (activeTrackingSet) activeTrackingSet.add(key)
          return nucl.value
        },
        set(val) { nucl(val) }
      }
      
      // Direct access $prop
      propDescriptors[`$${key}`] = {
        value: nucl,
        enumerable: false,
        configurable: true
      }
    }
    
    // Apply property descriptors immediately so Computed can see them
    Object.defineProperties(instance, propDescriptors)

    // 2.4 Process Computed Properties (from Schema)
    if (schema && schema.computed) {
      for (const item of schema.computed) {
        const { key, descriptor } = item
        
        // Analyze dependencies (JIT)
        const deps = new Set<string>()
        activeTrackingSet = deps
        try {
          descriptor.get!.call(instance)
        } catch (e) {} finally {
          activeTrackingSet = null
        }

        let nucl: any
        if (deps.size > 0) {
          const sourceNucls = Array.from(deps).map(k => nuclMap.get(k)).filter(Boolean)
          nucl = fusion(...sourceNucls).alive(() => descriptor.get!.call(instance))
        } else {
          // Static
          nucl = Nu({ value: descriptor.get!.call(instance) })
        }
        
        nuclMap.set(key, nucl)
        
        // Define immediately so dependent computeds can see it
        Object.defineProperty(instance, key, {
          enumerable: descriptor.enumerable,
          configurable: true,
          get() { 
            if (activeTrackingSet) activeTrackingSet.add(key)
            return nucl.value
          }
        })
        Object.defineProperty(instance, `$${key}`, { value: nucl, enumerable: false, configurable: true })
      }
    }

    // 2.6 Inject Context ($)
    Object.defineProperty(instance, '$', {
      value: context,
      enumerable: false,
      configurable: true
    })

    // 2.7 Wire Hooks (Conventions)
    if (schema && schema.hooks) {
      for (const hook of schema.hooks) {
        const method = (instance as any)[hook.methodKey]
        if (typeof method === 'function') {
          const bound = method.bind(instance)
          if (hook.type === 'up') {
            const targetNucl = nuclMap.get(hook.target)
            if (targetNucl) {
              const unsub = targetNucl.up(bound)
              context.addDisposer(unsub)
            }
          } else if (hook.type === 'on') {
            context.on(hook.target, bound)
          }
        }
      }
    }

    // 3. Create Proxy with bound methods
    const proxy = new Proxy(instance, {
      get(target, key: string) {
        if (typeof key !== 'string') return Reflect.get(target, key)
        if (key === '$') return context
        if (key[0] === '$') return nuclMap.get(key.slice(1))

        const val = (target as any)[key]
        
        // Always bind methods to proxy to ensure 'this' is correct
        if (typeof val === 'function') {
          let bound = methodCache.get(key)
          if (!bound) {
            bound = val.bind(proxy)
            methodCache.set(key, bound)
          }
          return bound
        }
        
        return val
      },
      set: (target, key, value) => Reflect.set(target, key, value)
    })

    // 2.8 Run Runtime Plugins
    plugins.forEach(p => p.onInit?.(proxy as any))

    return proxy as any
  }
}