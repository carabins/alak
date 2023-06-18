import { alakConstructor } from './constructor'
import { activeCluster, QuarkEventBus } from './index'

export function proxyAtom(constructor, id?, target?) {
  // constructor = Object.assign({}, constructor)

  if (!constructor.name) {
    console.warn('отсутствует имя атома')
  }

  const name = id ? constructor.name + '.' + id : constructor.name
  const cluster = constructor.cluster ? activeCluster(constructor.cluster) : activeCluster()
  const quantum: QuantumAtom = {
    name,
    cluster,
    bus: QuarkEventBus(name),
  }

  if (id) {
    quantum.id = id
  }
  if (target) {
    quantum.target = target
  }
  // quantum.eventBus = quantum.cluster.eventBus
  quantum.cluster.bus
  const up = () => {
    alakConstructor(constructor, quantum)
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
    get(target: any, p: string | symbol): any {
      switch (p) {
        case 'state':
        case 'core':
        case 'nodes':
        case 'actions':
          let pp = pk[p]
          if (!pp) {
            pp = pk[pp] = makeProxyKey(p)
          }
          return pp
        case 'bus':
          !quantum.atom && up()
          return quantum.bus
        // case 'emitEvent':
        //   return quantum.atom.emitEvent
        case 'getValues':
          return () => {
            !quantum.atom && up()
            const v = {}
            Object.keys(quantum.atom['knownKeys']).forEach((k) => {
              v[k] = quantum.atom.state[k]
            })
            return v
          }
        case 'onActivate':
          return (listener) => {
            target.activateListeners.push(listener)
          }
      }
    },
  })
  quantum.cluster.atoms[quantum.name] = proxy
  return proxy
}
