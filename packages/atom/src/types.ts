/**
 * @alaq/atom - Type definitions
 */

import { Orbit } from './orbit'

/**
 * Atom creation options
 */
export interface AtomOptions<Model = any> {
  /** 
   * Realm namespace for events (default: 'root' or isolated) 
   * Events will be emitted to this bus realm.
   */
  realm?: string

  /** 
   * Atom name for debugging and event prefixing 
   * Events will be named `{name}.{prop}`
   * Default: Model class name
   */
  name?: string

  /**
   * Plugins to extend atom behavior.
   * Passing an empty array [] creates a bare atom without default behaviors.
   * Default: [ConventionsPlugin, ComputedPlugin]
   */
  plugins?: AtomPlugin[]

  /**
   * Arguments to pass to the Model constructor
   */
  constructorArgs?: any[]

  /** 
   * Automatically emit change events to the bus.
   * By default, events are named 'change' (unless emitChangeName is set).
   * If Quark has an ID, it will be used as part of the event payload or prefix.
   */
  emitChanges?: boolean

  /**
   * Custom event name for changes. Default: 'change'
   */
  emitChangeName?: string

  /**
   * Global strategy kind for all properties.
   * Merged with local property kinds.
   * @example 'deep stored'
   */
  nuclearKind?: string
}

/**
 * Atom Plugin interface
 */
export interface AtomPlugin {
  name: string
  
  /** Called before model analysis starts */
  onSetup?(model: any, options: AtomOptions): void

  /** Called for each property candidate found in model */
  onProp?(context: {
    key: string
    orbit: Orbit
    atom: AtomInstance
    model: any
  }): void // Can modify orbit in place

  /** Called for each method candidate found in model */
  onMethod?(context: {
    key: string
    fn: Function
    atom: AtomInstance
    model: any
  }): Function | void // Can return wrapped function

  /** Called after atom is fully initialized */
  onInit?(atom: AtomInstance): void

  /** Called when atom is decayed */
  onDecay?(atom: AtomInstance): void
}

/**
 * Filter out keys starting with underscore
 */
export type PublicKeys<T> = {
  [K in keyof T]: K extends string 
    ? (K extends `_${string}` ? never : K) 
    : K
}[keyof T]

export type PublicInterface<T> = Pick<T, PublicKeys<T>>

/**
 * The Atom Instance (Proxy)
 * Combines user model members with Atom API
 */
export type AtomInstance<T = any> = PublicInterface<T> & {
  /** 
   * Access to Nucleus/Fusion instances 
   * @example atom.$count.up(...)
   */
  [K in keyof T as `$${string & K}`]: any // Typed as any for flexibility, ideally Nucleus<T[K]>
} & {
  /** Atom Context */
  $: AtomContext
}

export interface AtomContext {
  /** Reference to the event bus realm */
  bus: any
  
  /** Destroy the atom and all subscriptions */
  decay(): void
  
  /** Access to internal options */
  options: AtomOptions
  
  /** Direct access to internal Nucl map (debug only) */
  _nucl: Map<string, any>
}
