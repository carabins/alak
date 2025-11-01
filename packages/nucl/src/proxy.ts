/**
 * Functions for creating deep tracking proxies
 */

import { IMMUTABLE, DEEP_TRACKING } from '@alaq/quark'

/**
 * Creates a deep tracking proxy for the given value
 */
export function createDeepTrackingProxy(value: any, nucl: any) {
  if (value === null || typeof value !== 'object') {
    return value
  }

  // Use a WeakMap to cache proxies and avoid creating multiple proxies for the same object
  if (!nucl._proxyCache) {
    nucl._proxyCache = new WeakMap()
  }

  if (nucl._proxyCache.has(value)) {
    return nucl._proxyCache.get(value)
  }

  const proxy = new Proxy(value, {
    get(target: any, prop: string) {
      const result = target[prop]

      // If the property is an object/array, wrap it in a proxy too
      if (result !== null && typeof result === 'object') {
        return createDeepTrackingProxy(result, nucl)
      }

      return result
    },
    set(target: any, prop: string, newValue: any) {
      // If IMMUTABLE is enabled, prevent direct modification
      if (nucl._flags & IMMUTABLE) {
        // Create a new copy instead of modifying the original
        let newTarget;
        if (Array.isArray(target)) {
          newTarget = [...target];
          newTarget[prop] = newValue;
        } else {
          newTarget = { ...target, [prop]: newValue };
        }
        
        // Update the nucl instance with the new copy
        nucl(newTarget);
        
        // Return true to indicate successful set in proxy
        return true;
      } else {
        target[prop] = newValue;
        
        // Trigger an update on the nucl instance
        nucl(nucl._rawValue);
        
        return true;
      }
    },
    deleteProperty(target: any, prop: string) {
      if (nucl._flags & IMMUTABLE) {
        // Create a new copy without the property
        let newTarget;
        if (Array.isArray(target)) {
          newTarget = [...target];
          newTarget.splice(parseInt(prop), 1);
        } else {
          newTarget = { ...target };
          delete newTarget[prop];
        }
        
        // Update the nucl instance with the new copy
        nucl(newTarget);
      } else {
        const result = delete target[prop];

        // Trigger an update on the nucl instance
        if (result) {
          nucl(nucl._rawValue)
        }

        return result;
      }
      
      return true;
    }
  })

  nucl._proxyCache.set(value, proxy)
  return proxy
}