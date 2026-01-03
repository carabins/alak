import {getPluginsForRealm} from "./plugins";
import defaultRealm from "./defaultRealm";
import {INuOptions} from "./index";
import setValue from "@alaq/quark/setValue";
import setupQuarkAndOptions from "@alaq/quark/setupQuarkAndOptions";
import IQuark from "@alaq/quark/IQuark";


export function createNu<T = any>(options?: INuOptions<T>): IQuark<T> {

  const reg = getPluginsForRealm(options?.realm || defaultRealm)
  let isSetting = false


  function nuq(value: any) {
    if (isSetting) return
    isSetting = true
    for (const h of reg.beforeChangeHooks) {
      //@ts-ignore
      h(nuq, value)
    }
    setValue(nuq as any, value)
    isSetting = false
  }

  nuq._reg = reg

  if (options) {
    if (options.immutable) {
      nuq.isIm = true
    }
  }
  Object.setPrototypeOf(nuq, reg.proto)
  setupQuarkAndOptions(nuq)

  for (const h of reg.createHooks) {
    //@ts-ignore
    h(nuq, options)
  }

  if (options && options.value !== undefined) {
    nuq(options.value)
  }
  return nuq as unknown as IQuark<T>
}
