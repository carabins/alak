import { Nucleus } from '@alaq/nucleus/index'
import { Atom } from '@alaq/atom/index'

const newAtom = (constructor) => {
  const { model, eternal, name } = constructor
  return Atom({
    model,
    eternal,
    name,
  })
}

export function atomicConstructor<M, E, N, Events extends readonly string[]>(
  constructor: AtomicConstructor<M, E, N, Events>,
  quantum: QuantumAtom,
) {
  const name = constructor.name || quantum.name || 'root'
  const atom = newAtom(constructor)
  const nodes = {}
  const eventBus = Nucleus.stateless().holistic()
  quantum.id && atom.core.id(quantum.id)
  quantum.target && atom.core.target(quantum.target)
  constructor.nodes &&
    Object.keys(constructor.nodes).forEach((key) => {
      const subAtom = constructor.nodes[key]
      subAtom.name = quantum.name ? quantum.name + '.' + key : key
      subAtom.injectBus = eventBus
      nodes[key] = subAtom
    })

  const getFromNode = ([nodeKey, targerKey]: string[]) => {
    const node = nodes[nodeKey]
    !node &&
      console.error(
        `empty sub-node [${nodeKey + '.' + targerKey}] in atomic node ${name.toUpperCase()} `,
      )
    return node.core[targerKey]
  }
  const getNode = (n: string) => {
    const parts = n.split('.')
    if (parts.length > 1) {
      return getFromNode(parts)
    } else {
      return atom.core[n]
    }
  }
  constructor.edges &&
    constructor.edges.forEach((e) => {
      const listiners = []
      if (typeof e.to === 'string') {
        listiners.push(getNode(e.to))
      } else if (e.to?.length) {
        listiners.push(...e.to.map(getNode))
      }
      if (!listiners.length) {
        console.error(`empty listener in atomic node ${name.toUpperCase()} for edge`, e)
      }
      if (typeof e.from === 'string') {
        listiners.forEach((l) => getNode(e.from).up(l))
      } else {
        const fromNodes = e.from.map(getNode)
        const n = Nucleus.stateless()
        const strategy = e.strategy || 'some'
        const strategyMethod = n.from(...fromNodes)[strategy]
        if (!strategyMethod) {
          console.error(
            `unsupported strategy [ ${e.strategy.toUpperCase()}  ]in atomic node ${name.toString()} for edge`,
            e,
          )
          throw 'unsupported strategy'
        }
        strategyMethod(listiners[0])
      }
    })

  if (constructor.listen) {
    const eventListener = (event, data) => {
      const apply = (where) => {
        const fn = getNode(where)
        fn && fn(data)
      }
      const listenerName = constructor.listen[event]
      if (listenerName) {
        if (typeof listenerName === 'string') {
          apply(listenerName)
        } else {
          listenerName.forEach(apply)
        }
      }
    }
    eventBus.up(eventListener)
    quantum.eventBus?.up(eventListener)
  }
  const an = { nodes, emitEvent: eventBus } as any

  constructor.activate && constructor.activate.apply(atom.state, [atom.core, nodes])
  quantum.atom = Object.assign(an, atom)
}
