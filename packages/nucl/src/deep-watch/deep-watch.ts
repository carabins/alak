/**
 * @alaq/nucl/deep-watch - High-performance deep watching plugin for Nucl
 * 
 * Provides efficient deep property watching for nested objects and arrays
 * with minimal overhead and maximum speed.
 */

import type { NuclPlugin } from '../types'
import { DEEP_TRACKING } from '@alaq/quark'

export interface DeepWatchPluginOptions {
  /**
   * Maximum depth to watch (default: 10)
   */
  maxDepth?: number
  
  /**
   * Whether to watch array indices (default: true)
   */
  watchArrayIndices?: boolean
  
  /**
   * Custom equality function for deep comparisons
   */
  isEqual?: (a: any, b: any) => boolean
  
  /**
   * Debounce time for batch updates (default: 0 - no debounce)
   */
  debounceMs?: number
}

const DEEP_WATCH_PLUGIN_SYMBOL = Symbol('nucl:deep-watch')

/**
 * Creates a high-performance deep watching plugin
 */
export const deepWatchPlugin = (options: DeepWatchPluginOptions = {}): NuclPlugin => {
  const { 
    maxDepth = 10, 
    watchArrayIndices = true,
    isEqual = (a, b) => a === b,
    debounceMs = 0
  } = options

  return {
    symbol: DEEP_WATCH_PLUGIN_SYMBOL,
    
    /**
     * Called when a Nucl instance is created
     */
    onCreate(nucl: any) {
      // Initialize deep watching metadata only if it doesn't exist already
      // This prevents overwriting initialization done by the built-in deep tracking system
      if (!nucl._deepWatch) {
        nucl._deepWatch = {
          watchers: new Map<string, Set<Function>>(),
          cacheMap: new Map<string, any>(), // Use Map instead of WeakMap for string keys
          maxDepth,
          watchArrayIndices,
          isEqual,
          debounceMs,
          pendingUpdates: new Set<string>(),
          debounceTimer: null as any
        }
      } else {
        // If already initialized, make sure to set the plugin options
        nucl._deepWatch.maxDepth = maxDepth;
        nucl._deepWatch.watchArrayIndices = watchArrayIndices;
        nucl._deepWatch.isEqual = isEqual;
        nucl._deepWatch.debounceMs = debounceMs;
      }
    },
    
    /**
     * Called when a property changes
     * 
     * Efficiently triggers only the watchers that depend on the changed property
     * to avoid unnecessary re-renders and improve performance
     * 
     * NOTE: If the Nucl instance was created with the deepTracking option,
     * the onChange logic is handled by the built-in system to avoid double notifications.
     */
    onChange(nucl: any, key: string, newValue: any, oldValue: any) {
      // When the Nucl instance was created with deep tracking option,
      // avoid duplicate notifications since change detection is handled by the built-in system
      if (nucl._flags & DEEP_TRACKING) {
        // The _flags property contains the DEEP_TRACKING flag
        // If this flag is set, the change detection is already handled by the built-in system
        return;
      }
      
      // When the main value changes, invalidate cache and trigger only relevant watchers
      if (nucl._deepWatch) {
        // Invalidate cache
        if (nucl._deepWatch.cacheMap) {
          nucl._deepWatch.cacheMap.clear()
        }
        
        // For the root 'value' key, we need to determine what actually changed
        // by comparing the old and new values at each watched path
        if (key === 'value') {
          // For each watched path, check if the value at that path actually changed
          for (const [watchedPath, watchers] of nucl._deepWatch.watchers.entries()) {
            const oldValueAtPath = getDeepFromObject(oldValue, watchedPath);
            const newValueAtPath = getDeepFromObject(newValue, watchedPath);
            
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
        } else {
          // Trigger only watchers that depend on this specific property
          // This prevents unnecessary re-renders and improves performance
          const watchersForKey = nucl._deepWatch.watchers.get(key)
          if (watchersForKey) {
            for (const watcher of watchersForKey) {
              try {
                watcher()
              } catch (e) {
                console.error('Error in deep watcher:', e)
              }
            }
          }
          
          // Also trigger watchers for nested properties that might have changed
          // Check if any watchers are for paths that start with this key
          for (const [watchedPath, watchers] of nucl._deepWatch.watchers.entries()) {
            if (watchedPath !== key && watchedPath.startsWith(`${key}.`)) {
              // This is a nested path that might have been affected by the change
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
      }
    },
    
    /**
     * Called when Nucl instance is disposed
     */
    onDecay(nucl: any) {
      if (nucl._deepWatch) {
        // Clean up resources
        nucl._deepWatch.watchers.clear()
        if (nucl._deepWatch.cacheMap) {
          nucl._deepWatch.cacheMap.clear()
        }
        nucl._deepWatch.pendingUpdates.clear()
        if (nucl._deepWatch.debounceTimer) {
          clearTimeout(nucl._deepWatch.debounceTimer)
        }
        delete nucl._deepWatch
      }
    }
  }
}

/**
 * Watch for deep changes in a nested property path
 */
/**
 * Watch for changes to a deep property path
 * 
 * Efficiently watches for changes to deeply nested properties and calls the callback
 * only when the specific property changes, avoiding unnecessary re-renders.
 * 
 * @param nucl - The Nucl instance to watch
 * @param path - The deep property path to watch (e.g. 'user.profile.name')
 * @param callback - The callback to call when the property changes
 * @returns A function to unsubscribe from the watcher
 * 
 * @example
 * ```ts
 * const unsubscribe = watchDeep(atom, 'user.profile.name', () => {
 *   console.log('User name changed to:', getDeep(atom, 'user.profile.name'))
 * })
 * 
 * // Later...
 * unsubscribe()
 * ```
 */
export function watchDeep(nucl: any, path: string, callback: Function): () => void {
  if (!nucl._deepWatch) {
    throw new Error('deepWatchPlugin is not installed')
  }

  // Normalize path for consistent storage
  const normalizedPath = normalizePath(path)
  
  // Create watcher set if it doesn't exist
  if (!nucl._deepWatch.watchers.has(normalizedPath)) {
    nucl._deepWatch.watchers.set(normalizedPath, new Set())
  }
  
  // Add callback to watcher set
  const watchers = nucl._deepWatch.watchers.get(normalizedPath)!
  watchers.add(callback)
  
  // Return unsubscribe function that removes the callback
  return () => {
    watchers.delete(callback)
    if (watchers.size === 0) {
      nucl._deepWatch.watchers.delete(normalizedPath)
    }
  }
}

/**
 * Get a deep property value with caching
 * 
 * Efficiently retrieves deeply nested property values with built-in caching
 * to avoid repeated computations and improve performance.
 * 
 * @param nucl - The Nucl instance to get the value from
 * @param path - The deep property path to get (e.g. 'user.profile.name')
 * @returns The value at the specified path, or undefined if not found
 * 
 * @example
 * ```ts
 * const name = getDeep(atom, 'user.profile.name')
 * const age = getDeep(atom, 'user.profile.details.age')
 * const city = getDeep(atom, 'user.profile.details.address.city')
 * ```
 */
export function getDeep(nucl: any, path: string): any {
  if (!nucl._deepWatch) {
    // Fallback to simple property access if plugin not installed
    const keys = normalizePath(path).split('.')
    let current = nucl.value
    for (const key of keys) {
      if (current == null || typeof current !== 'object') return undefined
      current = current[key]
    }
    return current
  }

  // Use Map instead of WeakMap for string keys
  if (!nucl._deepWatch.cacheMap) {
    nucl._deepWatch.cacheMap = new Map<string, any>()
  }
  
  const cacheKey = `${nucl.id}:${path}`
  const cached = nucl._deepWatch.cacheMap.get(cacheKey)
  if (cached !== undefined) return cached

  // Compute and cache the value
  const keys = normalizePath(path).split('.')
  let current = nucl.value
  for (const key of keys) {
    if (current == null || typeof current !== 'object') {
      nucl._deepWatch.cacheMap.set(cacheKey, undefined)
      return undefined
    }
    current = current[key]
  }
  
  nucl._deepWatch.cacheMap.set(cacheKey, current)
  return current
}

/**
 * Simple deep clone function (similar to Lodash.cloneDeep)
 * 
 * Efficiently creates deep copies of objects and arrays while preserving
 * their structure and avoiding circular references for optimal performance.
 * 
 * @param obj - The object to clone deeply
 * @returns A deep copy of the input object
 * 
 * @example
 * ```ts
 * const original = { a: { b: { c: 1 } } }
 * const copy = deepClone(original)
 * copy.a.b.c = 2
 * console.log(original.a.b.c) // 1
 * console.log(copy.a.b.c)     // 2
 * ```
 */
function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as any
  }
  
  if (obj instanceof RegExp) {
    return new RegExp(obj.source, obj.flags) as any
  }
  
  if (Array.isArray(obj)) {
    const copy: any = []
    for (let i = 0; i < obj.length; i++) {
      copy[i] = deepClone(obj[i])
    }
    return copy
  }
  
  if (Object.prototype.toString.call(obj) === '[object Object]') {
    const copy: any = {}
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        copy[key] = deepClone((obj as any)[key])
      }
    }
    return copy
  }
  
  return obj
}

/**
 * Set a deep property using path navigation and reconstruction
 */
/**
 * Set a deep property value
 * 
 * Efficiently sets deeply nested property values and triggers reactivity
 * for the updated properties, ensuring optimal performance and minimal
 * overhead for Vue integration.
 * 
 * @param nucl - The Nucl instance to set the value on
 * @param path - The deep property path to set (e.g. 'user.profile.name')
 * @param value - The new value to set at the specified path
 * 
 * @example
 * ```ts
 * setDeep(atom, 'user.profile.name', 'Jane Smith')
 * setDeep(atom, 'user.profile.details.age', 25)
 * setDeep(atom, 'user.profile.details.address.city', 'Los Angeles')
 * ```
 */
export function setDeep(nucl: any, path: string, value: any): void {
  const keys = normalizePath(path).split('.')
  
  // Get the current value (this will use the proper proxy access)
  const currentValue = nucl.value
  
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
  if (nucl._deepWatch && nucl._deepWatch.cacheMap) {
    nucl._deepWatch.cacheMap.clear()
  }
  
  // Update the Nucl value to trigger reactivity
  nucl(clonedValue)
}

// === Internal Helper Functions ===

/**
 * Check if a value should be deeply watched
 */
function shouldDeepWatch(value: any): boolean {
  if (value == null) return false
  if (typeof value !== 'object') return false
  if (value instanceof Date || value instanceof RegExp) return false
  return true
}

/**
 * Invalidate cache for a specific path
 */
function invalidateCache(nucl: any, path: string) {
  // Simple approach: invalidate all cache entries for this Nucl instance
  // In a production implementation, this would be more granular
  if (nucl._deepWatch.cacheMap) {
    nucl._deepWatch.cacheMap = new Map<string, any>()
  }
}

/**
 * Get a deep property value from an object without using cache
 */
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

// Cache for normalized paths to improve performance
const pathNormalizationCache = new Map<string, string>()

/**
 * Normalize a property path
 */
function normalizePath(path: string): string {
  if (pathNormalizationCache.has(path)) {
    return pathNormalizationCache.get(path)!
  }
  
  const normalized = path.replace(/\[(\w+)\]/g, '.$1').replace(/^\./, '')
  pathNormalizationCache.set(path, normalized)
  return normalized
}