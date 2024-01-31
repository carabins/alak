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
const deCapitalize = (key) => key[0].toLowerCase() + key.substring(1)
const fastKey = ['Core', 'State', 'Atom', 'Bus']
const facadeHandlers = {
  get(target: IUnionCoreService<any, any, any>, key: string): any {
    for (const k of fastKey) {
      if (key.endsWith(k)) {
        const atomName = deCapitalize(key).replace(k, '')
        console.warn('atom', atomName)
        const a = target.atoms[atomName]
        if (a) {
          return a[deCapitalize(k)]
        }
      }
    }
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

export function GetUnionCore<N extends keyof UnionNamespaces>(namespace: N): UnionNamespaces[N] {
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
