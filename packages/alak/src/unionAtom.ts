import { alakConstructor } from './constructor'
import { ActiveUnions, defaultNamespace } from 'alak/namespaces'
import { deleteParams } from '@alaq/nucleus/utils'
import { QuarkEventBus } from '@alaq/nucleus/bus'
import { GetUnionCore } from 'alak/UnionCore'

// export function UnionAtom<M, E extends object, N>(constructor: IAlakConstructor<M, E, N>) {
//   return unionAtom(constructor) as IUnionAtom<M, E>
// }

export function unionAtom(constructor, id?, data?) {
  if (!constructor.name) {
    console.warn('отсутствует имя атома')
  }
  if (!constructor.namespace) {
    constructor.namespace = defaultNamespace
  }

  const name = id ? constructor.name + '.' + id : constructor.name
  const union = GetUnionCore(constructor.namespace)
  const quantum: QuantumAtom = {
    name,
    union,
  }

  if (id) {
    quantum.id = id
  }
  if (data) {
    quantum.data = data
  }

  const up = () => {
    quantum.bus = constructor.globalBus ? union.bus : QuarkEventBus(name)
    alakConstructor(constructor, quantum)
    deleteParams(constructor)
  }

  if (constructor.startup === 'immediately') {
    up()
  }

  const pk = {}

  function makeProxyKey(path) {
    return new Proxy(quantum, {
      get(o, k) {
        !quantum.atom && up()
        return quantum.atom[path][k]
      },
    })
  }

  const proxy = new Proxy(quantum, {
    get(target: any, key): any {
      switch (key) {
        case 'state':
        case 'core':
        case 'bus':
        case 'nodes':
        case 'actions':
          let proxyCache = pk[key]
          if (!proxyCache) {
            proxyCache = pk[proxyCache] = makeProxyKey(key)
          }
          return proxyCache
        case 'known':
          !quantum.atom && up()
          return quantum.atom.known
        case 'decay':
          return decay
        default:
          return quantum.name + ':' + quantum.id
      }
    },
  })

  function decay() {
    quantum.bus.dispatchEvent('UNION_ATOM_DECAY', quantum)
    delete union.services.atoms[quantum.name]
    quantum.atom && quantum.atom.decay()
    if (!constructor.globalBus) {
      quantum.bus.decay()
    }
    deleteParams(pk)
    deleteParams(constructor)
    deleteParams(quantum)
  }

  union.services.atoms[quantum.name] = proxy
  return proxy
}

export const UnionAtom = unionAtom as <M, E extends object, N>(
  constructor: IAlakConstructor<M, E, N>,
) => IUnionAtom<M, E>

export function atomic<M, NS extends keyof ActiveUnions>(model: M, namespace?: NS) {
  if (!namespace) {
    namespace = defaultNamespace as any
  }
  // return UnionAtom({model, namespace})
}
export function UnionAtomFactory<M, E extends object, N>(constructor: IAlakConstructor<M, E, N>) {
  const nodes = {}
  const bus = QuarkEventBus(constructor.name)
  const broadcast = new Proxy(
    {},
    {
      get(target: {}, p: string | symbol): any {
        return (v) => Object.values(nodes).forEach((n) => n[p](v))
      },
    },
  ) as IUnionAtom<M, E>['core']
  return {
    get(id, target?) {
      let atomicFactory = nodes[id] as IUnionAtom<any, any>
      if (!atomicFactory) {
        atomicFactory = nodes[id] = unionAtom(Object.assign({}, constructor), id, target)
        bus.addBus(atomicFactory.bus)
      }
      return atomicFactory as IUnionAtom<M, E>
    },
    delete(id) {
      const n = nodes[id]
      bus.removeBus(n.bus)
      n.decay()
      delete nodes[id]
    },
    broadcast,
    bus,
  } as IAlakAtomFactory<M, E>
}
