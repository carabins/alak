import { QuarkEventBus } from '@alaq/nucleus/bus'
import { defaultNamespace, getNamespaces, UnionNamespaces } from 'alak/namespaces'

let atomCreator: any
export const registerAtomCreator = (fn: any) => {
  atomCreator = fn
}

const atomLinked = {
  buses: 'bus',
  cores: 'core',
  actions: 'action',
  states: 'state',
}


const linkedFacadeHandler = {
  get(o, key) {
    // let q = o.atoms[key]
    // if (q && q.atom) {
    //   console.log("::::::::::::~!!!!!", typeof q)
    //   console.log("::::::::::::~!!!!!", o.key)
    //   let a = q.atom[o.key]
    //   console.log("::::::::::::~~~~~~~", a)
    //   if (a) {
    //     return a
    //   } else {
    //     console.error('::: linkedProxyHandler', o.key)
    //   }
    // }
    // console.error(`ошибка вызова свойства [${o.key}] у несушествующего атома [${key}], доступные атомы ${Object.keys(o.atoms)}`)

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
      return (services.atoms[constructor.name] = atomCreator(constructor))
    },
  } as any

  namespaces[ns] = uc
  return namespaces[ns]
}
