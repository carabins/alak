import { Nucleus, QuarkEventBus } from '@alaq/nucleus/index'
import { Atom } from '@alaq/atom/index'
import alakListeners from './listeners'
import alakExtension from './extension'

export function alakConstructor<M, E, N>(
  constructor: IAlakConstructor<M, E, N>,
  quantum: QuantumAtom,
) {
  const atom = Atom({
    model: constructor.model,
    name: quantum.name,
    emitChanges: constructor.emitChanges,
    saved: constructor.nucleusStrategy === 'saved' ? '*' : null,
    thisExtension: alakExtension(quantum),
    constructorArgs: [quantum.id, quantum.data],
    bus: quantum.bus,
  }) as IAtom<any>

  const getNode = (n: string) => {
    const parts = n.split('.')
    return atom.core[n]
  }

  //@ts-ignore
  quantum.atom = atom

  const al = alakListeners(quantum)
  if (al) {
    const eventListener = (event, data) => {
      const apply = (where) => {
        const fn = getNode(where)
        fn && fn(data)
      }

      const listenerName = al[event]

      if (listenerName) {
        if (typeof listenerName === 'string') {
          apply(listenerName)
        } else {
          //@ts-ignore
          listenerName.forEach(apply)
        }
      }
    }
    quantum.bus.addEverythingListener(eventListener)
  }

  const toUpEvents = new Set(['NUCLEUS_INIT', 'NUCLEUS_CHANGE'])
  const unbindKeys = Array.from(toUpEvents).map((e) =>
    quantum.bus.addEventToBus(e, quantum.union.bus),
  )

  const busBridge = (e: string, d) => {
    !toUpEvents.has(e) && quantum.bus.dispatchEvent(e, d)
  }
  quantum.union.bus.addEverythingListener(busBridge)

  quantum.bus.addEventListener('ATOM_DECAY', (q: QuantumAtom) => {
    if (q.id === quantum.id) {
      unbindKeys.forEach(quantum.bus.removeEventToBus)
      quantum.bus.removeListener(busBridge)
      // Object.values(atom.core).forEach((n:)=>{
      //   atom.core
      // })
    }
  })

  quantum.id && atom.core.id(quantum.id)
  quantum.data && atom.core.data(quantum.data)
  // atom.actions.onActivate && atom.actions.onActivate(quantum.id, quantum.data)
  quantum.bus.dispatchEvent('INIT', {
    [quantum.id && 'id']: quantum.id,
    [quantum.data && 'data']: quantum.data,
  })
  quantum.union.bus.dispatchEvent('ATOM_INIT', {
    name: quantum.name,
    atom,
  })
}
