import {IQuOptions} from "@alaq/quark";
import {INucleonPlugin} from "./INucleonPlugin";


export interface INuOptions<T = any> extends IQuOptions<T> {
  
  realm?: string
  
  immutable?: boolean
  
  deepWatch?: boolean

  plugins?: INucleonPlugin[]
}
