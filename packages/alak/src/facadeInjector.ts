import type { ActiveUnions, UnionNamespaces } from './namespaces'
import { defaultNamespace, getNamespaces } from './namespaces'
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
