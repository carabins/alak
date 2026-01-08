import {IQuOptions} from "@alaq/quark";
import {INucleonPlugin, IPluginsRegistry} from "./INucleonPlugin";
import {SpaceSeparatedKeys} from "./types/combinations";


export interface NuclearKindRegistry {
  
}


export type NuclearKindSelector = SpaceSeparatedKeys<NuclearKindRegistry>


export interface INuOptions<T = any> extends IQuOptions<T> {
  
  realm?: string
  
  
  kind?: NuclearKindSelector
  
  
  immutable?: boolean

  
  plugins?: INucleonPlugin[]
}