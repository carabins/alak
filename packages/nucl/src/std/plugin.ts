/**
 * Standard Library Plugin Definition
 */

import { INucleonPlugin } from "@alaq/nucl/INucleonPlugin"
import { isEmpty } from '../utils/isEmpty'

/**
 * Standard plugin - combines universal, array, and object functionality
 */
export const stdPlugin: INucleonPlugin = {
  name: 'std',
  symbol: Symbol('std'),
  order: 50,

  methods: {
    // ============ UNIVERSAL METHODS ============
    upSome(this: any, fn: Function) {
      return this.up((value: any) => {
        if (!isEmpty(value)) fn(value, this)
      })
    },
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
    push(this: any, ...items: any[]) {
      if (!Array.isArray(this.value)) throw new TypeError('push() requires array value')
      const newValue = [...this.value, ...items]
      this(newValue)
      return this
    },
    pop(this: any) {
      if (!Array.isArray(this.value)) throw new TypeError('pop() requires array value')
      const arr = [...this.value]
      const last = arr.pop()
      this(arr)
      return last
    },
    find(this: any, fn: Function) {
      if (!Array.isArray(this.value)) throw new TypeError('find() requires array value')
      return this.value.find(fn)
    },
    at(this: any, index: number) {
      if (!Array.isArray(this.value)) throw new TypeError('at() requires array value')
      return this.value.at(index)
    },

    // ============ OBJECT METHODS ============
    set(this: any, key: string, val: any) {
      if (typeof this.value !== 'object' || this.value === null) throw new TypeError('set() requires object value')
      const newValue = { ...this.value, [key]: val }
      this(newValue)
      return this
    },
    get(this: any, key: string) {
      if (typeof this.value !== 'object' || this.value === null) throw new TypeError('get() requires object value')
      return this.value[key]
    },
    pick(this: any, ...keys: string[]) {
      if (typeof this.value !== 'object' || this.value === null) throw new TypeError('pick() requires object value')
      const result: any = {}
      keys.forEach(k => {
        if (k in this.value) result[k] = this.value[k]
      })
      return result
    },
  },

  properties: {
    isEmpty: {
      get(this: any) { return isEmpty(this.value) },
      enumerable: true
    },
    size: {
      get(this: any) { return Array.isArray(this.value) ? this.value.length : undefined },
      enumerable: true
    },
    keys: {
      get(this: any) { return typeof this.value === 'object' && this.value !== null ? Object.keys(this.value) : [] },
      enumerable: true
    },
    values: {
      get(this: any) { return typeof this.value === 'object' && this.value !== null ? Object.values(this.value) : [] },
      enumerable: true
    }
  }
}

// Backward compatibility alias
export const nucleusPlugin = stdPlugin
