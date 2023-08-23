import { alakModel } from 'alak/model'
import { QuarkEventBus } from 'alak/index'
import isBrowser from 'packages/rune/src/isBrowser'

// export class ActiveCluster {
//   atoms = {} as Record<string, AlakAtom<any>>
//   bus: QuarkBus<string, any>
//   public constructor(public namespace: string) {
//     this.bus = QuarkEventBus(namespace)
//   }
// }

const defaultNamespace = 'ActiveUnion'
const AlakUnion = {
  namespaces: {},
}

function getBrowserNs() {
  if (window['AlakUnionNamespace']) {
    return (AlakUnion.namespaces = window['AlakUnionNamespace'])
  }
  return (window['AlakUnionNamespace'] = AlakUnion.namespaces)
}

const getNamespaces = () => (isBrowser ? getBrowserNs() : AlakUnion.namespaces) as UnionNamespaces

type UnionNamespaces = Record<string, UnionCore>

const atomLinked = {
  buses: true,
  cores: true,
  states: true,
}
const facadeHandlers = {
  get(target: UnionCoreService, key): any {
    if (atomLinked[key]) {
      return target.atoms[key]
    }
    return target[key]
  },
}
export function UnionCore<Models>(namespace: string = defaultNamespace): UnionCore {
  const namespaces = getNamespaces()
  if (namespaces[namespace]) {
    return namespaces[namespace]
  }
  const bus = QuarkEventBus(namespace)
  const services = {
    atoms: {},
    bus,
  }
  const facade = new Proxy(services, facadeHandlers) as FacadeModels<Models>
  return (namespaces[namespace] = {
    services,
    facade,
    bus,
  })
}

interface ActiveUnion {}

type UF = DefaultUnionFacades & ActiveUnion

export function UnionFacade<N extends keyof UF>(namespace?: N): UF[N] {
  if (!namespace) {
    namespace = defaultNamespace as any
  }
  const namespaces = getNamespaces()
  !namespaces[namespace] && UnionCore(namespace)
  return namespaces[namespace].facade
}
