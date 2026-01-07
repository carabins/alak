import {extendRegistry, getRegistryForKind} from "./plugins";
import {INuOptions} from "./options";
import setValue from "@alaq/quark/setValue";
import setupQuarkAndOptions from "@alaq/quark/setupQuarkAndOptions";
import IQuark from "@alaq/quark/IQuark";
import {INucleonCore} from "./INucleon";

const defaultKind = "+"

export function createNu<T = any>(options?: INuOptions<T>): IQuark<T> {

  const kindInput = options?.kind || defaultKind
  
  // Resolve registry via string lookup
  let reg = getRegistryForKind(kindInput as string) as any

  // If instance-specific plugins are provided, create a specialized registry
  if (options?.plugins && options.plugins.length > 0) {
    reg = extendRegistry(kindInput as string, options.plugins)
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

  // ULTRA FAST: Use pre-calculated descriptors to flatten methods onto the instance
  // 1. Copy base methods (NuclearProto)
  const baseProto = Object.getPrototypeOf(reg.proto)
  if (baseProto && baseProto !== Function.prototype) {
    Object.defineProperties(nuq, Object.getOwnPropertyDescriptors(baseProto))
  }
  // 2. Copy plugin methods
  Object.defineProperties(nuq, Object.getOwnPropertyDescriptors(reg.proto))
  
  // Pass options WITHOUT value to setupQuarkAndOptions
  // This ensures setupQuarkAndOptions doesn't create an instance property 'value'
  // that would shadow our prototype getter/setter.
  const quarkOptions = { ...options }
  delete quarkOptions.value
  setupQuarkAndOptions(nuq, quarkOptions)

  // Initialize plugins
  reg.onCreate(core, options)

  // Set initial value using the SETTER (which is now on the instance via flattening)
  // This triggers the full update cycle:
  // 1. Setter updates _value
  // 2. Setter calls nuq(value) -> setValue -> clears IS_EMPTY flag
  // 3. nuq calls onBeforeChange -> plugins (deep-state) initialize
  if (options && options.value !== undefined) {
    nuq.value = options.value
  }

  return nuq as unknown as IQuark<T>
}