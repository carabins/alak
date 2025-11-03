import {createNu} from "./createNu";
import {NuOptions} from "./types";

/**
 * Create Nucl instance (OPTIMIZED)
 *
 * This function is a COMPLETE INLINE of createQu() logic,
 * with the critical difference that we setPrototypeOf to NuclProto instead of quarkProto.
 *
 * By doing this, we avoid the double setPrototypeOf that was killing V8 performance.
 */

export const Nu = createNu

// Export Nv as alias to Nucl
export const Nv = function <T>(value?: T, options?: NuOptions) {
  return createNu({...options, value})
}

// Export types
export type { Nu as NuType, NuRealms } from './types'
export type { NuOptions, NucleonPlugin } from './types'
export { createNuRealm } from './plugins'
