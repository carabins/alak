import { alakConstructor } from './constructor'
import { QuarkEventBus } from './index'
import { UnionCoreFactory } from 'alak/namespaces'

export function proxyAtom(constructor, id?, target?) {
  // constructor = Object.assign({}, constructor)

  if (!constructor.name) {
    console.warn('отсутствует имя атома')
  }

  const name = id ? constructor.name + '.' + id : constructor.name
  const union = UnionCoreFactory(constructor.namespace)
  const quantum: QuantumAtom = {
    name,
    union,
    bus: QuarkEventBus(name),
  }

  if (id) {
    quantum.id = id
  }
  if (target) {
    quantum.target = target
  }

  const up = () => {
    alakConstructor(constructor, quantum)
  }

  if (constructor.startup === 'immediately') {
    up()
  }

  const pk = {}
  const kv = {}

  function makeProxyKey(path) {
    return new Proxy(quantum, {
      get(o, k) {
        !quantum.atom && up()
        return quantum.atom[path][k]
      },
    })
  }

  const getKnows = (knownKey) => {
    !quantum.atom && up()
    const v = {}
    Object.keys(quantum.atom[knownKey]).forEach((k) => {
      v[k] = quantum.atom.state[k]
    })
    return v
  }
  const proxy = new Proxy(quantum, {
    get(target: any, p: string | symbol): any {
      switch (p) {
        case 'kv':
          return kv
        case 'state':
        case 'core':
        case 'bus':
        case 'nodes':
        case 'actions':
          let pp = pk[p]
          if (!pp) {
            pp = pk[pp] = makeProxyKey(p)
          }
          return pp
        case 'get':
          return () => {
            !quantum.atom && up()
            const v = {}
            Object.keys(quantum.atom['knownKeys']).forEach((k) => {
              v[k] = quantum.atom.state[k]
            })
            return v
          }
        case 'getActions':
          return () => getKnows('knownActions')
        case 'getValues':
          return () => getKnows('knownKeys')
        case 'onActivate':
          return (listener) => {
            target.activateListeners.push(listener)
          }
      }
    },
  })

  union.services.atoms[quantum.name] = proxy
  return proxy
}
