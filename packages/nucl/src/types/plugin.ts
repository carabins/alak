/**
 * @alaq/nucl - Extended types for Nucl
 */

import type { QuOptions } from '@alaq/quark'
import INucleusCore from "./core";

/**
 * Nucl plugin definition
 */
export interface NucleonPlugin {
  /** Unique plugin name */
  name: string

  /** Unique plugin symbol (optional) */
  symbol?: Symbol

  /** Called when plugin is installed globally */
  onInstall?: () => void

  /** Called when Nucl instance is created */
  onCreate?: PluginHandler

  /** Called when Nucl instance changes */
  onBeforeChange?: PluginChangeHandler
  onAfterChange?: PluginChangeHandler

  /** Called when Nucl instance is disposed */
  onDecay?: PluginHandler

  deepWatch?: (e:{
    n:INucleusCore<any>,
    path: string,
    type: string,
    target: any,
    oldValue?: any
  })=>void

  methods?:any
  properties?:any

  // /** Called when property is accessed */
  // onGet?: (nucl: any, key: string, value: any) => void
  //
  // /** Called when property is set */
  // onSet?: (nucl: any, key: string, value: any) => void
}

type PluginHandler = (nuc: INucleusCore<any>, ...options:any[]) => void
type PluginChangeHandler = (n: INucleusCore<any>, newValue: any, oldValue: any) => void

export interface PluginsRegistry {
  createHooks: PluginHandler[]
  decayHooks: PluginHandler[]
  beforeChangeHooks: PluginChangeHandler[]
  afterChangeHooks: PluginChangeHandler[]
  proto: any
}


/**
 * Extended options for Nucl
 */
export interface NuOptions<T = any> extends QuOptions<T> {
  /** Realm to use for this instance - determines which plugins are active */
  realm?: string
  /** Enable immutability - creates new copies on each update */
  immutable?: boolean
  /** Enable deep tracking - tracks changes in nested objects/arrays */
  deepWatch?: boolean

  plugins?: NucleonPlugin[]
}

// Re-export realm types
export type { Nu, NuRealms } from './realms'
