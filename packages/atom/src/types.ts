/**
 * @alaq/atom - Type definitions
 */

/**
 * Atom Plugin interface
 */
export interface AtomPlugin {
  /** Unique plugin identifier */
  symbol: Symbol

  /** Detect if value is a marker for this plugin */
  detectMarker?(value: any): boolean

  /** Called when quark with markers is created */
  onQuarkProperty?(context: {
    atom: any
    quark: any
    key: string
    markers: any[]
  }): void

  /** Called after all quarks are created */
  onCreate?(atom: any, markedProperties: Record<string, any[]>): void

  /** Called when atom is destroyed */
  onDecay?(atom: any): void
}

/**
 * Atom creation options
 */
export interface AtomOptions {
  /** Atom name (appended to realm) */
  name?: string

  /** Realm namespace (default: '+') */
  realm?: string

  /** Container constructor (default: Qu from @alaq/quark) */
  container?: Function

  /** External event bus */
  bus?: any

  /** Arguments for class constructor */
  constructorArgs?: any[]

  /** Emit NUCLEUS_CHANGE events */
  emitChanges?: boolean
}

/**
 * Extract property keys (non-functions, non-getters)
 */
export type PropertiesOf<T> = {
  [K in keyof T]: T[K] extends Function ? never : K
}[keyof T]

/**
 * Extract method keys (functions, non-getters)
 */
export type MethodsOf<T> = {
  [K in keyof T]: T[K] extends Function ? K : never
}[keyof T]

/**
 * Atom instance type
 */
export interface AtomInstance<T = any> {
  /** Direct access to quarks */
  core: Record<string, any>

  /** Proxy for state values (getter/setter) */
  state: T

  /** Methods bound to state */
  actions: Record<string, Function>

  /** Event bus */
  bus: any

  /** Cleanup method */
  decay(): void

  /** Internal metadata */
  _internal: {
    realm: string
    containers: Record<string, any>
    computed: Record<string, any>
    model: any
    initialized: boolean
  }
}

/**
 * Parsed model structure
 */
export interface ParsedModel {
  properties: Record<string, any>
  methods: Record<string, Function>
  getters: Record<string, Function>
}
