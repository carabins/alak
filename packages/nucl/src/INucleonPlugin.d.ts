import INucleusCore from "./core";
import {IDeepStateChange} from "@alaq/deep-state/types";
import {INucleonCore} from "@alaq/nucl/INucleon";

/**
 * Nucl plugin definition
 */
export interface INucleonPlugin {
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
  onDeepChange?: PluginDeepChangeHandler

  /** Called when Nucl instance is disposed */
  onDecay?: PluginHandler

  deepWatch?: (n: INucleusCore<any>, dsc:IDeepStateChange) => void

  methods?: any
  properties?: any

  // /** Called when property is accessed */
  // onGet?: (nucl: any, key: string, value: any) => void
  //
  // /** Called when property is set */
  // onSet?: (nucl: any, key: string, value: any) => void
}

type PluginHandler = (nuc: INucleusCore<any>, ...options: any[]) => void
type PluginChangeHandler = (n: INucleusCore<any>, newValue: any) => void
type PluginDeepChangeHandler = (n: INucleusCore<any>, dsc:IDeepStateChange) => void

export interface IPluginsRegistry {
  createHooks: PluginHandler[]
  decayHooks: PluginHandler[]
  beforeChangeHooks: PluginChangeHandler[]
  deepChangeHooks: PluginDeepChangeHandler[]
  // afterChangeHooks: PluginChangeHandler[]
  proto: any
  haveDeepWatch: boolean
  handleWatch(n: INucleonCore, f: IDeepStateChange):void
}
