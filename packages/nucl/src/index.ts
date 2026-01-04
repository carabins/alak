import {createNu} from "./createNu";

import {INucleonPlugin} from "./INucleonPlugin";
import {INuOptions} from "./options";

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
export type { INuOptions } from './options'
export {defineKind, combineKinds} from './plugins'
export {deepStatePlugin} from './deep-state/plugin'
