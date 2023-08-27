import { QuarkEventBus } from 'alak/index'
import isBrowser from 'packages/rune/src/isBrowser'

const defaultNamespace = 'defaultUnion'
const AlakUnionNamespace = 'AlakUnionNamespace'
const AlakUnion = {
  namespaces: {},
}

function getBrowserNs() {
  if (window[AlakUnionNamespace]) {
    return (AlakUnion.namespaces = window[AlakUnionNamespace])
  }
  return (window[AlakUnionNamespace] = AlakUnion.namespaces)
}

const getNamespaces = () => (isBrowser ? getBrowserNs() : AlakUnion.namespaces) as UnionNamespaces

const atomLinked = {
  buses: true,
  cores: true,
  states: true,
}
const facadeHandlers = {
  get(target: UnionCoreService<any, any, any>, key): any {
    if (atomLinked[key]) {
      return target.atoms[key]
    }
    return target[key]
  },
}

export function UnionFactory<Models, Events, Services, Fabrice>(
  synthesis: UnionSynthesis<Models, Events, Services, Fabrice>,
): FacadeModel<Models, Events, Fabrice> & Services {
  const uc = UnionCoreFactory(synthesis.namespace as any) as IUnionCore
  Object.keys(synthesis.models).forEach((modelName) => {
    uc
  })
  return
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
  const facade = new Proxy(services, facadeHandlers)
  const uc = {
    services,
    facade,
    bus,
  } as any
  namespaces[namespace] = uc
  return namespaces[namespace]
}

export interface ActiveUnions {}

type DefaultUnions = {
  defaultUnion: IUnionCore
}

// type mixed<A extends Record<string, UnionCore<any, any, any>> = A

type UnionNamespaces = DefaultUnions & ActiveUnions

export function UnionFacade<N extends keyof UnionNamespaces>(namespace?: N): UnionNamespaces[N] {
  if (!namespace) {
    namespace = defaultNamespace as any
  }
  const namespaces = getNamespaces()
  if (!namespaces[namespace]) {
    console.error('namespace', namespace, 'not found')
    throw 'unknown namespace'
  }
  const z = namespaces[namespace]

  return namespaces[namespace]
}
