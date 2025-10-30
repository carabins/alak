/**
 * Nucleus Plugin - Universal + Array + Object methods combined
 * Single plugin for better performance
 *
 * Entry point: @alaq/nucl/nucleus
 * Auto-installs nucleus plugin for convenience
 *
 * @module @alaq/nucl/nucleus
 */

import { Nucl, use } from '../index'
import type { NuclPlugin } from '../index'

/**
 * Check if value is empty
 */
function isEmpty(value: any): boolean {
  if (value == null) return true
  if (typeof value === 'string') return value.length === 0
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value).length === 0
  if (typeof value === 'number') return value === 0 || isNaN(value)
  if (typeof value === 'boolean') return !value
  return false
}

/**
 * Nucleus plugin - combines universal, array, and object functionality
 */
export const nucleusPlugin: NuclPlugin = {
  name: 'nucleus',

  methods: {
    // ============ UNIVERSAL METHODS ============

    /**
     * Subscribe to changes, only when value is truthy
     */
    upSome(this: any, fn: Function) {
      return this.up((value: any) => {
        if (value) fn(value, this)
      })
    },

    /**
     * Inject this Nucl into an object as reactive property
     */
    injectTo(this: any, obj: any) {
      const nucl = this
      Object.defineProperty(obj, nucl.id || 'value', {
        get() { return nucl.value },
        set(v) { nucl(v) },
        enumerable: true,
        configurable: true
      })
      return this
    },

    /**
     * Inject this Nucl into object under specific key
     */
    injectAs(this: any, key: string, obj: any) {
      const nucl = this
      Object.defineProperty(obj, key, {
        get() { return nucl.value },
        set(v) { nucl(v) },
        enumerable: true,
        configurable: true
      })
      return this
    },

    // ============ ARRAY METHODS ============

    /**
     * Add items to array
     */
    push(this: any, ...items: any[]) {
      if (!Array.isArray(this.value)) {
        throw new TypeError('push() requires array value')
      }
      const newValue = [...this.value, ...items]
      this(newValue)
      return this
    },

    /**
     * Remove and return last item
     */
    pop(this: any) {
      if (!Array.isArray(this.value)) {
        throw new TypeError('pop() requires array value')
      }
      const arr = [...this.value]
      const last = arr.pop()
      this(arr)
      return last
    },

    /**
     * Transform array - returns new reactive Nucl
     */
    map(this: any, fn: Function) {
      if (!Array.isArray(this.value)) {
        throw new TypeError('map() requires array value')
      }

      const mapped = Nucl(this.value.map(fn))

      // Subscribe to source changes
      this.up((value: any[]) => {
        mapped(value.map(fn))
      })

      return mapped
    },

    /**
     * Filter array - returns new reactive Nucl
     */
    filter(this: any, fn: Function) {
      if (!Array.isArray(this.value)) {
        throw new TypeError('filter() requires array value')
      }

      const filtered = Nucl(this.value.filter(fn))

      // Subscribe to source changes
      this.up((value: any[]) => {
        filtered(value.filter(fn))
      })

      return filtered
    },

    /**
     * Find first matching item
     */
    find(this: any, fn: Function) {
      if (!Array.isArray(this.value)) {
        throw new TypeError('find() requires array value')
      }
      return this.value.find(fn)
    },

    /**
     * Get item at index (supports negative)
     */
    at(this: any, index: number) {
      if (!Array.isArray(this.value)) {
        throw new TypeError('at() requires array value')
      }
      return this.value.at(index)
    },

    // ============ OBJECT METHODS ============

    /**
     * Set property value
     */
    set(this: any, key: string, val: any) {
      if (typeof this.value !== 'object' || this.value === null) {
        throw new TypeError('set() requires object value')
      }
      const newValue = { ...this.value, [key]: val }
      this(newValue)
      return this
    },

    /**
     * Get property value
     */
    get(this: any, key: string) {
      if (typeof this.value !== 'object' || this.value === null) {
        throw new TypeError('get() requires object value')
      }
      return this.value[key]
    },

    /**
     * Pick keys - returns new reactive Nucl
     */
    pick(this: any, ...keys: string[]) {
      if (typeof this.value !== 'object' || this.value === null) {
        throw new TypeError('pick() requires object value')
      }

      const pickKeys = (obj: any) => {
        const result: any = {}
        keys.forEach(k => {
          if (k in obj) result[k] = obj[k]
        })
        return result
      }

      const picked = Nucl(pickKeys(this.value))

      // Subscribe to source changes
      this.up((value: any) => {
        picked(pickKeys(value))
      })

      return picked
    },

    /**
     * Omit keys - returns new reactive Nucl
     */
    omit(this: any, ...keys: string[]) {
      if (typeof this.value !== 'object' || this.value === null) {
        throw new TypeError('omit() requires object value')
      }

      const omitKeys = (obj: any) => {
        const result = { ...obj }
        keys.forEach(k => delete result[k])
        return result
      }

      const omitted = Nucl(omitKeys(this.value))

      // Subscribe to source changes
      this.up((value: any) => {
        omitted(omitKeys(value))
      })

      return omitted
    }
  },

  properties: {
    /**
     * Check if value is empty
     */
    isEmpty: {
      get(this: any) {
        return isEmpty(this.value)
      },
      enumerable: true
    },

    /**
     * Array length (returns undefined for non-arrays)
     * Note: Named 'size' instead of 'length' to avoid Function.length conflict
     */
    size: {
      get(this: any) {
        return Array.isArray(this.value) ? this.value.length : undefined
      },
      enumerable: true
    },

    /**
     * Object keys (returns [] for non-objects)
     */
    keys: {
      get(this: any) {
        return typeof this.value === 'object' && this.value !== null
          ? Object.keys(this.value)
          : []
      },
      enumerable: true
    },

    /**
     * Object values (returns [] for non-objects)
     */
    values: {
      get(this: any) {
        return typeof this.value === 'object' && this.value !== null
          ? Object.values(this.value)
          : []
      },
      enumerable: true
    }
  }
}

// Auto-install nucleus plugin
use(nucleusPlugin)

export { Nucl, use }
