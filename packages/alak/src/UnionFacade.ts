import {defaultNamespace, getNamespaces, UnionNamespaces} from "alak/namespaces";

export function UnionFacade<N extends keyof UnionNamespaces>(namespace?: N): UnionNamespaces[N] {
  if (!namespace) {
    namespace = defaultNamespace as any
  }
  const namespaces = getNamespaces()
  if (!namespaces[namespace]) {
    console.error('namespace', namespace, 'not found')
    throw 'unknown namespace'
  }
  return namespaces[namespace]
}
