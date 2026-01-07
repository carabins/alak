import {extendRegistry, getRegistryForKind} from "./plugins";
import {INuOptions} from "./options";
import setValue from "@alaq/quark/setValue";
import setupQuarkAndOptions from "@alaq/quark/setupQuarkAndOptions";
import IQuark from "@alaq/quark/IQuark";
import {INucleonCore} from "./INucleon";

const defaultKind = "+"
// Cache default registry for performance
const defaultReg = getRegistryForKind(defaultKind) as any

export function createNu<T = any>(options?: INuOptions<T>): IQuark<T> {

  let reg = defaultReg

  if (options) {
    // If kind is specified and different, resolve it
    if (options.kind && options.kind !== defaultKind) {
      reg = getRegistryForKind(options.kind)
    }
    // If instance-specific plugins are provided, create a specialized registry
    if (options.plugins && options.plugins.length > 0) {
      reg = extendRegistry(options.kind || defaultKind, options.plugins)
    }
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

  // Use setPrototypeOf for max performance (matches Quark behavior)
  Object.setPrototypeOf(nuq, reg.proto)

  // Pass options directly with initValue=false to avoid cloning and premature initialization
  setupQuarkAndOptions(nuq, options, false)

  // Initialize plugins
  reg.onCreate(core, options)

  // Set initial value using the SETTER (which is now on the instance via setPrototypeOf)
  // This triggers the full update cycle:
  // 1. Setter updates _value
  // 2. Setter calls nuq(value) -> setValue -> clears IS_EMPTY flag
  // 3. nuq calls onBeforeChange -> plugins (deep-state) initialize
  if (options && options.value !== undefined) {
    nuq.value = options.value
  }

  return nuq as unknown as IQuark<T>
}
