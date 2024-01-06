import {QuarkEventBus} from "@alaq/nucleus/bus";
import {defaultNamespace, getNamespaces, UnionNamespaces} from "alak/namespaces";


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
          {atoms: target.atoms, key: atomLinked[key]},
          linkedProxyHandler,
        )
      }
      return linkedProxy[key]
    }
    return target[key]
  },
}

export function UnionCoreFactory<N extends keyof UnionNamespaces>(
  namespace: N,
): UnionNamespaces[N] {
  //@ts-ignore
  namespace = namespace || defaultNamespace
  const namespaces = getNamespaces()

  if (namespaces[namespace]) {
    return namespaces[namespace]
  }
  const bus = QuarkEventBus(namespace)
  const services = {
    atoms: {},
    bus,
  }
  const uc = {
    services,
    facade: new Proxy(services, facadeHandlers),
    bus,
  } as any
  namespaces[namespace] = uc
  return namespaces[namespace]
}
