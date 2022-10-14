import { atomicConstructor } from './atomicConstructor'
import { getAtomCluster } from './index'

export function proxyAtom(constructor, id?, target?) {
  // constructor = Object.assign({}, constructor)

  if (!constructor.name) {
    console.warn('отсутствует имя атома')
  }

  const name = id ? constructor.name + '.' + id : constructor.name
  const quantum: QuantumAtom = {
    name,
    cluster: constructor.cluster ? getAtomCluster(constructor.cluster) : getAtomCluster(),
  }
  if (id) {
    quantum.id = id
  }
  if (target) {
    quantum.target = target
  }
  quantum.eventBus = quantum.cluster.eventBus
  const up = () => {
    atomicConstructor(constructor, quantum)
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
        case 'emitEvent':
          !quantum.atom && up()
          return quantum.atom.emitEvent
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
