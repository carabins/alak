import { Nucleus } from '@alaq/nucleus/index'
import { Atom } from '@alaq/atom/index'

const newAtom = (constructor) => {
  const { model, name } = constructor

  return Atom({
    model,
    name,
    eternal: constructor.nucleusStrategy === 'eternal' ? '*' : null,
  })
}

export function atomicConstructor<M, E, N>(
  constructor: AtomicConstructor<M, E, N>,
  quantum: QuantumAtom,
) {
  let name = constructor.name || quantum.name || 'atom'
  if (quantum.id) {
    name = name + '.' + quantum.id
    constructor = Object.assign({ name }, constructor)
  }
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

  const getFromNode = ([nodeKey, targetKey]: string[]) => {
    const node = nodes[nodeKey]
    !node &&
      console.error(
        `empty sub-node [${nodeKey + '.' + targetKey}] in atomic node ${name.toUpperCase()} `,
      )
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

  constructor.edges &&
    constructor.edges.forEach((e) => {
      const listiners = []
      if (typeof e.to === 'string') {
        listiners.push(getNode(e.to))
        //@ts-ignore
      } else if (e.to?.length) {
        //@ts-ignore
        listiners.push(...e.to.map(getNode))
      }
      if (!listiners.length) {
        console.error(`empty listener in atomic node ${name.toUpperCase()} for edge`, e)
      }
      if (typeof e.from === 'string') {
        //@ts-ignore
        listiners.forEach((l) => getNode(e.from).up(l))
      } else {
        //@ts-ignore
        const fromNodes = e.from.map(getNode)
        const n = Nucleus.stateless()
        const strategy = e.strategy.toLocaleLowerCase() || 'some'
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
          //@ts-ignore
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
