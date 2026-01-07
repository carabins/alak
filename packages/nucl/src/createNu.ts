import {extendRegistry, getRegistryForKind} from "./plugins";
import {INuOptions} from "./options";
import setValue from "@alaq/quark/setValue";
import setupQuarkAndOptions from "@alaq/quark/setupQuarkAndOptions";
import IQuark from "@alaq/quark/IQuark";
import {INucleonCore} from "./INucleon";

const defaultKind = "+"

export function createNu<T = any>(options?: INuOptions<T>): IQuark<T> {

  const kindInput = options?.kind || defaultKind
  
  // Resolve registry: string (lookup) or object (direct)
  let reg = (typeof kindInput === 'string') 
    ? getRegistryForKind(kindInput)
    : kindInput as any // Cast to registry

  if (options?.plugins && options.plugins.length > 0) {
    reg = extendRegistry(kindInput as any, options.plugins)
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

  // Flatten prototype chain onto the instance because changing function prototype is flaky
  // 1. Copy base methods (NuclearProto: value, up, down, etc.)
  const baseProto = Object.getPrototypeOf(reg.proto)
  if (baseProto && baseProto !== Function.prototype) {
    Object.defineProperties(nuq, Object.getOwnPropertyDescriptors(baseProto))
  }

  // 2. Copy plugin methods (reg.proto own properties)
  Object.defineProperties(nuq, Object.getOwnPropertyDescriptors(reg.proto))
  
  // Object.setPrototypeOf(nuq, reg.proto) // Removed setPrototypeOf
  
  // Directly set _value, so we don't need to pass 'value' to setupQuarkAndOptions
  // This prevents Quark from creating an instance property that shadows the prototype getter.
  if (options && options.value !== undefined) {
    nuq._value = options.value
  }

  // Pass options without value
  const quarkOptions = { ...options }
  delete quarkOptions.value
  setupQuarkAndOptions(nuq, quarkOptions)

  // Optimized single call
  reg.onCreate(core, options)

  // Trigger onBeforeChange to allow plugins to initialize state (e.g. deep-state setting _state)
  // We do this manually instead of calling nuq(value) to avoid dedup checks and overhead.
  if (options && options.value !== undefined) {
    reg.onBeforeChange(core, options.value)
  }

  // No need to call nuq(value) because setter handles reactivity if set later,
  // and _value is already set for initial state.
  return nuq as unknown as IQuark<T>
}