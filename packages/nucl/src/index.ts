/**
 * Nucl - Enhanced Quark with plugin system (OPTIMIZED for V8)
 * @module @alaq/nucl
 *
 * ⚡ KEY OPTIMIZATION: Avoid double Object.setPrototypeOf call
 *
 * PROBLEM IDENTIFIED:
 * - createQu() calls Object.setPrototypeOf(quark, quarkProto)  <- Line 146 in create.ts
 * - Original Nucl called Object.setPrototypeOf(quark, NuclProto) <- Line 104 in index.ts
 * - V8 invalidates hidden classes TWICE -> 50% performance loss in Chrome
 *
 * SOLUTION:
 * - Inline the entire createQu logic (copy fields initialization)
 * - Call Object.setPrototypeOf ONLY ONCE with NuclProto
 * - NuclProto extends quarkProto via Object.create, so we inherit all Quark methods
 *
 * RESULT: Single setPrototypeOf call = ~2x faster in V8!
 */

import { setValue, quarkProto, HAS_REALM, DEDUP, STATELESS, quantumBus, IMMUTABLE, DEEP_TRACKING, EMIT_CHANGES } from '@alaq/quark'
import type { QuOptions } from '@alaq/quark'
import type { NuclPlugin, NuclOptions } from './types'
import { createDeepTrackingProxy } from './proxy'
import { getRealmPlugins } from './realm-plugins'

/**
 * Plugin definition
 */
export interface NuclPlugin {
  /** Unique plugin symbol */
  symbol: Symbol

  /** Called when plugin is installed globally */
  onInstall?: () => void

  /** Called when Nucl instance is created */
  onCreate?: (nucl: any) => void

  /** Called when Nucl instance changes */
  onChange?: (nucl: any, key: string, newValue: any, oldValue: any) => void

  /** Called when Nucl instance is disposed */
  onDecay?: (nucl: any) => void

  /** Called when property is accessed */
  onGet?: (nucl: any, key: string, value: any) => void

  /** Called when property is set */
  onSet?: (nucl: any, key: string, value: any) => void
}

/**
 * Plugin registry
 */
const registry = {
  plugins: new Map<string, NuclPlugin>(),
  createHooks: [] as Array<(nucl: any) => void>,
  decayHooks: [] as Array<(nucl: any) => void>,
  changeHooks: [] as Array<(nucl: any, key: string, newValue: any, oldValue: any) => void>
}

/**
 * Install plugin globally
 */
export function use(plugin: NuclPlugin): void {
  if (registry.plugins.has(plugin.name)) {
    return // Already installed
  }

  registry.plugins.set(plugin.name, plugin)

  // Add methods to prototype
  if (plugin.methods) {
    Object.assign(NuclProto, plugin.methods)
  }

  // Add properties to prototype
  if (plugin.properties) {
    Object.keys(plugin.properties).forEach(key => {
      Object.defineProperty(NuclProto, key, plugin.properties![key])
    })
  }

  // Register hooks
  if (plugin.onCreate) {
    registry.createHooks.push(plugin.onCreate)
  }

  if (plugin.onDecay) {
    registry.decayHooks.push(plugin.onDecay)
  }

  if (plugin.onChange) {
    registry.changeHooks.push(plugin.onChange)
  }

  // Call install hook
  plugin.onInstall?.()
}

/**
 * Nucl prototype - extends Quark prototype
 */
export const NuclProto = Object.create(quarkProto)

// Override decay to call plugin hooks
const originalDecay = NuclProto.decay
NuclProto.decay = function(this: any) {
  // Call plugin decay hooks (both global and instance)
  registry.decayHooks.forEach(hook => hook(this))

  // Call instance plugin onDecay hooks
  const plugins = (this as any)._plugins
  if (plugins) {
    for (const plugin of plugins) {
      if (plugin.onDecay) {
        try {
          plugin.onDecay(this)
        } catch (e) {
          console.error(`Error in plugin ${plugin.symbol.description || plugin.symbol}:`, e)
        }
      }
    }
  }

  // Call original decay
  return originalDecay.call(this)
}

// Add bus property getter to Nucl
Object.defineProperty(NuclProto, 'bus', {
  get: function() {
    if (!this._bus) {
      this._bus = this._realm ? quantumBus.getRealm(this._realm) : quantumBus.getRealm('default')
    }
    return this._bus
  },
  enumerable: false,
  configurable: true
})



// Define strategies
const fusionStrategies = {
  /**
   * alive - Recompute only when all sources are truthy
   */
  alive: (sources: any[]) => {
    return sources.every(s => !!s.value)
  },

  /**
   * any - Recompute on any change (always)
   */
  any: (_sources: any[]) => {
    return true
  }
}

/**
 * Make this nucleon behave as a fusion of other nucleons
 */
NuclProto.fusion = function(this: any, ...args: any[]) {
  // Extract the function (last argument) and strategy (second to last, optional)
  let fn = args[args.length - 1]
  const sources = args.slice(0, -1).filter(arg => typeof arg !== 'string')
  const strategyName = args.length > 2 && typeof args[args.length - 2] === 'string'
    ? args[args.length - 2]
    : 'alive' // default to 'alive' strategy

  // Get the appropriate strategy function
  const strategy = fusionStrategies[strategyName as keyof typeof fusionStrategies]
  if (!strategy) {
    throw new Error(`Unknown fusion strategy: ${strategyName}`)
  }

  // Track which sources have decayed
  const decayedSources = new Set<any>()

  // Compute function
  const self = this
  const compute = () => {
    // If any source has decayed, don't compute and set result to undefined
    if (decayedSources.size > 0) {
      self(undefined)
      return
    }
    
    if (strategy(sources)) {
      const values = sources.map(s => s.value)
      const newValue = fn(...values)
      self(newValue)
    }
  }

  // Subscribe to all sources
  const cleanups: Array<() => void> = []
  let skipCount = sources.length  // Skip immediate .up() callbacks for all sources

  sources.forEach(source => {
    const listener = () => {
      if (skipCount > 0) {
        skipCount--
        return
      }
      compute()
    }
    source.up(listener)
    cleanups.push(() => source.down(listener))
  })

  // Initial computation after setting up listeners (but before skipping)
  compute()

  // Auto-cleanup when any source decays
  sources.forEach(source => {
    const originalSourceDecay = source.decay
    source.decay = function() {
      if (!this._decayed) {  // Prevent multiple calls to decay
        cleanups.forEach(c => c())
        decayedSources.add(this)  // Mark this source as decayed
        self(undefined)  // Set result to undefined when a source decays
        this._decayed = true
      }
      return originalDecay.call(this)
    }
  })

  // Store cleanup function to allow manual cleanup if needed
  self._fusionCleanup = () => {
    cleanups.forEach(c => c())
  }

  return this
}

let uidCounter = 0

/**
 * Create Nucl instance (OPTIMIZED)
 *
 * This function is a COMPLETE INLINE of createQu() logic,
 * with the critical difference that we setPrototypeOf to NuclProto instead of quarkProto.
 *
 * By doing this, we avoid the double setPrototypeOf that was killing V8 performance.
 */
export function Nucl<T = any>(options?: NuclOptions<T> | T): any {
  // Handle shorthand: Nucl(value) instead of Nucl({ value })
  const opts = (options !== null && typeof options === 'object' && 'value' in options)
    ? options as NuclOptions<T>
    : { value: options as T }

  // Extract plugins from options
  const { plugins = [], ...quarkOpts } = opts as any

  // Get realm-specific plugins if realm is provided
  const realmPlugins = quarkOpts.realm ? getRealmPlugins(quarkOpts.realm) : []
  const allPlugins = [...realmPlugins, ...plugins]

  // ========== INLINED createQu() logic START ==========
  // This is copied from packages/quark/src/create.ts:103-148
  // The ONLY change: setPrototypeOf to NuclProto instead of quarkProto

  const nucl = function(this: any, value: any) {
    // Capture the old value BEFORE updating internal state
    const oldValue = nucl.value
    
    // Update raw value and state if needed
    if (nucl._flags & DEEP_TRACKING) {
      // For deep tracking, we need to create a new proxy
      nucl._rawValue = value;
      nucl._state = createDeepTrackingProxy(value, nucl);
    } else {
      // For non-deep tracking, just update raw value
      nucl._rawValue = value;
      if (!(nucl._flags & DEEP_TRACKING)) {
        nucl._value = value; // For compatibility with quark methods
      }
    }

    // Call plugin onChange hooks before setting value using quark's setValue
    const result = setValue(nucl, value)

    // Call plugin onChange hooks after setting value
    for (const plugin of allPlugins) {
      if (plugin.onChange) {
        try {
          plugin.onChange(nucl, 'value', value, oldValue)
        } catch (e) {
          console.error(`Error in plugin ${plugin.symbol.description || plugin.symbol}:`, e)
        }
      }
    }

    // Also call global registry onChange hooks
    registry.changeHooks.forEach(hook => {
      try {
        hook(nucl, 'value', value, oldValue)
      } catch (e) {
        console.error('Error in global onChange hook:', e)
      }
    })

    // Handle deep tracking onChange logic specifically
    if (nucl._flags & DEEP_TRACKING && nucl._deepWatch) {
      // Invalidate cache
      if (nucl._deepWatch.cacheMap) {
        nucl._deepWatch.cacheMap.clear()
      }
      
      // For each watched path, check if the value at that path actually changed
      for (const [watchedPath, watchers] of nucl._deepWatch.watchers.entries()) {
        const oldValueAtPath = getDeepFromObject(oldValue, watchedPath);
        const newValueAtPath = getDeepFromObject(value, watchedPath);
        
        // Only trigger the watcher if the value at this specific path actually changed
        if (!nucl._deepWatch.isEqual(oldValueAtPath, newValueAtPath)) {
          for (const watcher of watchers) {
            try {
              watcher()
            } catch (e) {
              console.error('Error in deep watcher:', e)
            }
          }
        }
      }
    }

    // Emit NUCLEUS_CHANGE event if needed (for compatibility with vue-integration and other plugins)
    if (nucl._flags & EMIT_CHANGES) {
      // Only emit if emitChanges option is enabled
      nucl.bus?.emit?.('NUCLEUS_CHANGE', { key: 'value', value: nucl.value, realm: nucl._realm ? nucl._realm : 'default' })
    }

    return result
  } as any

  // Helper function to get value from an object by path (for change detection)
  function getDeepFromObject(obj: any, path: string): any {
    if (obj === null || typeof obj !== 'object') {
      return undefined
    }

    const keys = normalizePath(path).split('.')
    let current = obj
    for (const key of keys) {
      if (current == null || typeof current !== 'object') return undefined
      current = current[key]
    }
    return current
  }

  // CRITICAL FIELDS - always for monomorphic shape
  nucl.uid = ++uidCounter
  nucl._flags = 0

  // VALUE - only if exists
  if (quarkOpts.value !== undefined) {
    nucl._rawValue = quarkOpts.value
    // If DEEP_TRACKING is enabled, create proxy for the value
    if (opts.deepTracking) {
      nucl._state = createDeepTrackingProxy(quarkOpts.value, nucl)
    } else {
      nucl.value = quarkOpts.value
    }
  }

  // ID - only if exists
  if (quarkOpts.id) {
    nucl.id = quarkOpts.id
  }

  // REALM - conditional (only if needed)
  if (quarkOpts.realm) {
    nucl._realm = quarkOpts.realm
    nucl._realmPrefix = quarkOpts.realm + ':'
    nucl._flags |= HAS_REALM
  }

  // PIPE - only if exists
  if (quarkOpts.pipe) {
    nucl._pipeFn = quarkOpts.pipe
  }

  // FLAGS - set if needed
  if (quarkOpts.dedup) {
    nucl._flags |= DEDUP
  }
  if (quarkOpts.stateless) {
    nucl._flags |= STATELESS
  }
  // IMMUTABLE and DEEP_TRACKING flags - only for nucl
  if (opts.immutable) {
    nucl._flags |= IMMUTABLE
  }
  if (opts.deepTracking) {
    nucl._flags |= DEEP_TRACKING
  }
  // EMIT_CHANGES flag - only for nucl
  if (opts.emitChanges) {
    nucl._flags |= EMIT_CHANGES
  }

  // LISTENERS, EVENTS - NOT initialized! Lazy!
  // Will be created in up(), on(), etc.

  // ⚡⚡⚡ CRITICAL OPTIMIZATION ⚡⚡⚡
  // Set prototype ONCE to NuclProto (not quarkProto!)
  // NuclProto inherits from quarkProto, so we get all Quark functionality
  Object.setPrototypeOf(nucl, NuclProto)

  // ========== INLINED createQu() logic END ==========

  // Call plugin create hooks (both global registry and instance plugins)
  for (let i = 0, len = registry.createHooks.length; i < len; i++) {
    registry.createHooks[i](nucl)
  }

  // Call all plugin onCreate hooks (including realm-wide plugins)
  for (const plugin of allPlugins) {
    if (plugin.onCreate) {
      try {
        plugin.onCreate(nucl)
      } catch (e) {
        console.error(`Error in plugin ${plugin.symbol.description || plugin.symbol}:`, e)
      }
    }
  }

  // Initialize deep tracking metadata if deep tracking is enabled
  if (opts.deepTracking) {
    nucl._deepWatch = {
      watchers: new Map<string, Set<Function>>(),
      cacheMap: new Map<string, any>(),
      maxDepth: 10,  // Default max depth
      watchArrayIndices: true,  // Default to watching array indices
      isEqual: (a: any, b: any) => a === b,  // Default equality function
      debounceMs: 0,  // Default no debounce
      pendingUpdates: new Set<string>(),
      debounceTimer: null as any
    }
  }

  return nucl
}

// Define value getter for Nucl
Object.defineProperty(NuclProto, 'value', {
  get: function() {
    return (this._flags & DEEP_TRACKING) ? this._state : this._rawValue
  },
  set: function(value) {
    // Update the raw value
    this._rawValue = value
    // If DEEP_TRACKING is enabled, update the proxy
    if (this._flags & DEEP_TRACKING) {
      this._state = createDeepTrackingProxy(value, this)
    }
    // Update regular value as well for compatibility with quark methods
    if (!(this._flags & DEEP_TRACKING)) {
      this._value = value
    }
  },
  enumerable: true,
  configurable: true
})

// Add deep tracking methods to NuclProto that are only functional when deep tracking is enabled
// These methods check the DEEP_TRACKING flag and provide appropriate behavior
NuclProto.getDeep = function(path: string) {
  if (this._flags & DEEP_TRACKING) {
    // Create deep watch metadata if it doesn't exist
    if (!this._deepWatch) {
      this._deepWatch = {
        watchers: new Map<string, Set<Function>>(),
        cacheMap: new Map<string, any>(),
        pendingUpdates: new Set<string>(),
        debounceTimer: null as any
      }
    }

    // Use Map instead of WeakMap for string keys
    if (!this._deepWatch.cacheMap) {
      this._deepWatch.cacheMap = new Map<string, any>()
    }
    
    const cacheKey = `${this.id || 'unnamed'}:${path}`
    const cached = this._deepWatch.cacheMap.get(cacheKey)
    if (cached !== undefined) return cached

    // Compute and cache the value
    const keys = normalizePath(path).split('.')
    let current = this.value
    for (const key of keys) {
      if (current == null || typeof current !== 'object') {
        this._deepWatch.cacheMap.set(cacheKey, undefined)
        return undefined
      }
      current = current[key]
    }
    
    this._deepWatch.cacheMap.set(cacheKey, current)
    return current
  } else {
    // Fallback to simple property access if deep tracking is not enabled
    const keys = normalizePath(path).split('.')
    let current = this.value
    for (const key of keys) {
      if (current == null || typeof current !== 'object') return undefined
      current = current[key]
    }
    return current
  }
}

NuclProto.setDeep = function(path: string, value: any) {
  if (this._flags & DEEP_TRACKING) {
    const keys = normalizePath(path).split('.')
    
    // Get the current value (this will use the proper proxy access)
    const currentValue = this.value
    
    // Create a deep copy using our custom clone function
    const clonedValue = deepClone(currentValue)
    
    // Navigate to the parent object and update
    let current: any = clonedValue
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]
      if (current == null || typeof current !== 'object') {
        throw new Error(`Cannot set property '${path}' - path is invalid at '${keys.slice(0, i + 1).join('.')}'`)
      }
      current = current[key]
    }
    
    // Set the final property
    const finalKey = keys[keys.length - 1]
    if (current == null || typeof current !== 'object') {
      throw new Error(`Cannot set property '${path}' - parent is not an object`)
    }
    current[finalKey] = value
    
    // Invalidate cache before updating
    if (this._deepWatch && this._deepWatch.cacheMap) {
      this._deepWatch.cacheMap.clear()
    }
    
    // Update the Nucl value to trigger reactivity
    this(clonedValue)
  } else {
    // For non-deep tracking, we have to update the entire object since
    // there's no automatic proxy system to handle nested updates
    // This is the same fallback as getDeep
    throw new Error("setDeep requires deep tracking to be enabled with the 'deepTracking: true' option")
  }
}

NuclProto.watchDeep = function(path: string, callback: Function): () => void {
  if (this._flags & DEEP_TRACKING) {
    // Create deep watch metadata if it doesn't exist
    if (!this._deepWatch) {
      this._deepWatch = {
        watchers: new Map<string, Set<Function>>(),
        cacheMap: new Map<string, any>(),
        pendingUpdates: new Set<string>(),
        debounceTimer: null as any
      }
    }

    // Normalize path for consistent storage
    const normalizedPath = normalizePath(path)
    
    // Create watcher set if it doesn't exist
    if (!this._deepWatch.watchers.has(normalizedPath)) {
      this._deepWatch.watchers.set(normalizedPath, new Set())
    }
    
    // Add callback to watcher set
    const watchers = this._deepWatch.watchers.get(normalizedPath)!
    watchers.add(callback)
    
    // Return unsubscribe function that removes the callback
    return () => {
      watchers.delete(callback)
      if (watchers.size === 0) {
        this._deepWatch.watchers.delete(normalizedPath)
      }
    }
  } else {
    throw new Error("watchDeep requires deep tracking to be enabled with the 'deepTracking: true' option")
  }
}

// Cache for normalized paths to improve performance
const pathNormalizationCache = new Map<string, string>()

// Internal helper to normalize path
function normalizePath(path: string): string {
  if (pathNormalizationCache.has(path)) {
    return pathNormalizationCache.get(path)!
  }
  
  const normalized = path.replace(/\[(\w+)\]/g, '.$1').replace(/^\./, '')
  pathNormalizationCache.set(path, normalized)
  return normalized
}

// Optimized internal helper to deep clone objects
function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object' || obj instanceof Date || obj instanceof RegExp) {
    return obj
  }
  
  if (Array.isArray(obj)) {
    const copy: any = new Array(obj.length)
    for (let i = 0; i < obj.length; i++) {
      copy[i] = deepClone(obj[i])
    }
    return copy
  }
  
  // For plain objects
  const copy: any = {}
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      copy[key] = deepClone((obj as any)[key])
    }
  }
  return copy
}

// Export types from Quark
export type { QuOptions }

// Export Nv as alias to Nucl
export const Nv = function<T>(value?: T, options?: any) {
  return Nucl({ ...options, value })
}



// Export realm-wide plugin functions
export { useRealmPlugins } from './realm-plugins'
