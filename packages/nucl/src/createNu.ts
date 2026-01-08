import {extendRegistry, getRegistryForKind} from "./plugins";
import {INuOptions} from "./options";
import setValue from "@alaq/quark/setValue";
import setupQuarkAndOptions from "@alaq/quark/setupQuarkAndOptions";
import IQuark from "@alaq/quark/IQuark";
import {INucleonCore} from "./INucleon";

const defaultKind = "+"

const defaultReg = getRegistryForKind(defaultKind) as any

export function createNu<T = any>(options?: INuOptions<T>): IQuark<T> {

  let reg = defaultReg

  if (options) {
    
    if (options.kind && options.kind !== defaultKind) {
      reg = getRegistryForKind(options.kind)
    }
    
    if (options.plugins && options.plugins.length > 0) {
      reg = extendRegistry(options.kind || defaultKind, options.plugins)
    }
  }

  let isSetting = false

  function nuq(value?: any) {
    if (arguments.length === 0) return (nuq as any)._value

    if (isSetting) return
    isSetting = true

    reg.onBeforeChange(nuq as unknown as INucleonCore, value)

    setValue(nuq as any, value)
    isSetting = false
  }

  nuq._reg = reg

  
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

  
  setupQuarkAndOptions(nuq, options, false)

  
  reg.onCreate(core, options)

  
  
  
  
  
  if (options && options.value !== undefined) {
    nuq.value = options.value
  }

  return nuq as unknown as IQuark<T>
}
