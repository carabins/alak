import {createNu} from "./createNu";

import {INucleonPlugin} from "./INucleonPlugin";
import {INuOptions} from "./options";



export const Nu = createNu


export const Nv = function <T>(value?: T, options?: INuOptions) {
  return createNu({...options, value})
}


export { fusion } from './fusion/fusion'


export type { INuOptions } from './options'
export {defineKind, combineKinds} from './plugins'
export {deepStatePlugin} from './deep-state/plugin'