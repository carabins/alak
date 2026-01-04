import {getRegistryForKind, extendRegistry} from "./plugins";
import defaultRealm from "./defaultRealm";
import {INuOptions} from "./options";
import setValue from "@alaq/quark/setValue";
import setupQuarkAndOptions from "@alaq/quark/setupQuarkAndOptions";
import IQuark from "@alaq/quark/IQuark";
import {INucleonCore} from "./INucleon";


export function createNu<T = any>(options?: INuOptions<T>): IQuark<T> {

  const kind = options?.kind || defaultRealm
  let reg = getRegistryForKind(kind)

  if (options?.plugins && options.plugins.length > 0) {
    reg = extendRegistry(kind, options.plugins)
  }

  let isSetting = false

  function nuq(value: any) {
    if (isSetting) return
    isSetting = true
    
    // Optimized single call
    reg.onBeforeChange(nuq as unknown as INucleonCore, value)
    
    setValue(nuq as any, value)
    isSetting = false
  }

  nuq._reg = reg
  
  // Initialize potential properties for shape stability (Monomorphism)
  // Casting to allow assignment even if interface marks them optional
  const core = nuq as unknown as INucleonCore
  core._isDeep = undefined
  core._isDeepAwake = undefined
  core._watcher = undefined
  core._state = undefined

  if (options) {
    if (options.immutable) {
      nuq.isIm = true
    }
  }
  
  Object.setPrototypeOf(nuq, reg.proto)
  setupQuarkAndOptions(nuq)

  // Optimized single call
  reg.onCreate(core, options)

  if (options && options.value !== undefined) {
    nuq(options.value)
  }
  return nuq as unknown as IQuark<T>
}
