import IQuarkCore from "./IQuarkCore";
import {DEDUP, IS_AWAKE, HAS_REALM_AND_EMIT, HAS_REALM_AWAKE, IS_EMPTY, SILENT, STATELESS} from "./flags";
import {quantumBus} from "./quantum-bus";


export default function setValue<T>(quark: IQuarkCore, value: T): void {
  const flags = quark._flags

  if (quark._pipeFn) {
    const transformed = quark._pipeFn(value)
    if (transformed === undefined) return
    value = transformed
  }


  if (flags & IS_EMPTY) {
    quark._flags &= ~IS_EMPTY
  }

  if (flags & DEDUP && quark.value === value) {
    return
  }

  if (!(flags & STATELESS)) {
    quark.value = value
  }

  if (flags & SILENT) {
    return
  }

  if ((flags & HAS_REALM_AWAKE) === HAS_REALM_AWAKE) {
    quantumBus.emit(quark.realm, 'QUARK_AWAKE', {
      id: quark.id,
      value,
      quark,
    })
  }

  if (flags & IS_AWAKE) {
    const edges = quark._edges
    for (let i = 0, len = edges.length; i < len; i++) {
      edges[i](value, quark)
    }
  }

  if ((flags & HAS_REALM_AND_EMIT) === HAS_REALM_AND_EMIT) {
    quark._bus.emit('QUARK_CHANGE', {
      id: quark.id,
      value,
      quark,
    })
  }
}
