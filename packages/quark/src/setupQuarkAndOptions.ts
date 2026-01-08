import {DEDUP, EMIT_CHANGES, HAS_PIPE, HAS_REALM, IS_EMPTY, STATELESS} from './flags'
import {quantumBus} from './quantum-bus'
import IQuark from "./IQuark";
import {IQuOptions} from "./index";


let uidCounter = 0

export default function setupQuarkAndOptions<T extends any>(quark: Function & any, options?: IQuOptions, initValue: boolean = true): IQuark<T> {

  quark.uid = ++uidCounter
  // Enable DEDUP by default
  quark._flags = IS_EMPTY | DEDUP


  if (options) {
    // Handle value only if initValue is true
    if (initValue && options.value !== undefined) {
      quark.value = options.value
    }

    if (options.id) {
      quark.id = options.id
    }

    if (options.realm) {
      const realm = options.realm
      quark.realm = realm
      quark._flags |= HAS_REALM
      if (!quark._bus) {
        quark._bus = quantumBus.getRealm(quark.realm || '+')
      }
    }

    if (options.scope) {
      quark._scope = options.scope
    }

    if (options.pipe) {
      quark._flags |= HAS_PIPE
      quark._pipeFn = options.pipe
    }

    if (options.emitChanges) {
      quark._flags |= EMIT_CHANGES
    }

    // Disable DEDUP if explicitly requested
    if (options.dedup === false) {
      quark._flags &= ~DEDUP
    }

    if (options.stateless) {
      quark._flags |= STATELESS
    }
  }

  if (initValue && quark.value !== undefined) quark(quark.value)
  return quark as IQuark<T>
}
