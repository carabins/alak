import { ActiveUnions, defaultNamespace, getNamespaces, UnionNamespaces } from 'alak/namespaces'

// type AUFCores<NS extends keyof UnionNamespaces> = UnionNamespaces[NS]["facade"]["cores"]
// type AUFState<NS extends keyof UnionNamespaces> = UnionNamespaces[NS]["facade"]["states"]
// type AUFAtom<NS extends keyof UnionNamespaces> = UnionNamespaces[NS]["facade"]["atoms"]
//
// type IFAInjector<O, N extends string> = {
//   [K in keyof O as `${Capitalize<string & K>}${N}`]: O[K]
// }
// export type IFacadeInjector<NS extends keyof UnionNamespaces> = IFAInjector<AUFCores<NS>, "Core">
//   & IFAInjector<AUFState<NS>, "State">
//   & IFAInjector<AUFAtom<NS>, "Atom">

export function injectFacade<N extends keyof UnionNamespaces>(
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

// export function injectFacade<NS extends keyof UnionNamespaces>(namespace: NS): IFacadeInjector<NS> {
//   const namespaces = getNamespaces()
//   if (!namespaces[namespace]) {
//     console.error('namespace', namespace, 'not found')
//     throw 'unknown namespace'
//   }
//   const uc = namespaces[namespace]
//
//   return uc.services._injector
// }
