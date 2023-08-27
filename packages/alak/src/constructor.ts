import { Nucleus, QuarkEventBus } from '@alaq/nucleus/index'
import { Atom } from '@alaq/atom/index'
import alakListeners from './listeners'
import alakExtension from './extension'

export function alakConstructor<M, E, N>(
  constructor: AlakConstructor<M, E, N>,
  quantum: QuantumAtom,
) {
  const atom = Atom({
    model: constructor.model,
    name: quantum.name,
    emitChanges: constructor.emitChanges,
    saved: constructor.nucleusStrategy === 'saved' ? '*' : null,
    thisExtension: alakExtension(quantum),
    constructorArgs: [quantum.id, quantum.target],
    bus: quantum.bus,
  }) as any
  const nodes = {}

  // const eventBus = Nucleus.stateless().holistic()

  // constructor.nodes &&
  //   Object.keys(constructor.nodes).forEach((key) => {
  //     const subAtom = constructor.nodes[key]
  //     subAtom.name = quantum.name ? quantum.name + '.' + key : key
  //     // subAtom.injectBus = eventBus
  //     nodes[key] = subAtom
  //   })

  const getFromNode = ([nodeKey, targetKey]: string[]) => {
    const node = nodes[nodeKey]
    return node.core[targetKey]
  }

  const getNode = (n: string) => {
    const parts = n.split('.')
    if (parts.length > 1) {
      return getFromNode(parts)
    } else {
      return atom.core[n]
    }
  }

  // constructor.edges &&
  //   constructor.edges.forEach((e) => {
  //     const listeners = []
  //     if (typeof e.to === 'string') {
  //       listeners.push(getNode(e.to))
  //       //@ts-ignore
  //     } else if (e.to?.length) {
  //       //@ts-ignore
  //       listeners.push(...e.to.map(getNode))
  //     }
  //     if (typeof e.from === 'string') {
  //       //@ts-ignore
  //       listeners.forEach((l) => getNode(e.from).up(l))
  //     } else {
  //       //@ts-ignore
  //       const fromNodes = e.from.map(getNode)
  //       const n = Nucleus.stateless()
  //       const strategy = e.strategy.toLocaleLowerCase() || 'some'
  //       const strategyMethod = n.from(...fromNodes)[strategy]
  //       if (!strategyMethod) {
  //         console.error(
  //           `unsupported strategy [ ${e.strategy.toUpperCase()}  ]in atomic node ${constructor.name.toString()} for edge`,
  //           e,
  //         )
  //         throw 'unsupported strategy'
  //       }
  //       strategyMethod(listeners[0])
  //     }
  //   })
  const an = { nodes } as any
  quantum.atom = Object.assign(an, atom)
  // console.log(quantum.union)

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
    quantum.union.bus.addEverythingListener(eventListener)
  }

  const c1 = quantum.bus.addEventToBus('NUCLEUS_INIT', quantum.union.bus)
  const c2 = quantum.bus.addEventToBus('NUCLEUS_CHANGE', quantum.union.bus)

  quantum.bus.addEventListener('ATOM_DECAY', () => {
    quantum.bus.removeEventToBus(c1)
    quantum.bus.removeEventToBus(c2)
  })

  quantum.id && atom.core.id(quantum.id)
  quantum.target && atom.core.target(quantum.target)
  atom.actions.onActivate && atom.actions.onActivate(quantum.id, quantum.target)
  // constructor.activate && constructor.activate.apply(atom.state, [atom.core, nodes])
  quantum.union.bus.dispatchEvent('ATOM_INIT', { name: quantum.name, atom })
}
