import { QuarkEventBus } from 'alak/index'
import isBrowser from 'packages/rune/src/isBrowser'

const defaultNamespace = 'defaultUnion' as keyof UnionNamespaces
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
  // apply: function (target: UnionCoreService, thisArg, [key, value]) {
  //   if (!key || !value) {
  //     console.error('KV Arguments need more', { key, value })
  //     return
  //   }
  //   target[key] = value
  // },
  get(target: UnionCoreService<any, any>, key): any {
    if (atomLinked[key]) {
      return target.atoms[key]
    }
    return target[key]
  },
}

export function UnionFactory<Models, Events, Services>(
  synthesis: UnionSynthesis<Models, Events, Services>,
): FacadeModel<Models, Events> & Services {
  const uc = UnionCoreFactory(synthesis.namespace as any)
  Object.keys(synthesis.models).forEach((modelName) => {
    uc
  })
  return
}

export function UnionCoreFactory<N extends keyof UnionNamespaces>(
  namespace: N,
): UnionNamespaces[N] {
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
  const facade = new Proxy(services, facadeHandlers)
  const uc = {
    services,
    facade,
    bus,
  } as UnionCore<any, any, any>
  namespace[ns] = uc
  return namespace[ns]
}

export interface ActiveUnions {}

type DefaultUnions = {
  defaultUnion:UnionCore<any, any, any>
}

type mixed<A extends Record<string, UnionCore<any, any, any>> = A


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
