import { QuarkEventBus } from '@alaq/nucleus/bus'
import { defaultNamespace, getNamespaces, UnionNamespaces } from 'alak/namespaces'

const atomLinked = {
  buses: 'bus',
  cores: 'core',
  actions: 'action',
  states: 'state',
}

const linkedProxy = {}
const linkedProxyHandler = {
  get(o, key) {
    return o.atoms[key][o.key]
  },
}
const facadeHandlers = {
  get(target: IUnionCoreService<any, any, any>, key): any {
    if (atomLinked[key]) {
      if (!linkedProxy[key]) {
        linkedProxy[key] = new Proxy(
          { atoms: target.atoms, key: atomLinked[key] },
          linkedProxyHandler,
        )
      }
      return linkedProxy[key]
    }
    return target[key]
  },
}

export function ExtendUnionCore<N extends keyof UnionNamespaces>(namespace: N): UnionNamespaces[N] {
  const ns = namespace || defaultNamespace
  const namespaces = getNamespaces()

  if (namespaces[ns]) {
    return namespaces[ns]
  }
  const bus = QuarkEventBus(ns)
  const services = {
    atoms: {},
    bus,
  }
  const uc = {
    services,
    facade: new Proxy(services, facadeHandlers),
    bus,
  } as any
  namespaces[ns] = uc
  return namespaces[ns]
}

export function InjectUnionFacade<N extends keyof UnionNamespaces>(
  namespace?: N,
): UnionNamespaces[N]['facade'] {
  if (!namespace) {
    namespace = defaultNamespace as any
  }
  const namespaces = getNamespaces()
  if (!namespaces[namespace]) {
    console.error('namespace', namespace, 'not found')
    throw 'unknown namespace'
  }
  return namespaces[namespace]['facade']
}
