/**
 * Standard Plugin Types
 *
 * Type definitions for standard plugin methods and properties.
 * Separated into Array, Object, and Universal categories.
 */

import type {INucleonCore} from '../INucleon' // TODO: Update to INuclCore or similar

// ============ ARRAY METHODS ============
// Only available when T is an array type

export interface StdArrayMethods<T> {
  /**
   * Add items to array
   * @returns this for chaining
   */
  push(this: INucleusQuark<T[]>, ...items: T[]): INucleusQuark<T[]>

  /**
   * Remove and return last item
   */
  pop(this: INucleusQuark<T[]>): T | undefined

  /**
   * Find first matching item
   */
  find(this: INucleusQuark<T[]>, fn: (item: T, index: number, array: T[]) => boolean): T | undefined

  /**
   * Get item at index (supports negative)
   */
  at(this: INucleusQuark<T[]>, index: number): T | undefined
}

// ============ OBJECT METHODS ============
// Only available when T is an object type

export interface StdObjectMethods<T extends object> {
  /**
   * Set property value
   * @returns this for chaining
   */
  set<K extends keyof T>(this: INucleusQuark<T>, key: K, val: T[K]): INucleusQuark<T>

  /**
   * Get property value
   */
  get<K extends keyof T>(this: INucleusQuark<T>, key: K): T[K]

  /**
   * Pick keys - returns new object with selected keys
   */
  pick<K extends keyof T>(this: INucleusQuark<T>, ...keys: K[]): Pick<T, K>
}

// ============ UNIVERSAL METHODS ============
// Available for all types

export interface StdUniversalMethods {
  /**
   * Subscribe to changes, only when value is not empty
   * @returns cleanup function
   */
  upSome(this: INucleusQuark<any>, fn: (value: any, nucl: INucleusQuark<any>) => void): () => void

  /**
   * Inject this Nucl into an object as reactive property
   * Uses nucl.id or 'value' as property name
   * @returns this for chaining
   */
  injectTo(this: INucleusQuark<any>, obj: any): INucleusQuark<any>

  /**
   * Inject this Nucl into object under specific key
   * @returns this for chaining
   */
  injectAs(this: INucleusQuark<any>, key: string, obj: any): INucleusQuark<any>
}

// ============ UNIVERSAL PROPERTIES ============
// Available for all types

export interface StdUniversalProperties {
  /**
   * Check if value is empty
   * - null/undefined → true
   * - string → length === 0
   * - array → length === 0
   * - object → no keys
   * - number → 0 or NaN
   * - boolean → false
   */
  isEmpty: boolean
}

// ============ ARRAY PROPERTIES ============
// Only meaningful when T is an array

export interface StdArrayProperties {
  /**
   * Array length
   * Returns undefined for non-arrays
   * Named 'size' to avoid Function.length conflict
   */
  size: number | undefined
}

// ============ OBJECT PROPERTIES ============
// Only meaningful when T is an object

export interface StdObjectProperties {
  /**
   * Object keys
   * Returns [] for non-objects
   */
  keys: string[]

  /**
   * Object values
   * Returns [] for non-objects
   */
  values: any[]
}

// ============ COMBINED PROTO TYPE ============

/**
 * Complete Std Proto
 * Combines all methods and properties
 */
export type StdProto =
  & StdArrayMethods<any>
  & StdObjectMethods<any>
  & StdUniversalMethods
  & StdUniversalProperties
  & StdArrayProperties
  & StdObjectProperties