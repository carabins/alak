import {createNu} from "./createNu";

import {INucleonPlugin} from "./INucleonPlugin";
import {IQuOptions} from "@alaq/quark";

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


/**
 * Create Nucl instance
 *
 * This function is a COMPLETE INLINE of createQu() logic,
 * with the critical difference that we setPrototypeOf to NuclProto instead of quarkProto.
 *
 * By doing this, we avoid the double setPrototypeOf that was killing V8 performance.
 */

export const Nu = createNu

// Export Nv as alias to Nucl
export const Nv = function <T>(value?: T, options?: INuOptions) {
  return createNu({...options, value})
}

// Export types

export {createNuRealm} from './plugins'
export {deepStatePlugin} from './deep-state/plugin'
