import {IDeepStateChange} from "@alaq/deep-state/types";
import {INucleonCore} from "@alaq/nucl/INucleon";
import {INuOptions} from "./options";


export type PluginCreateHook = (nuc: INucleonCore, options?: INuOptions) => void
export type PluginChangeHook = (n: INucleonCore, newValue: any) => void
export type PluginDeepChangeHandler = (n: INucleonCore, dsc: IDeepStateChange) => void
export type PluginDecayHook = (n: INucleonCore) => void


export interface INucleonPlugin {
  
  name: string

  
  order?: number

  
  symbol?: Symbol

  
  onInstall?: () => void

  
  onCreate?: PluginCreateHook

  
  onBeforeChange?: PluginChangeHook
  onDeepChange?: PluginDeepChangeHandler

  
  onDecay?: PluginDecayHook

  methods?: Record<string | symbol, Function>
  properties?: PropertyDescriptorMap
}


export interface IPluginsRegistry {
  
  onCreate: PluginCreateHook
  
  onDecay: PluginDecayHook
  
  onBeforeChange: PluginChangeHook
  
  
  
  handleWatch: (n: INucleonCore, f: IDeepStateChange) => void
  
  proto: any
  haveDeepWatch: boolean
  _plugins: INucleonPlugin[]
}
