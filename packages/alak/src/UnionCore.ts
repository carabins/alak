import { QuarkEventBus } from '@alaq/nucleus/bus'
import { defaultNamespace, getNamespaces, UnionNamespaces } from 'alak/namespaces'
import { unionAtom } from './unionAtom'

const atomLinked = {
  buses: 'bus',
  cores: 'core',
  actions: 'actions',
  states: 'state',
}


const linkedFacadeHandler = {
  get(o, key) {
    return o.atoms[key][o.key]
  },
}
const deCapitalize = (key) => key[0].toLowerCase() + key.substring(1)
const fastKey = ['Core', 'State', 'Atom', 'Bus']
const facadeHandlers = {
  get(services: any, key: string): any {
    for (const k of fastKey) {
      if (key.endsWith(k)) {
        const atomName = deCapitalize(key).replace(k, '')
        const a = services.atoms[atomName]
        if (a) {
          if (k === 'Atom') {
            return a
          }
          return a[deCapitalize(k)]
        }
      }
    }
    if (atomLinked[key]) {
      if (!services.activeFacades[key]) {
        services.activeFacades[key] = new Proxy(
          { atoms: services.atoms, key: atomLinked[key] },
          linkedFacadeHandler,
        )
      }
      return services.activeFacades[key]
    }
    return services[key]
  },
}

export function GetUnionCore<N extends keyof UnionNamespaces>(namespace?: N): UnionNamespaces[N] {
  const ns = namespace || defaultNamespace
  const namespaces = getNamespaces()
  if (namespaces[ns]) {
    return namespaces[ns]
  }
  const bus = QuarkEventBus(ns)
  const services = {
    atoms: {},
    bus,
    ns,
    activeFacades:{}
  }
  const uc = {
    uid:Math.random().toString(3),
    namespace: ns,
    services,
    facade: new Proxy(services, facadeHandlers),
    bus,
    addAtom<M>(constructor: IAlakConstructor<M, any, N>): IAtom<M> {
      return (services.atoms[constructor.name] = unionAtom(constructor))
    },
  } as any

  namespaces[ns] = uc
  return namespaces[ns]
}
