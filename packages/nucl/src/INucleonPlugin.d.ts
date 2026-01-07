import {IDeepStateChange} from "@alaq/deep-state/types";
import {INucleonCore} from "@alaq/nucl/INucleon";
import {INuOptions} from "./options";

/**
 * Hook types
 */
export type PluginCreateHook = (nuc: INucleonCore, options?: INuOptions) => void
export type PluginChangeHook = (n: INucleonCore, newValue: any) => void
export type PluginDeepChangeHandler = (n: INucleonCore, dsc: IDeepStateChange) => void
export type PluginDecayHook = (n: INucleonCore) => void

/**
 * Nucl plugin definition
 */
export interface INucleonPlugin {
  /** Unique plugin name */
  name: string

  /** 
   * Execution priority. 
   * Higher numbers run earlier. Default is 0. 
   * Negative numbers run later.
   */
  order?: number

  /** Unique plugin symbol (optional) */
  symbol?: Symbol

  /** Called when plugin is installed globally */
  onInstall?: () => void

  /** Called when Nucl instance is created */
  onCreate?: PluginCreateHook

  /** Called when Nucl instance changes */
  onBeforeChange?: PluginChangeHook
  onDeepChange?: PluginDeepChangeHandler

  /** Called when Nucl instance is disposed */
  onDecay?: PluginDecayHook

  methods?: Record<string | symbol, Function>
  properties?: PropertyDescriptorMap
}

/**
 * Optimized Registry stored for each Kind
 * Contains compiled (flattened) hooks for maximum performance
 */
export interface IPluginsRegistry {
  /** Compiled create hook (calls all plugin hooks) */
  onCreate: PluginCreateHook
  /** Compiled decay hook */
  onDecay: PluginDecayHook
  /** Compiled before change hook */
  onBeforeChange: PluginChangeHook
  
  // Deep hooks might still be an array if handled dynamically, 
  // but better to compile handleWatch directly.
  handleWatch: (n: INucleonCore, f: IDeepStateChange) => void
  
  proto: any
  haveDeepWatch: boolean
  _plugins: INucleonPlugin[]
}
