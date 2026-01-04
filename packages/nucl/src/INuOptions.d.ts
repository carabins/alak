import {IQuOptions} from "@alaq/quark";
import {INucleonPlugin} from "./INucleonPlugin";

/**
 * Extended options for Nucl
 */
export interface INuOptions<T = any> extends IQuOptions<T> {
  /** Realm to use for this instance - determines which plugins are active */
  realm?: string
  /** Enable immutability - creates new copies on each update */
  immutable?: boolean
  /** Enable deep tracking - tracks changes in nested objects/arrays */
  deepWatch?: boolean

  plugins?: INucleonPlugin[]
}
