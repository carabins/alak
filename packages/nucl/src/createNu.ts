import type {NuOptions} from './types'

import {createQu, DEEP_TRACKING, IMMUTABLE, setValue} from '@alaq/quark'
import INucleusQuark from "./types/core";
import {getPluginsForRealm} from "./plugins";
import defaultRealm from "./defaultRealm";





export function createNu<T = any>(options?: NuOptions<T>): any {

  const reg = getPluginsForRealm(options?.realm || defaultRealm)

  const nuq = function (this: any, value: any) {
    for (const h of reg.beforeChangeHooks) {
      h(nuq, value, nuq._value)
    }
    return setValue(nuq, value)
  } as INucleusQuark<any>

  if (options) {
    if (options.deepTracking) {
      nuq._flags |= DEEP_TRACKING
    }
    if (options.immutable) {
      nuq._flags |= IMMUTABLE
    }
  }
  nuq._reg = reg
  createQu({_extend: nuq})
  Object.setPrototypeOf(nuq, reg.proto)

  if (options?.value !== undefined) {
    nuq(options.value)
  }
  for (const h of reg.createHooks) {
    h(nuq)
  }

  return nuq
}
